/**
 * Creates a just-bash Bash instance backed by the singleton IndexedDB filesystem.
 * See https://github.com/vercel-labs/just-bash#execution-protection for execution limits.
 *
 * Requires: npm install just-bash
 */

import { Bash } from 'just-bash';

import { getIndexedDbFileSystem } from 'core/fs';

/**
 * Creates a Bash instance with:
 * - fs: singleton IndexedDB filesystem (default files mounted by core/fs)
 * - cwd: /workspace
 * - executionLimits: from just-bash Execution Protection (maxCallDepth, maxCommandCount, etc.)
 *
 * @param {Object} [options]
 * @param {Object} [options.executionLimits] - Override default execution limits (maxCallDepth, maxCommandCount, maxLoopIterations, etc.).
 * @param {Object} [options.extraFiles] - Additional virtual files to mount (path -> string or () => string | Promise<string>).
 * @param {string} [options.indexedDbName] - Optional IndexedDB database name for persisted shell filesystem state.
 * @param {boolean} [options.enableFsDebug] - If true, expose fs debug helpers on the Bash instance.
 * @param {Record<string, string>} [options.env] - Initial environment variables.
 * @returns {Bash}
 */
export function createBashInstance(options = {}) {
    const {
        executionLimits = {},
        extraFiles = {},
        indexedDbName,
        enableFsDebug = false,
        env = {},
    } = options;

    const fs = getIndexedDbFileSystem({
        ...(indexedDbName ? { dbName: indexedDbName } : {}),
        initialFiles: extraFiles,
        ensureDirectories: ['/workspace', '/workspace/skills'],
    });

    const bashEnv = new Bash({
        fs,
        cwd: '/workspace',
        env,
        executionLimits: {
            maxCallDepth: 100,
            maxCommandCount: 10000,
            maxLoopIterations: 10000,
            maxAwkIterations: 10000,
            maxSedIterations: 10000,
            ...executionLimits,
        },
    });

    if (enableFsDebug) {
        bashEnv.getFsDebugStats = () => fs.getDebugStats();
    }

    return bashEnv;
}

export * from './shellRunner';
export * from './salesforceShellCommands';
