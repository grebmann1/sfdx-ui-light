import { z } from 'zod';
import LOGGER from 'shared/logger';
import { API as API_UTILS, compressImage } from 'shared/utils';
import type { ToolResultPart } from 'ai';
import {
    APEX_HELP,
    API_HELP,
    getApexExecutionExitCode,
    ORG_HELP,
    registerSalesforceShellCommands,
    SOQL_HELP,
    detectMetadataType,
} from 'core/bash';
import { store, APEX, API, QUERY, ERROR } from 'core/store';
import {
    getConfiguration,
    getPublicConfigurations,
    credentialStrategies,
    OAUTH_TYPES,
} from 'core/connector';
import type { ConnectorLike } from 'core/connector';
import { discoverSkills, fetchSkillByName } from 'agent/utils';
import { waitForLoaded, wrappedNavigate, formatTabId, openBrowser } from '../utils/utils';
import { saveSkillToFs } from './skillUtils';
import type { ShellCommandContext } from 'core/bash';
import {
    SHELL_TOOL_HELP,
    SKILL_PATH_TEMPLATES,
    TOOL_OUTPUT_LIMITS,
} from '../constants';

export type BashToolOptions = {
    execInSandbox?: (
        code: string,
        timeoutMs?: number
    ) => Promise<{ output: string; hasError: boolean; images?: Array<{ data: string; mediaType: string }> }>;
    readPdf?: (input: { query: string; url?: string; tabId?: number }) => Promise<object>;
    files?: string[];
    toolPrompt?: string;
    extraInstructions?: string;
    brightDataApiKey?: string | null;
};

export function generateBashDescription(cwd: string, opts?: BashToolOptions) {
    const lines = [
        SHELL_TOOL_HELP.bashIntro,
        '',
        `Working directory: ${cwd}`,
        SHELL_TOOL_HELP.useRelativePaths,
        '',
    ];
    if (opts?.files?.length) {
        const preview = opts.files.slice(0, 8);
        lines.push(SHELL_TOOL_HELP.availableFilesLabel);
        for (const file of preview) lines.push(`  ${file}`);
        if (opts.files.length > 8) lines.push(`  ... and ${opts.files.length - 8} more files`);
        lines.push('');
    }
    if (opts?.toolPrompt) {
        lines.push(opts.toolPrompt);
        lines.push('');
    }
    lines.push(SHELL_TOOL_HELP.customCommands);
    lines.push('');
    if (opts?.extraInstructions) {
        lines.push(opts.extraInstructions);
        lines.push('');
    }
    lines.push(SHELL_TOOL_HELP.sfCliShimsHelp);
    lines.push(APEX_HELP);
    lines.push('');
    lines.push(SOQL_HELP);
    lines.push('');
    lines.push(API_HELP);
    lines.push('');
    lines.push(ORG_HELP);
    lines.push('');
    return lines.join('\n').trim();
}

function createCommand(
    name: string,
    execute: (argv: string[], ctx: ShellCommandContext) => Promise<{ stdout: string; stderr: string; exitCode: number }>
) {
    return { name, execute };
}

function parseCliArgs(argv: string[]) {
    const flags = new Map<string, string | boolean | string[]>();
    const positionals: string[] = [];
    const addFlag = (key: string, value: string | boolean = true) => {
        const existing = flags.get(key);
        if (existing == null) {
            flags.set(key, value);
            return;
        }
        if (Array.isArray(existing)) {
            existing.push(value as string);
            return;
        }
        flags.set(key, [existing as string, value as string]);
    };
    const expectValueFlags = new Set([
        'f',
        'file',
        'c',
        'apex-code',
        'content',
        'q',
        'query',
        'H',
        'header',
        'X',
        'method',
        'url',
        'endpoint',
        'body',
        'u',
        'name',
        'n',
        'description',
        'd',
        'scope',
        's',
    ]);
    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === '--') {
            positionals.push(...argv.slice(i + 1));
            break;
        }
        if (arg.startsWith('--')) {
            const [rawKey, inlineValue] = arg.slice(2).split('=');
            if (inlineValue !== undefined) {
                addFlag(rawKey, inlineValue);
                continue;
            }
            const next = argv[i + 1];
            if (next == null || next.startsWith('-') || !expectValueFlags.has(rawKey)) {
                addFlag(rawKey, true);
            } else {
                addFlag(rawKey, next);
                i += 1;
            }
            continue;
        }
        if (arg.startsWith('-') && arg.length > 1) {
            const key = arg.slice(1);
            const next = argv[i + 1];
            if (next == null || next.startsWith('-') || !expectValueFlags.has(key)) {
                addFlag(key, true);
            } else {
                addFlag(key, next);
                i += 1;
            }
            continue;
        }
        positionals.push(arg);
    }
    return { flags, positionals };
}

function getFlagValue(flags: Map<string, string | boolean | string[]>, ...names: string[]) {
    for (const name of names) {
        if (flags.has(name)) return flags.get(name);
    }
    return undefined;
}

function ensureSingleValue(value: string | boolean | string[] | undefined) {
    if (Array.isArray(value)) return value[value.length - 1];
    return value;
}


async function getConnectorByAlias(alias: string): Promise<ConnectorLike> {
    const config = await getConfiguration(alias);
    const strategy = credentialStrategies[config.credentialType || OAUTH_TYPES.OAUTH];
    if (!strategy) {
        throw new Error(`No strategy for credential type: ${config.credentialType}`);
    }
    return strategy.connect({ ...config, alias, disableEvent: false });
}

async function resolveCliFileContent(filePath: string, ctx: ShellCommandContext) {
    const resolvedPath = ctx.fs.resolvePath(ctx.cwd, filePath);
    try {
        const content = await ctx.fs.readFile(resolvedPath, 'utf-8');
        return { content, resolvedPath };
    } catch {
        return { content: null, resolvedPath };
    }
}

async function callConnectorRest({
    path,
    method = 'GET',
    body,
    extraHeaders = {},
    isTooling = false,
}: {
    path: string;
    method?: string;
    body?: string;
    extraHeaders?: Record<string, string>;
    isTooling?: boolean;
}): Promise<{ data: any; status: number }> {
    const state = store.getState() as any;
    const connector = state?.application?.connector;
    if (!connector?.conn) {
        throw new Error('No active org connector found.');
    }
    const { conn } = connector;
    const version = conn.version || '59.0';
    const baseSegment = isTooling ? `/services/data/v${version}/tooling` : `/services/data/v${version}`;
    const url = path.startsWith('http')
        ? path
        : `${conn.instanceUrl}${baseSegment}${path.startsWith('/') ? path : `/${path}`}`;

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...extraHeaders,
    };
    if (conn.accessToken) {
        headers.Authorization = `Bearer ${conn.accessToken}`;
    }

    const res = await fetch(url, {
        method,
        headers,
        body: body ?? undefined,
    });

    const contentType = res.headers.get('content-type') || '';
    let data: any;
    if (contentType.includes('application/json')) {
        try { data = await res.json(); } catch { data = await res.text(); }
    } else {
        data = await res.text();
    }

    if (!res.ok) {
        const errorMsg = Array.isArray(data)
            ? data.map((e: any) => e.message || JSON.stringify(e)).join('; ')
            : (typeof data === 'object' ? JSON.stringify(data) : String(data));
        throw new Error(`HTTP ${res.status}: ${errorMsg}`);
    }

    return { data, status: res.status };
}

async function getConnectorVersion(): Promise<string> {
    const state = store.getState() as any;
    return state?.application?.connector?.conn?.version || '59.0';
}

async function getConnectorUserInfo(): Promise<{ id: string; username: string }> {
    const state = store.getState() as any;
    const conn = state?.application?.connector?.conn;
    if (!conn) throw new Error('No active org connector found.');
    const userInfo = conn.userInfo || {};
    return {
        id: userInfo.id || userInfo.user_id || '',
        username: userInfo.username || userInfo.preferred_username || '',
    };
}

export function registerShellCommands({
    shell,
    opts,
    images,
}: {
    shell: {
        registerCommand: (cmd: { name: string; execute: (argv: string[], ctx: ShellCommandContext) => Promise<{ stdout: string; stderr: string; exitCode: number }> }) => void;
    };
    opts: BashToolOptions;
    images: Array<{ data: string; mediaType: string }>;
}) {
    if (opts.execInSandbox) {
        const execInSandbox = opts.execInSandbox;

        const parseJsArgs = (argv: string[]) => {
            let timeoutMs: number | undefined;
            const argsWithoutFlags: string[] = [];

            for (let i = 0; i < argv.length; i++) {
                if (argv[i] === '--timeout' && i + 1 < argv.length) {
                    timeoutMs = parseInt(argv[i + 1], 10);
                    if (Number.isNaN(timeoutMs)) {
                        return {
                            timeoutMs: undefined,
                            argsWithoutFlags: [],
                            error: {
                                stdout: '',
                                stderr: 'Error: --timeout requires a numeric value\n',
                                exitCode: 1,
                            },
                        };
                    }
                    i += 1;
                    continue;
                }
                argsWithoutFlags.push(argv[i]);
            }

            return { timeoutMs, argsWithoutFlags, error: null };
        };

        const loadJsCode = async (argsWithoutFlags: string[], ctx: ShellCommandContext) => {
            const inlineIndex = argsWithoutFlags.indexOf('-e');
            if (inlineIndex !== -1) {
                const inlineCode = argsWithoutFlags.slice(inlineIndex + 1).join(' ');
                const code = inlineCode || ctx.stdin || '';
                if (!code) {
                    return {
                        code: null,
                        error: { stdout: '', stderr: "Usage: js -e '<code>'\n", exitCode: 1 },
                    };
                }
                return { code, error: null };
            }

            const file = argsWithoutFlags[0];
            if (!file) {
                return {
                    code: null,
                    error: {
                        stdout: '',
                        stderr: "Usage: js -e '<code>' or js <file>\nRun js --help for full documentation.\n",
                        exitCode: 1,
                    },
                };
            }

            const resolvedPath = ctx.fs.resolvePath(ctx.cwd, file);
            try {
                const code = await ctx.fs.readFile(resolvedPath, 'utf-8');
                return { code, error: null };
            } catch {
                return {
                    code: null,
                    error: {
                        stdout: '',
                        stderr: `Error: Cannot read file: ${resolvedPath}\n`,
                        exitCode: 1,
                    },
                };
            }
        };

        const jsCommand = createCommand('js', async (argv, ctx) => {
            if (argv.includes('--help') || argv.includes('-h')) {
                return { stdout: SHELL_TOOL_HELP.js, stderr: '', exitCode: 0 };
            }
            const parsed = parseJsArgs(argv);
            if (parsed.error) return parsed.error;

            const codeResult = await loadJsCode(parsed.argsWithoutFlags, ctx);
            if (codeResult.error) return codeResult.error;

            try {
                const res = await execInSandbox(codeResult.code, parsed.timeoutMs);
                if (res.images?.length) images.push(...res.images);
                LOGGER.debug('[agent:tool:bash:js] sandbox execution result', { res });
                const response = { 
                    stdout: (await capToolOutput(res.output ?? '', 'js', ctx.fs)).text,
                    stderr: '',
                    exitCode: res.hasError ? 1 : 0
                };
                LOGGER.debug('[agent:tool:bash:js] response', { response });
                return response;
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                LOGGER.debug('[agent:tool:bash:js] sandbox execution failed', { message });
                return { stdout: '', stderr: `Error: ${message}\n`, exitCode: 1 };
            }
        });
        shell.registerCommand(jsCommand);
    }

    const openCommand = createCommand('open', async (argv, ctx) => {
        const target = argv?.[0];
        if (!target) {
            return { stdout: '', stderr: 'open: missing file path\n', exitCode: 1 };
        }
        const resolved = ctx.fs.resolvePath(ctx.cwd, target);
        const exists = await ctx.fs.exists(resolved);
        if (!exists) {
            return { stdout: '', stderr: `open: file not found: ${resolved}\n`, exitCode: 1 };
        }
        const tabs = (chrome as any)?.tabs;
        if (typeof chrome === 'undefined' || !chrome.runtime?.getURL || !tabs?.create) {
            return { stdout: '', stderr: 'open: chrome runtime unavailable\n', exitCode: 1 };
        }
        const viewerUrl = chrome.runtime.getURL(
            `views/viewer.html?file=${encodeURIComponent(resolved)}`
        );
        await tabs.create({ url: viewerUrl, active: true });
        return { stdout: `Opened ${resolved}`, stderr: '', exitCode: 0 };
    });
    shell.registerCommand(openCommand);

    const saveSkillCommand = createCommand('save-skill', async (argv, ctx) => {
        if (argv.includes('--help') || argv.includes('-h')) {
            return { stdout: SHELL_TOOL_HELP.saveSkill, stderr: '', exitCode: 0 };
        }
        const { flags } = parseCliArgs(argv);
        const name = ensureSingleValue(getFlagValue(flags, 'name', 'n'));
        const description = ensureSingleValue(getFlagValue(flags, 'description', 'd'));
        const scopeFlag = ensureSingleValue(getFlagValue(flags, 'scope', 's'));
        const overwrite = Boolean(getFlagValue(flags, 'overwrite'));
        let content = ensureSingleValue(getFlagValue(flags, 'content', 'c'));
        let fileFlag = ensureSingleValue(getFlagValue(flags, 'file', 'f'));

        if (typeof content === 'string' && content.startsWith('@')) {
            fileFlag = content.slice(1);
            content = '';
        }
        if (!content && ctx.stdin) {
            content = ctx.stdin;
        }
        if (!content && typeof fileFlag === 'string') {
            const fileResult = await resolveCliFileContent(fileFlag, ctx);
            if (!fileResult.content) {
                return {
                    stdout: '',
                    stderr: `Error: Cannot read file: ${fileResult.resolvedPath}\n`,
                    exitCode: 1,
                };
            }
            content = fileResult.content;
        }
        if (!name || typeof name !== 'string') {
            return {
                stdout: '',
                stderr: `Error: Missing skill name. Use --name.\n\n${SHELL_TOOL_HELP.saveSkill}\n`,
                exitCode: 1,
            };
        }
        if (!description || typeof description !== 'string') {
            return {
                stdout: '',
                stderr: `Error: Missing description. Use --description.\n\n${SHELL_TOOL_HELP.saveSkill}\n`,
                exitCode: 1,
            };
        }
        if (!content || typeof content !== 'string') {
            return {
                stdout: '',
                stderr: `Error: Missing content. Use --content or --file.\n\n${SHELL_TOOL_HELP.saveSkill}\n`,
                exitCode: 1,
            };
        }
        const scope =
            typeof scopeFlag === 'string' && scopeFlag.toLowerCase() === 'user'
                ? 'user'
                : typeof scopeFlag === 'string' && scopeFlag.toLowerCase() === 'project'
                  ? 'project'
                  : undefined;
        if (scopeFlag && !scope) {
            return {
                stdout: '',
                stderr: `Error: Invalid scope "${scopeFlag}". Use "project" or "user".\n\n${SHELL_TOOL_HELP.saveSkill}\n`,
                exitCode: 1,
            };
        }
        const result = await saveSkillToFs(ctx.fs, {
            name,
            description,
            content,
            scope,
            overwrite,
        });
        if (!result.ok) {
            return {
                stdout: '',
                stderr: `Error: ${result.error}\n`,
                exitCode: 1,
            };
        }
        return {
            stdout: `Saved skill "${name}" to ${result.skillPath}`,
            stderr: '',
            exitCode: 0,
        };
    });
    shell.registerCommand(saveSkillCommand);

    if (opts.brightDataApiKey) {
        const brightDataApiKey = opts.brightDataApiKey;

        const webSearchCommand = createCommand('web-search', async (argv, _ctx) => {
            if (argv.includes('--help') || argv.includes('-h')) {
                return { stdout: SHELL_TOOL_HELP.webSearch, stderr: '', exitCode: 0 };
            }

            const { flags, positionals } = parseCliArgs(argv);
            const queryFromFlag = ensureSingleValue(getFlagValue(flags, 'query', 'q'));
            const query =
                typeof queryFromFlag === 'string'
                    ? queryFromFlag
                    : positionals.join(' ').trim();

            if (!query) {
                return {
                    stdout: '',
                    stderr: `Error: Missing search query. Usage: web-search "your query"\n\n${SHELL_TOOL_HELP.webSearch}\n`,
                    exitCode: 1,
                };
            }

            const zone = ensureSingleValue(getFlagValue(flags, 'zone', 'z'));
            const country = ensureSingleValue(getFlagValue(flags, 'country', 'c'));

            const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&hl=en${country ? `&gl=${country}` : ''}`;

            try {
                const body: Record<string, unknown> = {
                    zone: typeof zone === 'string' ? zone : 'serp_api1',
                    url: searchUrl,
                    format: 'json',
                };
                if (country && typeof country === 'string') {
                    body.country = country;
                }

                const response = await fetch('https://api.brightdata.com/request', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${brightDataApiKey}`,
                    },
                    body: JSON.stringify(body),
                });

                if (!response.ok) {
                    const text = await response.text().catch(() => response.statusText);
                    return {
                        stdout: '',
                        stderr: `Error: Bright Data API returned ${response.status}: ${text}\n`,
                        exitCode: 1,
                    };
                }

                const data = await response.json();
                return {
                    stdout: JSON.stringify(data, null, 2),
                    stderr: '',
                    exitCode: 0,
                };
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                return {
                    stdout: '',
                    stderr: `Error: web-search failed: ${message}\n`,
                    exitCode: 1,
                };
            }
        });
        shell.registerCommand(webSearchCommand);
    }

    registerSalesforceShellCommands({
        shell,
        handlers: {
            async executeApex({ apexCode, shouldOpenUi }) {
                try {
                    const result = await store.dispatch(async (dispatch, getState) => {
                        const { application, apex } = getState();
                        if (!application?.connector) {
                            throw new Error('No active org connector found.');
                        }
                        if (application.isLoading && shouldOpenUi) await waitForLoaded();
                        if (shouldOpenUi) {
                            await wrappedNavigate({ applicationName: 'anonymousapex' });
                        }
                        const { tabId: realTabId, isNewTab } = formatTabId(null, apex.tabs);
                        if (isNewTab) {
                            await dispatch(
                                APEX.reduxSlice.actions.addTab({ tab: { id: realTabId, body: apexCode } })
                            );
                        } else {
                            await dispatch(APEX.reduxSlice.actions.selectionTab({ id: realTabId }));
                            await dispatch(APEX.reduxSlice.actions.updateBody({ body: apexCode }));
                        }
                        const apexPromise = dispatch(
                            APEX.executeApexAnonymous({
                                connector: application.connector,
                                body: apexCode,
                                tabId: realTabId,
                                createdDate: Date.now(),
                            })
                        );
                        dispatch(
                            APEX.reduxSlice.actions.setAbortingPromise({
                                tabId: realTabId,
                                promise: apexPromise,
                            })
                        );
                        const res = (await apexPromise) as any;
                        await dispatch(APEX.reduxSlice.actions.selectionTab({ id: realTabId }));
                        let output = { ...(res.payload?.response || {}), tabId: realTabId };
                        if (res.error) {
                            output = { ...output, error: res.error };
                        }
                        return output;
                    });

                    return {
                        result,
                        exitCode: getApexExecutionExitCode(result),
                    };
                } catch (err) {
                    const message = err instanceof Error ? err.message : String(err);
                    store.dispatch(
                        ERROR.reduxSlice.actions.addError({
                            message: 'Failed to execute Apex script',
                            details: message,
                        })
                    );
                    throw err;
                }
            },
            async executeSoql({ query, useToolingApi, includeDeletedRecords }) {
                const result = await store.dispatch(async (dispatch, getState) => {
                    const { application } = getState();
                    if (!application?.connector) {
                        throw new Error('No active org connector found.');
                    }
                    const res = (await dispatch(
                        QUERY.executeQueryIncognito({
                            connector: application.connector,
                            soql: query,
                            tabId: `cli-${Date.now()}`,
                            useToolingApi,
                            includeDeletedRecords,
                        })
                    )) as any;
                    let output = res.payload;
                    if (res.error) {
                        output = { error: res.error };
                    }
                    return output;
                });
                return { result };
            },
            async executeApi({ method, endpoint, body, headerText }) {
                const result = await store.dispatch(async (dispatch, getState) => {
                    const { application } = getState();
                    if (!application?.connector) {
                        throw new Error('No active org connector found.');
                    }
                    const { request: formattedRequest, error } = API_UTILS.formatApiRequest({
                        endpoint,
                        method,
                        body,
                        header: headerText,
                        connector: application.connector as any,
                        replaceVariableValues: value => value,
                    });
                    if (error) {
                        throw new Error(error);
                    }
                    const originalRequest = {
                        endpoint,
                        method,
                        body,
                        header: headerText,
                    };
                    const tabId = `cli-${Date.now()}`;
                    const apiPromise = dispatch(
                        API.executeApiRequest({
                            connector: application.connector,
                            request: originalRequest,
                            formattedRequest,
                            tabId,
                            createdDate: Date.now(),
                        })
                    );
                    dispatch(
                        API.reduxSlice.actions.setAbortingPromise({
                            tabId,
                            promise: apiPromise,
                        })
                    );
                    const res = (await apiPromise) as any;
                    return res.payload?.response || res.payload || res;
                });
                return { result };
            },
            async listOrgs() {
                return { result: await getPublicConfigurations() };
            },
            async openOrg({ alias }) {
                const connector = await getConnectorByAlias(alias);
                await openBrowser({ url: connector.frontDoorUrl, alias, target: 'default' });
                return { result: `Opened org ${alias}` };
            },
            async runApexTests({ classNames, testLevel, timeoutMs }) {
                const requestBody: Record<string, any> = { testLevel };
                if (classNames.length > 0) {
                    requestBody.classNames = classNames.join(',');
                }
                const { data: jobId } = await callConnectorRest({
                    path: '/runTestsAsynchronous',
                    method: 'POST',
                    body: JSON.stringify(requestBody),
                    isTooling: true,
                });
                if (!jobId || typeof jobId !== 'string') {
                    throw new Error('Unexpected response from runTestsAsynchronous');
                }

                const deadline = Date.now() + timeoutMs;
                const pollQuery = `SELECT+Id,Status,NumberTestsTotal,NumberTestsCompleted,NumberTestErrors+FROM+ApexTestRunResult+WHERE+AsyncApexJobId='${jobId}'`;
                let runResult: any = null;
                while (Date.now() < deadline) {
                    await new Promise(r => setTimeout(r, 2000));
                    const { data } = await callConnectorRest({
                        path: `/query?q=${pollQuery}`,
                        isTooling: true,
                    });
                    const record = data?.records?.[0];
                    if (record && ['Completed', 'Failed', 'Aborted'].includes(record.Status)) {
                        runResult = record;
                        break;
                    }
                }

                const resultsQuery = `SELECT+MethodName,Outcome,Message,StackTrace,ApexClass.Name+FROM+ApexTestResult+WHERE+AsyncApexJobId='${jobId}'+ORDER+BY+Outcome+ASC`;
                const { data: resultsData } = await callConnectorRest({
                    path: `/query?q=${resultsQuery}`,
                    isTooling: true,
                });
                const testResults = resultsData?.records || [];

                const passed = testResults.filter((r: any) => r.Outcome === 'Pass').length;
                const failed = testResults.filter((r: any) => r.Outcome === 'Fail').length;
                const skipped = testResults.filter((r: any) => r.Outcome === 'Skip').length;

                const summary = runResult
                    ? { status: runResult.Status, total: runResult.NumberTestsTotal, completed: runResult.NumberTestsCompleted, errors: runResult.NumberTestErrors }
                    : { status: 'timeout', passed, failed, skipped };

                const failures = testResults
                    .filter((r: any) => r.Outcome === 'Fail')
                    .map((r: any) => ({ class: r.ApexClass?.Name, method: r.MethodName, message: r.Message, stackTrace: r.StackTrace }));

                const exitCode = failed > 0 || summary.status === 'timeout' ? 1 : 0;
                return { result: { jobId, summary: { ...summary, passed, failed, skipped }, failures }, exitCode };
            },
            async enableDebugLog({ durationMinutes }) {
                const userInfo = await getConnectorUserInfo();
                let userId = userInfo.id;

                // Resolve user ID from username if not available directly
                if (!userId && userInfo.username) {
                    const { data } = await callConnectorRest({
                        path: `/query?q=SELECT+Id+FROM+User+WHERE+Username='${userInfo.username}'+LIMIT+1`,
                    });
                    userId = data?.records?.[0]?.Id || '';
                }
                if (!userId) throw new Error('Could not determine current user ID.');

                // Ensure a DebugLevel record exists
                const { data: dlData } = await callConnectorRest({
                    path: `/query?q=SELECT+Id+FROM+DebugLevel+WHERE+DeveloperName='WorkbenchAgent'+LIMIT+1`,
                    isTooling: true,
                });
                let debugLevelId: string = dlData?.records?.[0]?.Id || '';
                if (!debugLevelId) {
                    const { data: newDl } = await callConnectorRest({
                        path: '/sobjects/DebugLevel',
                        method: 'POST',
                        body: JSON.stringify({
                            DeveloperName: 'WorkbenchAgent',
                            MasterLabel: 'Workbench Agent',
                            ApexCode: 'DEBUG',
                            ApexProfiling: 'NONE',
                            Callout: 'INFO',
                            Database: 'INFO',
                            System: 'DEBUG',
                            Validation: 'INFO',
                            Visualforce: 'INFO',
                            Workflow: 'INFO',
                        }),
                        isTooling: true,
                    });
                    debugLevelId = newDl?.id || newDl?.Id || '';
                }
                if (!debugLevelId) throw new Error('Could not find or create DebugLevel.');

                const now = new Date();
                const expiry = new Date(now.getTime() + durationMinutes * 60 * 1000);

                // Delete any existing TraceFlag for this user to avoid conflicts
                const { data: tfData } = await callConnectorRest({
                    path: `/query?q=SELECT+Id+FROM+TraceFlag+WHERE+TracedEntityId='${userId}'+AND+LogType='DEVELOPER_LOG'+LIMIT+1`,
                    isTooling: true,
                });
                const existingTfId: string = tfData?.records?.[0]?.Id || '';
                if (existingTfId) {
                    await callConnectorRest({
                        path: `/sobjects/TraceFlag/${existingTfId}`,
                        method: 'DELETE',
                        isTooling: true,
                    });
                }

                await callConnectorRest({
                    path: '/sobjects/TraceFlag',
                    method: 'POST',
                    body: JSON.stringify({
                        TracedEntityId: userId,
                        DebugLevelId: debugLevelId,
                        LogType: 'DEVELOPER_LOG',
                        StartDate: now.toISOString(),
                        ExpirationDate: expiry.toISOString(),
                    }),
                    isTooling: true,
                });

                return {
                    result: {
                        enabled: true,
                        userId,
                        expiresAt: expiry.toISOString(),
                        durationMinutes,
                    },
                };
            },
            async listDebugLogs({ limit }) {
                const safeLimit = Math.min(Math.max(1, limit), 200);
                const q = `SELECT+Id,LogUser.Name,Application,DurationMilliseconds,StartTime,Status,LogLength+FROM+ApexLog+ORDER+BY+StartTime+DESC+LIMIT+${safeLimit}`;
                const { data } = await callConnectorRest({ path: `/query?q=${q}`, isTooling: true });
                return { result: data?.records || [] };
            },
            async getDebugLog({ logId, outputPath, ctx }) {
                const { data } = await callConnectorRest({
                    path: `/sobjects/ApexLog/${logId}/Body`,
                    extraHeaders: { Accept: 'text/plain' },
                    isTooling: true,
                });
                const logText = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
                if (outputPath && ctx.fs.writeFile) {
                    const resolved = ctx.fs.resolvePath(ctx.cwd, outputPath);
                    await ctx.fs.writeFile(resolved, logText);
                    return { result: `Log saved to ${resolved} (${logText.length} chars)` };
                }
                return { result: logText };
            },
            async displayLimits() {
                const version = await getConnectorVersion();
                const { data } = await callConnectorRest({ path: '/limits' });
                if (!data || typeof data !== 'object') return { result: data };
                const lines = Object.entries(data).map(([name, val]: [string, any]) => {
                    const max = val?.Max ?? '?';
                    const remaining = val?.Remaining ?? '?';
                    const used = typeof max === 'number' && typeof remaining === 'number' ? max - remaining : '?';
                    return `${name}: ${used}/${max} used (${remaining} remaining)`;
                });
                return { result: { apiVersion: version, limits: data, summary: lines.join('\n') } };
            },
            async describeSObject({ objectName }) {
                const { data } = await callConnectorRest({ path: `/sobjects/${objectName}/describe` });
                if (!data || typeof data !== 'object') return { result: data };
                const fields = (data.fields || []).map((f: any) => ({
                    name: f.name,
                    label: f.label,
                    type: f.type,
                    length: f.length,
                    required: !f.nillable && !f.defaultedOnCreate,
                    updateable: f.updateable,
                    referenceTo: f.referenceTo?.length ? f.referenceTo : undefined,
                }));
                return {
                    result: {
                        name: data.name,
                        label: data.label,
                        keyPrefix: data.keyPrefix,
                        custom: data.custom,
                        queryable: data.queryable,
                        createable: data.createable,
                        updateable: data.updateable,
                        deletable: data.deletable,
                        fieldCount: fields.length,
                        fields,
                    },
                };
            },
            async deployMetadata({ filePath, metadataType, apiName, ctx }) {
                const resolved = ctx.fs.resolvePath(ctx.cwd, filePath);
                let content: string | null = null;
                try {
                    content = await ctx.fs.readFile(resolved, 'utf-8');
                } catch {
                    throw new Error(`Cannot read file: ${resolved}`);
                }

                const detected = detectMetadataType(resolved);
                const type = metadataType || detected.type;
                const name = apiName || detected.apiName;

                if (!type) {
                    throw new Error(
                        `Cannot detect metadata type for "${resolved}". Use --metadata-type to specify it explicitly.`
                    );
                }

                const bodyField = type === 'StaticResource' ? 'Body' : 'Body';
                const nameField = 'Name';

                // Check if record already exists
                const q = `SELECT+Id+FROM+${type}+WHERE+${nameField}='${name}'+LIMIT+1`;
                const { data: existing } = await callConnectorRest({
                    path: `/query?q=${q}`,
                    isTooling: true,
                });
                const existingId: string = existing?.records?.[0]?.Id || '';

                if (existingId) {
                    await callConnectorRest({
                        path: `/sobjects/${type}/${existingId}`,
                        method: 'PATCH',
                        body: JSON.stringify({ [bodyField]: content }),
                        isTooling: true,
                    });
                    return { result: { deployed: true, type, name, action: 'updated', id: existingId } };
                } else {
                    const version = await getConnectorVersion();
                    const { data: created } = await callConnectorRest({
                        path: `/sobjects/${type}`,
                        method: 'POST',
                        body: JSON.stringify({ [nameField]: name, [bodyField]: content, ApiVersion: parseFloat(version) }),
                        isTooling: true,
                    });
                    return { result: { deployed: true, type, name, action: 'created', id: created?.id || created?.Id } };
                }
            },
            async retrieveMetadata({ metadataType, apiName, outputPath, ctx }) {
                const q = `SELECT+Id,Name,Body+FROM+${metadataType}+WHERE+Name='${apiName}'+LIMIT+1`;
                const { data } = await callConnectorRest({
                    path: `/query?q=${q}`,
                    isTooling: true,
                });
                const record = data?.records?.[0];
                if (!record) {
                    throw new Error(`No ${metadataType} found with name "${apiName}".`);
                }

                const extMap: Record<string, string> = {
                    ApexClass: '.cls',
                    ApexTrigger: '.trigger',
                    ApexPage: '.page',
                    ApexComponent: '.component',
                    StaticResource: '.resource',
                };
                const ext = extMap[metadataType] || '.txt';
                const filename = `${apiName}${ext}`;
                const targetDir = outputPath
                    ? ctx.fs.resolvePath(ctx.cwd, outputPath)
                    : '/workspace';
                const targetPath = `${targetDir}/${filename}`;

                if (ctx.fs.writeFile) {
                    if (ctx.fs.mkdir) {
                        await ctx.fs.mkdir(targetDir, { recursive: true });
                    }
                    await ctx.fs.writeFile(targetPath, record.Body || '');
                }

                return {
                    result: {
                        retrieved: true,
                        type: metadataType,
                        name: apiName,
                        savedTo: targetPath,
                        size: (record.Body || '').length,
                    },
                };
            },
        },
    });
}

function createTool(definition) {
    return {
        type: 'function',
        ...definition,
    };
}

function sanitizePathSegment(value, fallback = 'item') {
    const text = String(value || '')
        .trim()
        .replace(/[^a-zA-Z0-9._-]/g, '_');
    return text.length > 0 ? text : fallback;
}

function extensionForMimeType(mimeType, fallback = 'bin') {
    switch (mimeType) {
        case 'image/jpeg':
            return 'jpg';
        case 'image/png':
            return 'png';
        case 'image/webp':
            return 'webp';
        case 'image/gif':
            return 'gif';
        default:
            return fallback;
    }
}

function sanitizeToolName(value) {
    return (
        String(value || '')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9-]+/g, '-') || 'tool'
    );
}

function buildCapNotice(path, totalChars) {
    return [
        `${TOOL_OUTPUT_LIMITS.truncatedMarker} Full output (${totalChars} chars) saved to ${path}.`,
        'Page through it with bash:',
        `sed -n '1,${TOOL_OUTPUT_LIMITS.pageSize}p' "${path}"`,
        `sed -n '${TOOL_OUTPUT_LIMITS.pageSize + 1},${TOOL_OUTPUT_LIMITS.pageSize * 2}p' "${path}"`,
        `rg "pattern" "${path}"`,
    ].join('\n');
}

function buildHeadSectionHeader(chars) {
    return `[HEAD: first ${chars} chars of output]`;
}

function buildTailSectionHeader() {
    return `[TAIL: last ${TOOL_OUTPUT_LIMITS.tailChars} chars of output]`;
}

function buildTruncationSummary(path, totalChars) {
    return `[... TRUNCATED (${totalChars} chars total, saved to ${path}) ...]`;
}

function buildTruncatedText(text, savedPath, notice) {
    const totalLength = text.length;
    const tail = text.slice(-TOOL_OUTPUT_LIMITS.tailChars);
    const tailHeader = buildTailSectionHeader();
    const truncationSummary = buildTruncationSummary(savedPath, totalLength);
    const maxHeadLength = headHeaderLength =>
        Math.max(
            0,
            TOOL_OUTPUT_LIMITS.maxChars -
                tail.length -
                notice.length -
                truncationSummary.length -
                headHeaderLength -
                tailHeader.length -
                TOOL_OUTPUT_LIMITS.sectionContentSeparator.length * 2 -
                TOOL_OUTPUT_LIMITS.sectionSeparator.length * 3
        );
    let headLength = maxHeadLength(buildHeadSectionHeader(0).length);
    // This loop iteratively recalculates the correct `headLength` for output truncation so that,
    // after accounting for all headers, tail, notice, and separators, the final `combined` text
    // will not exceed TOOL_OUTPUT_LIMITS.maxChars. It fixes the head length point where adding
    // more to the head would either not fit or would not result in any additional space usage.
    while (true) {
        const next = maxHeadLength(buildHeadSectionHeader(headLength).length);
        if (next === headLength) break;
        headLength = next;
    }
    let head = text.slice(0, headLength);
    let combined = [
        `${buildHeadSectionHeader(head.length)}${TOOL_OUTPUT_LIMITS.sectionContentSeparator}${head}`,
        truncationSummary,
        `${tailHeader}${TOOL_OUTPUT_LIMITS.sectionContentSeparator}${tail}`,
        notice,
    ].join(TOOL_OUTPUT_LIMITS.sectionSeparator);
    if (combined.length > TOOL_OUTPUT_LIMITS.maxChars) {
        head = head.slice(0, Math.max(0, head.length - (combined.length - TOOL_OUTPUT_LIMITS.maxChars)));
        combined = [
            `${buildHeadSectionHeader(head.length)}${TOOL_OUTPUT_LIMITS.sectionContentSeparator}${head}`,
            truncationSummary,
            `${tailHeader}${TOOL_OUTPUT_LIMITS.sectionContentSeparator}${tail}`,
            notice,
        ].join(TOOL_OUTPUT_LIMITS.sectionSeparator);
    }
    return combined;
}

function containsToolOutputCapNotice(text) {
    return text.includes(TOOL_OUTPUT_LIMITS.truncatedMarker);
}

async function capToolOutput(text, toolName, fs) {
    if (text.length <= TOOL_OUTPUT_LIMITS.maxChars) {
        return { text, wasCapped: false };
    }

    const withFsTimeout = async (promise, label, timeoutMs = 5000) => {
        let timer;
        try {
            return await Promise.race([
                promise,
                new Promise((_, reject) => {
                    timer = setTimeout(() => {
                        reject(new Error(`${label} timed out after ${timeoutMs}ms`));
                    }, timeoutMs);
                }),
            ]);
        } finally {
            clearTimeout(timer);
        }
    };

    const fileName = `${sanitizeToolName(toolName)}-${Date.now()}.txt`;
    const savedPath = `${TOOL_OUTPUT_LIMITS.directory}/${fileName}`;
    try {
        await withFsTimeout(
            fs.mkdir(TOOL_OUTPUT_LIMITS.directory, { recursive: true }),
            'capToolOutput mkdir'
        );
        await withFsTimeout(
            fs.writeFile(savedPath, text, { encoding: 'utf-8' }),
            'capToolOutput writeFile'
        );
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const fallbackText =
            `${text.slice(0, TOOL_OUTPUT_LIMITS.maxChars)}\n\n` +
            `[OUTPUT TRUNCATED] Full output could not be persisted: ${message}`;
        return {
            text: fallbackText,
            wasCapped: true,
        };
    }
    const notice = buildCapNotice(savedPath, text.length);

    let truncatedText;
    try {
        truncatedText = buildTruncatedText(text, savedPath, notice);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
            text:
                `${text.slice(0, TOOL_OUTPUT_LIMITS.maxChars)}\n\n` +
                `[OUTPUT TRUNCATED] buildTruncatedText failed: ${message}`,
            wasCapped: true,
            savedPath,
        };
    }
    return {
        text: truncatedText,
        wasCapped: true,
        savedPath,
    };
}

export function parseDataUrl(dataUrl) {
    if (typeof dataUrl !== 'string') return null;
    const match = dataUrl.match(/^data:([^;,]+)(;[^,]*)?,(.*)$/);
    if (!match) return null;
    const mediaType = match[1] || 'application/octet-stream';
    const metadata = match[2] || '';
    const payload = match[3] || '';
    const isBase64 = metadata.toLowerCase().includes(';base64');
    if (!isBase64 || !payload) return null;
    return { mediaType, base64: payload };
}

async function persistToolImageDataUrl(fs, dataUrl, conversationId, index) {
    const parsed = parseDataUrl(dataUrl);
    if (!parsed) return null;
    const safeConversationId = sanitizePathSegment(conversationId || 'default');
    const baseDir = `/workspace/.agent-images/${safeConversationId}`;
    try {
        await fs.mkdir(baseDir, { recursive: true });
    } catch (_) {
        // Best effort only.
    }
    const ext = extensionForMimeType(parsed.mediaType, 'bin');
    const filePath = `${baseDir}/${Date.now()}-${index}.${ext}`;
    await fs.writeFile(filePath, parsed.base64, { encoding: 'base64' });
    return filePath;
}

/**
 * Creates enriched bash + readFile + writeFile tools for use when you have a shell and fs.
 * Registers "js" (and optionally "read-pdf") on the shell when opts.execInSandbox / opts.readPdf are provided.
 * @param {{ getCwd: () => string, exec: (cmd: string) => Promise<{ stdout: string, stderr: string, exitCode: number }>, registerCommand: (cmd: { name: string, run: (argv: string[], ctx: object) => Promise<{ stdout: string, stderr: string, exitCode: number }> }) => void }} shell
 * @param {{ readFile: (path: string, encoding?: string) => Promise<string>, writeFile: (path: string, content: string) => Promise<void>, mkdir: (path: string, opts?: { recursive?: boolean }) => Promise<void>, resolvePath: (cwd: string, path: string) => string }} fs
 * @param {{ execInSandbox?: (code: string, timeoutMs?: number) => Promise<{ output: string, hasError: boolean, images: Array<{ data: string, mediaType: string }> }>, readPdf?: (input: { query: string, url?: string, tabId?: number }) => Promise<object>, files?: string[], toolPrompt?: string, extraInstructions?: string }} [opts]
 * @returns {Array<{ name: string, description: string, parameters: object, execute: (args: object) => Promise<object> }>}
 */
export function createBashTools(shell, fs, opts: BashToolOptions = {}) {
    const cwd = shell.getCwd();
    const images = [];
    const consumePendingImages = () => {
        if (images.length === 0) return [];
        const pending = images.splice(0, images.length);
        return pending;
    };

    registerShellCommands({ shell, opts, images });

    const bashDescription = generateBashDescription(cwd, opts);
    const bashParams = z.object({
        command: z.string().describe('The bash command to execute'),
        description: z
            .string()
            .describe('What this command does in max 5 words (e.g., "Listing open browser tabs")'),
    });

    const readFileParams = z.object({ path: z.string().describe('The path to the file to read') });
    const writeFileParams = z.object({
        path: z.string().describe('The path where the file should be written'),
        content: z.string().describe('The content to write'),
    });
    const loadSkillParams = z.object({
        name: z.string().describe('The name of the skill to load (e.g., "flight-booking")'),
    });
    const saveSkillParams = z.object({
        name: z.string().describe('The skill name (folder-safe id, e.g., "flight-booking")'),
        description: z.string().describe('Short summary for the skill frontmatter'),
        content: z.string().describe('Skill body content (without frontmatter)'),
        scope: z.enum(['project', 'user']).optional().describe('Save scope: project or user'),
        overwrite: z.boolean().optional().describe('Overwrite existing skill if true'),
    });
    const discoverSkillsParams = z.object({});
    const fetchSkillParams = z.object({
        name: z.string().describe('The skill name to fetch (e.g., "flight-booking")'),
    });

    return [
        createTool({
            name: 'bash',
            description: bashDescription,
            parameters: bashParams,
            execute: async args => {
                try {
                    LOGGER.debug('[agent:tool:bash] executing command', {
                        command: args.command,
                    });
                    const res = await shell.exec(args.command);
                    const text = [
                        res.stdout ? `stdout:\n${res.stdout}` : '',
                        res.stderr ? `stderr:\n${res.stderr}` : '',
                        `exit code: ${res.exitCode}`,
                    ]
                        .filter(Boolean)
                        .join('\n\n');
                    const cappedText =
                        containsToolOutputCapNotice(text) &&
                        text.length <=
                            TOOL_OUTPUT_LIMITS.maxChars + TOOL_OUTPUT_LIMITS.existingCapSlackChars
                            ? text
                            : (await capToolOutput(text, 'bash', fs)).text;
                    console.log('[agent:tool:bash] cappedText', { cappedText });
                    const pendingImages = consumePendingImages();
                    const compressedImages = (
                        await Promise.all(
                            pendingImages.map(async (image, index) => {
                                try {
                                    const compressedImage = await compressImage(
                                        `data:${image.mediaType || 'image/png'};base64,${image.data}`,
                                        {
                                            scale: 0.7,
                                            quality: 0.8,
                                            format: 'image/jpeg',
                                        }
                                    );
                                    const filePath = await persistToolImageDataUrl(
                                        fs,
                                        compressedImage.dataUrl,
                                        args.conversationId,
                                        index
                                    ).catch(error => {
                                        LOGGER.warn('[agent:tool:bash] failed to persist screenshot', {
                                            conversationId: args.conversationId || null,
                                            message:
                                                error instanceof Error
                                                    ? error.message
                                                    : String(error),
                                        });
                                        return null;
                                    });
                                    return {
                                        type: 'image',
                                        dataUrl: compressedImage.dataUrl,
                                        mediaType: compressedImage.mimeType || 'image/jpeg',
                                        path: filePath,
                                        key: `bash-image-${Date.now()}-${index}`,
                                    };
                                } catch (error) {
                                    LOGGER.warn('[agent:tool:bash] failed to compress screenshot', {
                                        conversationId: args.conversationId || null,
                                        message:
                                            error instanceof Error ? error.message : String(error),
                                    });
                                    return null;
                                }
                            })
                        )
                    ).filter(Boolean);
                    if (pendingImages.length === 0) {
                        return {
                            kind: 'bash_result',
                            isError: false,
                            text: cappedText,
                            stdout: res.stdout || '',
                            stderr: res.stderr || '',
                            exitCode: res.exitCode,
                            images: [],
                            pendingImages: 0,
                        };
                    }
                    return {
                        kind: 'bash_result',
                        isError: false,
                        text: cappedText,
                        stdout: res.stdout || '',
                        stderr: res.stderr || '',
                        exitCode: res.exitCode,
                        images: compressedImages,
                        pendingImages: compressedImages.length,
                    };
                } catch (err) {
                    consumePendingImages();
                    const message = err instanceof Error ? err.message : String(err);
                    LOGGER.debug('[agent:tool:bash] command failed', { message });
                    return {
                        kind: 'bash_result',
                        isError: true,
                        text: `Error: ${message}`,
                        error: message,
                        images: [],
                        pendingImages: 0,
                    };
                }
            },
            toModelOutput: ({ toolCallId, output }) => {
                const toolOutput = {
                    type: 'content',
                    value: [
                        {
                            type: 'text',
                            text: output.text || output.output || output.content || '',
                        },
                        ...(output.images &&
                        Array.isArray(output.images) &&
                        output.images.length > 0
                            ? output.images.map(image => ({
                                  type: 'image-data',
                                  data: parseDataUrl(image.dataUrl)?.base64 || '',
                                  mediaType: image.mediaType,
                              }))
                            : []),
                    ] as ToolResultPart[],
                };
                LOGGER.debug('[agent:tool:bash] tool output', { toolCallId, toolOutput });
                return toolOutput;
            },
        }),
        createTool({
            name: 'readFile',
            description: 'Read the contents of a file from the sandbox.',
            parameters: readFileParams,
            execute: async args => {
                try {
                    const content = await fs.readFile(args.path, 'utf-8');
                    return {
                        kind: 'read_file_result',
                        isError: false,
                        path: args.path,
                        text: content,
                        content,
                    };
                } catch (err) {
                    const message = err instanceof Error ? err.message : String(err);
                    return {
                        kind: 'read_file_result',
                        isError: true,
                        path: args.path,
                        text: `Error reading file: ${message}`,
                        error: message,
                    };
                }
            },
        }),
        createTool({
            name: 'writeFile',
            description:
                'Write content to a file in the sandbox. Creates parent directories if needed.',
            parameters: writeFileParams,
            execute: async args => {
                try {
                    const parent = args.path.substring(0, args.path.lastIndexOf('/'));
                    if (parent) {
                        try {
                            await fs.mkdir(parent, { recursive: true });
                        } catch {
                            // best-effort
                        }
                    }
                    await fs.writeFile(args.path, args.content);
                    return {
                        kind: 'write_file_result',
                        isError: false,
                        path: args.path,
                        text: `Successfully wrote to ${args.path}`,
                    };
                } catch (err) {
                    const message = err instanceof Error ? err.message : String(err);
                    return {
                        kind: 'write_file_result',
                        isError: true,
                        path: args.path,
                        text: `Error writing file: ${message}`,
                        error: message,
                    };
                }
            },
        }),
        createTool({
            name: 'loadSkill',
            description:
                "Load a skill to gain its specialized capabilities. Use this when the task matches a skill's description from the <available_skills> list. Returns the skill instructions and its working directory path.",
            parameters: loadSkillParams,
            execute: async args => {
                const requestedName = args?.name?.trim();
                if (!requestedName) {
                    return {
                        kind: 'load_skill_result',
                        isError: true,
                        skillName: null,
                        text: 'Error: Skill name is required.',
                        error: 'Skill name is required.',
                    };
                }

                const candidatePaths = SKILL_PATH_TEMPLATES.map(template =>
                    template.replace('{name}', requestedName)
                );

                for (const skillPath of candidatePaths) {
                    try {
                        const content = await fs.readFile(skillPath, 'utf-8');
                        const workingDirectory = skillPath.replace(/\/SKILL\.md$/, '');
                        return {
                            kind: 'load_skill_result',
                            isError: false,
                            skillName: requestedName,
                            workingDirectory,
                            content,
                            text: `# Skill Loaded: ${requestedName}\nWorking Directory: ${workingDirectory}\n\n${content}`,
                        };
                    } catch (_) {
                        // Try next candidate path.
                    }
                }

                return {
                    kind: 'load_skill_result',
                    isError: true,
                    skillName: requestedName,
                    text: `Error loading skill "${requestedName}": Skill not found in workspace skills.`,
                    error: 'Skill not found',
                };
            },
        }),
        createTool({
            name: 'saveSkill',
            description:
                'Save a skill as /workspace/skills/custom-skills/<name>/SKILL.md (or /workspace/.cursor/skills for user scope).',
            parameters: saveSkillParams,
            execute: async args => {
                const result = await saveSkillToFs(fs, {
                    name: args?.name,
                    description: args?.description,
                    content: args?.content,
                    scope: args?.scope,
                    overwrite: args?.overwrite,
                });
                if (!result.ok) {
                    return {
                        kind: 'save_skill_result',
                        isError: true,
                        skillName: args?.name || null,
                        text: `Error saving skill: ${result.error}`,
                        error: result.error,
                    };
                }
                return {
                    kind: 'save_skill_result',
                    isError: false,
                    skillName: args?.name,
                    scope: result.scope,
                    path: result.skillPath,
                    text: `Saved skill "${args?.name}" to ${result.skillPath}`,
                };
            },
        }),
        createTool({
            name: 'discoverSkills',
            description: 'Discover available skills stored under the workspace skills directories.',
            parameters: discoverSkillsParams,
            execute: async () => {
                try {
                    const skills = await discoverSkills();
                    return {
                        kind: 'discover_skills_result',
                        isError: false,
                        skills,
                        text: skills.length
                            ? `Discovered ${skills.length} skills.`
                            : 'No skills discovered.',
                    };
                } catch (err) {
                    const message = err instanceof Error ? err.message : String(err);
                    return {
                        kind: 'discover_skills_result',
                        isError: true,
                        skills: [],
                        text: `Error discovering skills: ${message}`,
                        error: message,
                    };
                }
            },
        }),
        createTool({
            name: 'fetchSkill',
            description: 'Fetch a specific skill by name, returning its metadata and content.',
            parameters: fetchSkillParams,
            execute: async args => {
                const requestedName = args?.name?.trim();
                if (!requestedName) {
                    return {
                        kind: 'fetch_skill_result',
                        isError: true,
                        skillName: null,
                        text: 'Error: Skill name is required.',
                        error: 'Skill name is required.',
                    };
                }
                const skill = await fetchSkillByName(requestedName);
                if (!skill) {
                    return {
                        kind: 'fetch_skill_result',
                        isError: true,
                        skillName: requestedName,
                        text: `Error fetching skill "${requestedName}": Skill not found.`,
                        error: 'Skill not found',
                    };
                }
                return {
                    kind: 'fetch_skill_result',
                    isError: false,
                    skillName: skill.name,
                    skill,
                    text: `Fetched skill "${skill.name}" from ${skill.skillMdPath}`,
                };
            },
        }),
    ];
}

export const sharedTools = [];
