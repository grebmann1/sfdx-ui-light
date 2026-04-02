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
        writeFile?: (path: string, content: string, options?: { encoding?: string }) => Promise<void>;
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
        const shouldOpenUi = !Boolean(getFlagValue(flags, 'no-ui'));
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
        const method = String(ensureSingleValue(getFlagValue(flags, 'method', 'X')) || 'GET').toUpperCase();
        const endpoint = ensureSingleValue(getFlagValue(flags, 'url', 'endpoint', 'u')) || '';
        const bodyFlag = ensureSingleValue(getFlagValue(flags, 'body'));
        const headerValues = collectFlagArray(getFlagValue(flags, 'header', 'H'))
            .map((value) => String(value))
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

    const sfCommand = createCommand('sf', async (argv, ctx) => {
        if (!argv?.length || argv.includes('--help') || argv.includes('-h')) {
            const help = [
                'SF CLI shims (minimal):',
                '',
                '  sf apex run',
                '  sf data query',
                '  sf api request',
                '  sf org list',
                '  sf org open',
                '',
                'Use subcommand --help for details.',
                '',
                APEX_HELP,
                '',
                SOQL_HELP,
                '',
                API_HELP,
                '',
                ORG_HELP,
            ].join('\n');
            return { stdout: help, stderr: '', exitCode: 0 };
        }
        const [group, action, ...rest] = argv;
        if (group === 'apex' && action === 'run') {
            return runApexCli(rest, ctx);
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
        return {
            stdout: '',
            stderr: `Error: Unknown sf command "${argv.join(' ')}"\n`,
            exitCode: 1,
        };
    });

    shell.registerCommand(sfCommand);
}
