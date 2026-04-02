import LOGGER from 'shared/logger';
import { API as API_UTILS } from 'shared/utils';
import {
    APEX_HELP,
    API_HELP,
    getApexExecutionExitCode,
    ORG_HELP,
    registerSalesforceShellCommands,
    SOQL_HELP,
} from 'core/bash';
import { store, APEX, API, QUERY, ERROR } from 'core/store';
import {
    getConfiguration,
    getPublicConfigurations,
    credentialStrategies,
    OAUTH_TYPES,
} from 'core/connector';
import type { ConnectorLike } from 'core/connector';
import { waitForLoaded, wrappedNavigate, formatTabId, openBrowser } from './utils/utils';
import { saveSkillToFs } from './skillUtils';
import type { ShellCommandContext } from 'core/bash';

export type BashToolOptions = {
    execInSandbox?: (
        code: string,
        timeoutMs?: number
    ) => Promise<{ output: string; hasError: boolean; images?: Array<{ data: string; mediaType: string }> }>;
    readPdf?: (input: { query: string; url?: string; tabId?: number }) => Promise<object>;
    files?: string[];
    toolPrompt?: string;
    extraInstructions?: string;
};

const JS_HELP = `Execute JavaScript in the sandbox with Puppeteer browser automation and filesystem access.
Use 'return' to get a result back.

Usage:
  js -e '<code>'              Inline code (like node -e)
  js <file>                    Run a script file from the filesystem
  js --timeout 30000 -e '...'  Custom timeout (default: 10000ms)
  js --help                    Show this help

Available globals: connectToPage(tabId), getSnapshot(page), getElementByRef(page, ref), clearInput(handle),
readFile(path), writeFile(path), listFiles(path), bash(command), logImage(base64), workspace.status(), etc.`;

const SAVE_SKILL_HELP = `Save a skill to the workspace.

Usage:
  save-skill --name <name> --description "<desc>" --content "<body>"
  save-skill --name <name> --description "<desc>" --file <path>
  save-skill --name <name> --description "<desc>" --content @<path>
  save-skill --name <name> --description "<desc>" --file <path> --scope user --overwrite

Notes:
  - name must be letters, numbers, hyphens, or underscores.
  - content is the SKILL.md body (frontmatter is added automatically).
  - scope defaults to project (saved under /workspace/skills).`;

export function generateBashDescription(cwd: string, opts?: BashToolOptions) {
    const lines = [
        'Execute bash commands in the sandbox environment.',
        '',
        `Working directory: ${cwd}`,
        'Use relative paths from here.',
        '',
    ];
    if (opts?.files?.length) {
        const preview = opts.files.slice(0, 8);
        lines.push('Available files:');
        for (const file of preview) lines.push(`  ${file}`);
        if (opts.files.length > 8) lines.push(`  ... and ${opts.files.length - 8} more files`);
        lines.push('');
    }
    if (opts?.toolPrompt) {
        lines.push(opts.toolPrompt);
        lines.push('');
    }
    lines.push(
        "Custom commands: js -e '<code>', js <file>, open <file>, save-skill, sf apex run, sf data query, sf api request, sf org list, sf org open"
    );
    lines.push('');
    if (opts?.extraInstructions) {
        lines.push(opts.extraInstructions);
        lines.push('');
    }
    lines.push('SF CLI shims help:');
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

function collectFlagArray(value: string | boolean | string[] | undefined) {
    if (value == null) return [];
    return Array.isArray(value) ? value : [value];
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
                return { stdout: JS_HELP, stderr: '', exitCode: 0 };
            }
            const parsed = parseJsArgs(argv);
            if (parsed.error) return parsed.error;

            const codeResult = await loadJsCode(parsed.argsWithoutFlags, ctx);
            if (codeResult.error) return codeResult.error;

            try {
                const res = await execInSandbox(codeResult.code, parsed.timeoutMs);
                if (res.images?.length) images.push(...res.images);
                return { stdout: res.output ?? '', stderr: '', exitCode: res.hasError ? 1 : 0 };
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
            return { stdout: SAVE_SKILL_HELP, stderr: '', exitCode: 0 };
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
                stderr: `Error: Missing skill name. Use --name.\n\n${SAVE_SKILL_HELP}\n`,
                exitCode: 1,
            };
        }
        if (!description || typeof description !== 'string') {
            return {
                stdout: '',
                stderr: `Error: Missing description. Use --description.\n\n${SAVE_SKILL_HELP}\n`,
                exitCode: 1,
            };
        }
        if (!content || typeof content !== 'string') {
            return {
                stdout: '',
                stderr: `Error: Missing content. Use --content or --file.\n\n${SAVE_SKILL_HELP}\n`,
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
                stderr: `Error: Invalid scope "${scopeFlag}". Use "project" or "user".\n\n${SAVE_SKILL_HELP}\n`,
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
        },
    });
}
