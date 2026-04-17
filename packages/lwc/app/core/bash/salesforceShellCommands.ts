export type ShellCommandResult = {
    stdout: string;
    stderr: string;
    exitCode: number;
};

export type ShellCommandContext = {
    cwd: string;
    stdin?: string;
    fs: {
        resolvePath: (cwd: string, path: string) => string;
        readFile: (path: string, encoding?: string) => Promise<string>;
        writeFile?: (
            path: string,
            content: string,
            options?: { encoding?: string }
        ) => Promise<void>;
        mkdir?: (path: string, opts?: { recursive?: boolean }) => Promise<void>;
        exists: (path: string) => Promise<boolean>;
    };
};

type ShellLike = {
    registerCommand: (cmd: {
        name: string;
        execute: (argv: string[], ctx: ShellCommandContext) => Promise<ShellCommandResult>;
    }) => void;
};

type SalesforceCommandExecution =
    | unknown
    | {
          result?: unknown;
          exitCode?: number;
      };

type SalesforceShellHandlers = {
    executeApex: (args: {
        apexCode: string;
        shouldOpenUi: boolean;
        sourceFilePath: string | null;
        ctx: ShellCommandContext;
    }) => Promise<SalesforceCommandExecution>;
    executeSoql: (args: {
        query: string;
        useToolingApi: boolean;
        includeDeletedRecords: boolean;
        ctx: ShellCommandContext;
    }) => Promise<SalesforceCommandExecution>;
    executeApi: (args: {
        method: string;
        endpoint: string;
        body: string;
        headerValues: string[];
        headerText: string;
        bodyFilePath: string | null;
        ctx: ShellCommandContext;
    }) => Promise<SalesforceCommandExecution>;
    listOrgs: () => Promise<SalesforceCommandExecution>;
    openOrg: (args: { alias: string }) => Promise<SalesforceCommandExecution>;
    runApexTests: (args: {
        classNames: string[];
        testLevel: string;
        timeoutMs: number;
        ctx: ShellCommandContext;
    }) => Promise<SalesforceCommandExecution>;
    enableDebugLog: (args: { durationMinutes: number }) => Promise<SalesforceCommandExecution>;
    listDebugLogs: (args: { limit: number }) => Promise<SalesforceCommandExecution>;
    getDebugLog: (args: {
        logId: string;
        outputPath: string | null;
        ctx: ShellCommandContext;
    }) => Promise<SalesforceCommandExecution>;
    displayLimits: () => Promise<SalesforceCommandExecution>;
    describeSObject: (args: { objectName: string }) => Promise<SalesforceCommandExecution>;
    deployMetadata: (args: {
        filePath: string;
        metadataType: string | null;
        apiName: string | null;
        ctx: ShellCommandContext;
    }) => Promise<SalesforceCommandExecution>;
    retrieveMetadata: (args: {
        metadataType: string;
        apiName: string;
        outputPath: string | null;
        ctx: ShellCommandContext;
    }) => Promise<SalesforceCommandExecution>;
};

export const APEX_HELP = `Run anonymous Apex (SF CLI shim).

Usage:
  sf apex run --apex-code '<code>'
  sf apex run --file <path>
  sf apex run --help

Notes:
  - Uses the Apex Editor execution path (same as the Apex tools).
  - By default, opens the Anonymous Apex UI. Use --no-ui to skip it.
  - Either --apex-code or --file is required.`;

export const SOQL_HELP = `Run a SOQL query (SF CLI shim).

Usage:
  sf data query --query "<soql>"
  sf data query --query "<soql>" --tooling
  sf data query --query "<soql>" --all-rows
  sf data query --help
`;

export const API_HELP = `Send a REST API request (SF CLI shim).

Usage:
  sf api request --method GET --url "<endpoint>"
  sf api request --method POST --url "<endpoint>" --body '<json>'
  sf api request --method POST --url "<endpoint>" --body @<file>
  sf api request --header "Key: Value" --header "Key2: Value2"
  sf api request --help

Notes:
  - Endpoint can be relative (e.g. /services/data/vXX.X/...) or absolute.
  - Headers can be repeated.`;

export const ORG_HELP = `List or open Salesforce orgs (SF CLI shim).

Usage:
  sf org list
  sf org open --target-org <alias>
  sf org open -o <alias>
  sf org open -u <alias>
  sf org open --help

Notes:
  - Alias is required for org open.`;

export const APEX_TEST_HELP = `Run Apex tests (SF CLI shim).

Usage:
  sf apex test run --class-names "MyTestClass,AnotherTest"
  sf apex test run --class-names "MyTestClass" --test-level RunSpecifiedTests
  sf apex test run --test-level RunLocalTests
  sf apex test run --timeout 120000
  sf apex test run --help

Options:
  --class-names, -n   Comma-separated list of test class names (required unless test-level is RunLocalTests/RunAllTestsInOrg)
  --test-level        RunSpecifiedTests | RunLocalTests | RunAllTestsInOrg (default: RunSpecifiedTests)
  --timeout           Max wait time in ms (default: 60000)`;

export const DEBUG_LOG_HELP = `Manage Salesforce debug logs (SF CLI shim).

Usage:
  sf debug log enable
  sf debug log enable --duration 30
  sf debug log list
  sf debug log list --limit 10
  sf debug log get <id>
  sf debug log get <id> --output /workspace/debug.log
  sf debug log --help

Subcommands:
  enable    Create or refresh a TraceFlag so debug logs are captured (default: 15 min)
  list      List recent ApexLog records
  get       Download a specific log body by ID`;

export const LIMITS_HELP = `Display API limits for the connected org (SF CLI shim).

Usage:
  sf limits display
  sf limits display --help`;

export const SOBJECT_HELP = `Describe a Salesforce SObject's fields and metadata (SF CLI shim).

Usage:
  sf sobject describe --object Account
  sf sobject describe -o Contact
  sf sobject describe --object MyCustomObject__c
  sf sobject describe --help

Options:
  --object, -o    SObject API name (required)`;

export const METADATA_HELP = `Deploy or retrieve Salesforce metadata (SF CLI shim).

Usage:
  sf metadata deploy --file /workspace/MyClass.cls
  sf metadata deploy --file /workspace/MyTrigger.trigger
  sf metadata deploy --file /workspace/MyPage.page
  sf metadata retrieve --metadata-type ApexClass --api-name MyClass
  sf metadata retrieve --metadata-type ApexClass --api-name MyClass --output /workspace/retrieved
  sf metadata --help

Supported Tooling API types for deploy/retrieve:
  ApexClass, ApexTrigger, ApexPage, ApexComponent, StaticResource

Options:
  deploy:
    --file, -f          Path to metadata file in /workspace (required)
    --metadata-type     Override auto-detected type
    --api-name          Override auto-detected API name
  retrieve:
    --metadata-type     Metadata type (required)
    --api-name          API name of the record to retrieve (required)
    --output            Output directory (default: /workspace)`;

function createCommand(
    name: string,
    execute: (argv: string[], ctx: ShellCommandContext) => Promise<ShellCommandResult>
) {
    return { name, execute };
}

export function formatCliOutput(value: unknown) {
    if (value == null) return '';
    if (typeof value === 'string') return value;
    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return String(value);
    }
}

export function parseCliArgs(argv: string[]) {
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
        'target-org',
        'o',
        'n',
        'class-names',
        'test-level',
        'timeout',
        'duration',
        'limit',
        'output',
        'metadata-type',
        'm',
        'api-name',
        'object',
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

export function getFlagValue(flags: Map<string, string | boolean | string[]>, ...names: string[]) {
    for (const name of names) {
        if (flags.has(name)) return flags.get(name);
    }
    return undefined;
}

export function ensureSingleValue(value: string | boolean | string[] | undefined) {
    if (Array.isArray(value)) return value[value.length - 1];
    return value;
}

export function collectFlagArray(value: string | boolean | string[] | undefined) {
    if (value == null) return [];
    return Array.isArray(value) ? value : [value];
}

export async function resolveCliFileContent(filePath: string, ctx: ShellCommandContext) {
    const resolvedPath = ctx.fs.resolvePath(ctx.cwd, filePath);
    try {
        const content = await ctx.fs.readFile(resolvedPath, 'utf-8');
        return { content, resolvedPath };
    } catch {
        return { content: null, resolvedPath };
    }
}

function normalizeHandlerResult(value: SalesforceCommandExecution) {
    if (
        value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        (Object.prototype.hasOwnProperty.call(value, 'result') ||
            Object.prototype.hasOwnProperty.call(value, 'exitCode'))
    ) {
        const typed = value as { result?: unknown; exitCode?: number };
        return {
            result: typed.result,
            exitCode: Number.isFinite(typed.exitCode) ? Number(typed.exitCode) : 0,
        };
    }
    return { result: value, exitCode: 0 };
}

function commandError(message: string) {
    return {
        stdout: '',
        stderr: `Error: ${message}\n`,
        exitCode: 1,
    };
}

export function getApexExecutionExitCode(result: unknown) {
    if (!result || typeof result !== 'object') return 0;
    const maybe = result as {
        compiled?: boolean;
        success?: boolean;
        compileProblem?: string;
        exceptionMessage?: string;
        error?: unknown;
    };
    if (maybe.compileProblem || maybe.exceptionMessage || maybe.error) return 1;
    if (typeof maybe.compiled === 'boolean' && !maybe.compiled) return 1;
    if (typeof maybe.success === 'boolean' && !maybe.success) return 1;
    return 0;
}

const TOOLING_API_TYPES: Record<string, string> = {
    '.cls': 'ApexClass',
    '.trigger': 'ApexTrigger',
    '.page': 'ApexPage',
    '.component': 'ApexComponent',
    '.resource': 'StaticResource',
};

export function detectMetadataType(filePath: string): { type: string | null; apiName: string } {
    const basename = filePath.split('/').pop() || filePath;
    const lastDot = basename.lastIndexOf('.');
    if (lastDot === -1) return { type: null, apiName: basename };
    const ext = basename.slice(lastDot);
    const nameOnly = basename.slice(0, lastDot);
    // Strip -meta.xml suffix if present
    const apiName = nameOnly.endsWith('-meta') ? nameOnly.slice(0, -5) : nameOnly;
    return { type: TOOLING_API_TYPES[ext] ?? null, apiName };
}

export function registerSalesforceShellCommands({
    shell,
    handlers,
}: {
    shell: ShellLike;
    handlers: SalesforceShellHandlers;
}) {
    const runApexCli = async (argv: string[], ctx: ShellCommandContext) => {
        if (argv.includes('--help') || argv.includes('-h')) {
            return { stdout: APEX_HELP, stderr: '', exitCode: 0 };
        }
        const { flags } = parseCliArgs(argv);
        const fileFlag = ensureSingleValue(getFlagValue(flags, 'file', 'f'));
        const codeFlag = ensureSingleValue(getFlagValue(flags, 'apex-code', 'c'));
        const shouldOpenUi = !getFlagValue(flags, 'no-ui');
        let apexCode = typeof codeFlag === 'string' ? codeFlag : '';
        let sourceFilePath: string | null = null;
        if (!apexCode && typeof fileFlag === 'string') {
            const fileResult = await resolveCliFileContent(fileFlag, ctx);
            if (!fileResult.content) {
                return {
                    stdout: '',
                    stderr: `Error: Cannot read file: ${fileResult.resolvedPath}\n`,
                    exitCode: 1,
                };
            }
            apexCode = fileResult.content;
            sourceFilePath = fileResult.resolvedPath;
        }
        if (!apexCode) {
            return {
                stdout: '',
                stderr: `Error: Missing Apex code. Use --apex-code or --file.\n\n${APEX_HELP}\n`,
                exitCode: 1,
            };
        }

        try {
            const handled = normalizeHandlerResult(
                await handlers.executeApex({
                    apexCode,
                    shouldOpenUi,
                    sourceFilePath,
                    ctx,
                })
            );
            return {
                stdout: formatCliOutput(handled.result),
                stderr: '',
                exitCode: handled.exitCode,
            };
        } catch (err) {
            return commandError(err instanceof Error ? err.message : String(err));
        }
    };

    const runSoqlCli = async (argv: string[], ctx: ShellCommandContext) => {
        if (argv.includes('--help') || argv.includes('-h')) {
            return { stdout: SOQL_HELP, stderr: '', exitCode: 0 };
        }
        const { flags } = parseCliArgs(argv);
        const query = ensureSingleValue(getFlagValue(flags, 'query', 'q'));
        if (!query || typeof query !== 'string') {
            return {
                stdout: '',
                stderr: `Error: Missing SOQL query. Use --query.\n\n${SOQL_HELP}\n`,
                exitCode: 1,
            };
        }
        const useToolingApi = Boolean(getFlagValue(flags, 'tooling'));
        const includeDeletedRecords = Boolean(getFlagValue(flags, 'all-rows'));
        try {
            const handled = normalizeHandlerResult(
                await handlers.executeSoql({
                    query,
                    useToolingApi,
                    includeDeletedRecords,
                    ctx,
                })
            );
            return {
                stdout: formatCliOutput(handled.result),
                stderr: '',
                exitCode: handled.exitCode,
            };
        } catch (err) {
            return commandError(err instanceof Error ? err.message : String(err));
        }
    };

    const runApiCli = async (argv: string[], ctx: ShellCommandContext) => {
        if (argv.includes('--help') || argv.includes('-h')) {
            return { stdout: API_HELP, stderr: '', exitCode: 0 };
        }
        const { flags } = parseCliArgs(argv);
        const method = String(
            ensureSingleValue(getFlagValue(flags, 'method', 'X')) || 'GET'
        ).toUpperCase();
        const endpoint = ensureSingleValue(getFlagValue(flags, 'url', 'endpoint', 'u')) || '';
        const bodyFlag = ensureSingleValue(getFlagValue(flags, 'body'));
        const headerValues = collectFlagArray(getFlagValue(flags, 'header', 'H'))
            .map(value => String(value))
            .filter(Boolean);

        if (!endpoint || typeof endpoint !== 'string') {
            return {
                stdout: '',
                stderr: `Error: Missing request URL. Use --url.\n\n${API_HELP}\n`,
                exitCode: 1,
            };
        }

        let body = typeof bodyFlag === 'string' ? bodyFlag : '';
        let bodyFilePath: string | null = null;
        if (body && body.startsWith('@')) {
            const fileResult = await resolveCliFileContent(body.slice(1), ctx);
            if (!fileResult.content) {
                return {
                    stdout: '',
                    stderr: `Error: Cannot read file: ${fileResult.resolvedPath}\n`,
                    exitCode: 1,
                };
            }
            body = fileResult.content;
            bodyFilePath = fileResult.resolvedPath;
        }

        const headerText = headerValues.join('\n');

        try {
            const handled = normalizeHandlerResult(
                await handlers.executeApi({
                    method,
                    endpoint: String(endpoint),
                    body,
                    headerValues,
                    headerText,
                    bodyFilePath,
                    ctx,
                })
            );
            return {
                stdout: formatCliOutput(handled.result),
                stderr: '',
                exitCode: handled.exitCode,
            };
        } catch (err) {
            return commandError(err instanceof Error ? err.message : String(err));
        }
    };

    const runOrgListCli = async () => {
        try {
            const handled = normalizeHandlerResult(await handlers.listOrgs());
            return {
                stdout: formatCliOutput(handled.result),
                stderr: '',
                exitCode: handled.exitCode,
            };
        } catch (err) {
            return commandError(err instanceof Error ? err.message : String(err));
        }
    };

    const runOrgOpenCli = async (argv: string[]) => {
        if (argv.includes('--help') || argv.includes('-h')) {
            return { stdout: ORG_HELP, stderr: '', exitCode: 0 };
        }
        const { flags } = parseCliArgs(argv);
        const alias = ensureSingleValue(getFlagValue(flags, 'target-org', 'o', 'u'));
        if (!alias || typeof alias !== 'string') {
            return {
                stdout: '',
                stderr: `Error: Missing org alias. Use --target-org.\n\n${ORG_HELP}\n`,
                exitCode: 1,
            };
        }
        try {
            const handled = normalizeHandlerResult(await handlers.openOrg({ alias }));
            return {
                stdout: formatCliOutput(handled.result),
                stderr: '',
                exitCode: handled.exitCode,
            };
        } catch (err) {
            return commandError(err instanceof Error ? err.message : String(err));
        }
    };

    const runApexTestCli = async (argv: string[], ctx: ShellCommandContext) => {
        if (argv.includes('--help') || argv.includes('-h')) {
            return { stdout: APEX_TEST_HELP, stderr: '', exitCode: 0 };
        }
        const { flags } = parseCliArgs(argv);
        const classNamesFlag = ensureSingleValue(getFlagValue(flags, 'class-names', 'n'));
        const testLevel = String(
            ensureSingleValue(getFlagValue(flags, 'test-level')) || 'RunSpecifiedTests'
        );
        const timeoutFlag = ensureSingleValue(getFlagValue(flags, 'timeout'));
        const timeoutMs = typeof timeoutFlag === 'string' ? parseInt(timeoutFlag, 10) : 60000;

        const classNames =
            typeof classNamesFlag === 'string'
                ? classNamesFlag
                      .split(',')
                      .map(s => s.trim())
                      .filter(Boolean)
                : [];

        if (classNames.length === 0 && testLevel === 'RunSpecifiedTests') {
            return {
                stdout: '',
                stderr: `Error: --class-names is required when test-level is RunSpecifiedTests.\n\n${APEX_TEST_HELP}\n`,
                exitCode: 1,
            };
        }
        try {
            const handled = normalizeHandlerResult(
                await handlers.runApexTests({ classNames, testLevel, timeoutMs, ctx })
            );
            return {
                stdout: formatCliOutput(handled.result),
                stderr: '',
                exitCode: handled.exitCode,
            };
        } catch (err) {
            return commandError(err instanceof Error ? err.message : String(err));
        }
    };

    const runDebugLogCli = async (argv: string[], ctx: ShellCommandContext) => {
        if (!argv?.length || argv.includes('--help') || argv.includes('-h')) {
            return { stdout: DEBUG_LOG_HELP, stderr: '', exitCode: 0 };
        }
        const [subcommand, ...rest] = argv;

        if (subcommand === 'enable') {
            const { flags } = parseCliArgs(rest);
            const durationFlag = ensureSingleValue(getFlagValue(flags, 'duration'));
            const durationMinutes =
                typeof durationFlag === 'string' ? parseInt(durationFlag, 10) : 15;
            try {
                const handled = normalizeHandlerResult(
                    await handlers.enableDebugLog({ durationMinutes })
                );
                return {
                    stdout: formatCliOutput(handled.result),
                    stderr: '',
                    exitCode: handled.exitCode,
                };
            } catch (err) {
                return commandError(err instanceof Error ? err.message : String(err));
            }
        }

        if (subcommand === 'list') {
            const { flags } = parseCliArgs(rest);
            const limitFlag = ensureSingleValue(getFlagValue(flags, 'limit'));
            const limit = typeof limitFlag === 'string' ? parseInt(limitFlag, 10) : 25;
            try {
                const handled = normalizeHandlerResult(await handlers.listDebugLogs({ limit }));
                return {
                    stdout: formatCliOutput(handled.result),
                    stderr: '',
                    exitCode: handled.exitCode,
                };
            } catch (err) {
                return commandError(err instanceof Error ? err.message : String(err));
            }
        }

        if (subcommand === 'get') {
            const { flags, positionals } = parseCliArgs(rest);
            const logId =
                positionals[0] || String(ensureSingleValue(getFlagValue(flags, 'id')) || '');
            const outputFlag = ensureSingleValue(getFlagValue(flags, 'output', 'o'));
            const outputPath = typeof outputFlag === 'string' ? outputFlag : null;
            if (!logId) {
                return {
                    stdout: '',
                    stderr: `Error: Missing log ID.\nUsage: sf debug log get <id>\n`,
                    exitCode: 1,
                };
            }
            try {
                const handled = normalizeHandlerResult(
                    await handlers.getDebugLog({ logId, outputPath, ctx })
                );
                return {
                    stdout: formatCliOutput(handled.result),
                    stderr: '',
                    exitCode: handled.exitCode,
                };
            } catch (err) {
                return commandError(err instanceof Error ? err.message : String(err));
            }
        }

        return {
            stdout: '',
            stderr: `Error: Unknown debug log subcommand "${subcommand}"\n\n${DEBUG_LOG_HELP}\n`,
            exitCode: 1,
        };
    };

    const runLimitsDisplayCli = async (argv: string[]) => {
        if (argv.includes('--help') || argv.includes('-h')) {
            return { stdout: LIMITS_HELP, stderr: '', exitCode: 0 };
        }
        try {
            const handled = normalizeHandlerResult(await handlers.displayLimits());
            return {
                stdout: formatCliOutput(handled.result),
                stderr: '',
                exitCode: handled.exitCode,
            };
        } catch (err) {
            return commandError(err instanceof Error ? err.message : String(err));
        }
    };

    const runSObjectDescribeCli = async (argv: string[]) => {
        if (argv.includes('--help') || argv.includes('-h')) {
            return { stdout: SOBJECT_HELP, stderr: '', exitCode: 0 };
        }
        const { flags, positionals } = parseCliArgs(argv);
        const objectName = String(
            ensureSingleValue(getFlagValue(flags, 'object', 'o')) || positionals[0] || ''
        ).trim();
        if (!objectName) {
            return {
                stdout: '',
                stderr: `Error: Missing SObject name. Use --object.\n\n${SOBJECT_HELP}\n`,
                exitCode: 1,
            };
        }
        try {
            const handled = normalizeHandlerResult(await handlers.describeSObject({ objectName }));
            return {
                stdout: formatCliOutput(handled.result),
                stderr: '',
                exitCode: handled.exitCode,
            };
        } catch (err) {
            return commandError(err instanceof Error ? err.message : String(err));
        }
    };

    const runMetadataCli = async (argv: string[], ctx: ShellCommandContext) => {
        if (!argv?.length || argv.includes('--help') || argv.includes('-h')) {
            return { stdout: METADATA_HELP, stderr: '', exitCode: 0 };
        }
        const [subcommand, ...rest] = argv;

        if (subcommand === 'deploy') {
            const { flags } = parseCliArgs(rest);
            const fileFlag = ensureSingleValue(getFlagValue(flags, 'file', 'f'));
            const metadataTypeFlag = ensureSingleValue(getFlagValue(flags, 'metadata-type', 'm'));
            const apiNameFlag = ensureSingleValue(getFlagValue(flags, 'api-name'));
            if (!fileFlag || typeof fileFlag !== 'string') {
                return {
                    stdout: '',
                    stderr: `Error: Missing --file flag.\n\n${METADATA_HELP}\n`,
                    exitCode: 1,
                };
            }
            const metadataType = typeof metadataTypeFlag === 'string' ? metadataTypeFlag : null;
            const apiName = typeof apiNameFlag === 'string' ? apiNameFlag : null;
            try {
                const handled = normalizeHandlerResult(
                    await handlers.deployMetadata({
                        filePath: fileFlag,
                        metadataType,
                        apiName,
                        ctx,
                    })
                );
                return {
                    stdout: formatCliOutput(handled.result),
                    stderr: '',
                    exitCode: handled.exitCode,
                };
            } catch (err) {
                return commandError(err instanceof Error ? err.message : String(err));
            }
        }

        if (subcommand === 'retrieve') {
            const { flags } = parseCliArgs(rest);
            const metadataTypeFlag = ensureSingleValue(getFlagValue(flags, 'metadata-type', 'm'));
            const apiNameFlag = ensureSingleValue(getFlagValue(flags, 'api-name'));
            const outputFlag = ensureSingleValue(getFlagValue(flags, 'output', 'o'));
            if (!metadataTypeFlag || typeof metadataTypeFlag !== 'string') {
                return {
                    stdout: '',
                    stderr: `Error: Missing --metadata-type flag.\n\n${METADATA_HELP}\n`,
                    exitCode: 1,
                };
            }
            if (!apiNameFlag || typeof apiNameFlag !== 'string') {
                return {
                    stdout: '',
                    stderr: `Error: Missing --api-name flag.\n\n${METADATA_HELP}\n`,
                    exitCode: 1,
                };
            }
            const outputPath = typeof outputFlag === 'string' ? outputFlag : null;
            try {
                const handled = normalizeHandlerResult(
                    await handlers.retrieveMetadata({
                        metadataType: metadataTypeFlag,
                        apiName: apiNameFlag,
                        outputPath,
                        ctx,
                    })
                );
                return {
                    stdout: formatCliOutput(handled.result),
                    stderr: '',
                    exitCode: handled.exitCode,
                };
            } catch (err) {
                return commandError(err instanceof Error ? err.message : String(err));
            }
        }

        return {
            stdout: '',
            stderr: `Error: Unknown metadata subcommand "${subcommand}"\n\n${METADATA_HELP}\n`,
            exitCode: 1,
        };
    };

    const sfCommand = createCommand('sf', async (argv, ctx) => {
        if (!argv?.length || argv.includes('--help') || argv.includes('-h')) {
            const help = [
                'SF CLI shims:',
                '',
                '  sf apex run',
                '  sf apex test run',
                '  sf data query',
                '  sf api request',
                '  sf org list',
                '  sf org open',
                '  sf debug log enable|list|get',
                '  sf limits display',
                '  sf sobject describe',
                '  sf metadata deploy|retrieve',
                '',
                'Use subcommand --help for details.',
                '',
                APEX_HELP,
                '',
                APEX_TEST_HELP,
                '',
                SOQL_HELP,
                '',
                API_HELP,
                '',
                ORG_HELP,
                '',
                DEBUG_LOG_HELP,
                '',
                LIMITS_HELP,
                '',
                SOBJECT_HELP,
                '',
                METADATA_HELP,
            ].join('\n');
            return { stdout: help, stderr: '', exitCode: 0 };
        }
        const [group, action, ...rest] = argv;
        if (group === 'apex' && action === 'run') {
            return runApexCli(rest, ctx);
        }
        if (group === 'apex' && action === 'test') {
            return runApexTestCli(rest, ctx);
        }
        if (group === 'data' && action === 'query') {
            return runSoqlCli(rest, ctx);
        }
        if (group === 'api' && action === 'request') {
            return runApiCli(rest, ctx);
        }
        if (group === 'org' && action === 'list') {
            return runOrgListCli();
        }
        if (group === 'org' && action === 'open') {
            return runOrgOpenCli(rest);
        }
        if (group === 'debug' && action === 'log') {
            return runDebugLogCli(rest, ctx);
        }
        if (group === 'limits' && action === 'display') {
            return runLimitsDisplayCli(rest);
        }
        if (group === 'sobject' && action === 'describe') {
            return runSObjectDescribeCli(rest);
        }
        if (group === 'metadata' && (action === 'deploy' || action === 'retrieve')) {
            return runMetadataCli([action, ...rest], ctx);
        }
        return {
            stdout: '',
            stderr: `Error: Unknown sf command "${argv.join(' ')}"\n`,
            exitCode: 1,
        };
    });

    shell.registerCommand(sfCommand);
}
