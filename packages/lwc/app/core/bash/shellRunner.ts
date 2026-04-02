export type ShellRunnerResult = {
    command: string;
    cwd: string;
    stdout: string;
    stderr: string;
    exitCode: number;
};

type BashLike = {
    exec: (command: string) => Promise<{ stdout: string; stderr: string; exitCode: number }>;
    getCwd?: () => string;
};

function quoteShellPath(path: string) {
    return `'${String(path ?? '').replace(/'/g, `'\"'\"'`)}'`;
}

export function createShellRunner({
    bash,
    defaultCwd = '/workspace',
}: {
    bash: BashLike;
    defaultCwd?: string;
}) {
    if (!bash || typeof bash.exec !== 'function') {
        throw new Error('createShellRunner requires a bash instance with an exec(command) function.');
    }

    let currentCwd = String(defaultCwd || '/workspace').trim() || '/workspace';

    async function run(command: string, { cwd }: { cwd?: string } = {}): Promise<ShellRunnerResult> {
        const requestedCwd = String(cwd || '').trim();
        const targetCwd = requestedCwd || currentCwd;
        const actualCwd = typeof bash.getCwd === 'function' ? bash.getCwd() : currentCwd;

        if (targetCwd && actualCwd !== targetCwd) {
            await bash.exec(`cd ${quoteShellPath(targetCwd)}`);
        }

        const result = await bash.exec(String(command || ''));
        const resolvedCwd = typeof bash.getCwd === 'function' ? bash.getCwd() : targetCwd || defaultCwd;
        currentCwd = resolvedCwd || currentCwd;

        return {
            command: String(command || ''),
            cwd: currentCwd || defaultCwd,
            stdout: String(result?.stdout || ''),
            stderr: String(result?.stderr || ''),
            exitCode: Number(result?.exitCode ?? 1),
        };
    }

    return {
        run,
        getCwd() {
            return currentCwd;
        },
    };
}
