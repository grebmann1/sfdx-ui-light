import {
    createIndexedDbFileSystem,
    INDEXED_DB_DEFAULT_NAME,
} from './indexedDbFileSystem';

type LazyFileProvider = () => Promise<string>;
type InitialFileValue =
    | string
    | Uint8Array
    | { content?: string | Uint8Array; mode?: number; mtime?: Date }
    | LazyFileProvider;
type InitialFilesMap = Record<string, InitialFileValue>;

type IndexedDbFsOptions = {
    dbName?: string;
    initialFiles?: InitialFilesMap;
    ensureDirectories?: string[];
};

const fsByDbName = new Map();
const seededDefaultsByDbName = new Set();

/** Relative paths under assets/skills to load into /workspace/skills */
const CORE_SKILL_FILE_PATHS = [
    'general/soql.SKILL.md',
    'general/apex.SKILL.md',
    'general/api.SKILL.md',
    'general/connections.SKILL.md',
    'general/chrome.SKILL.md',
    'general/metadata.SKILL.md',
    'general/agent.SKILL.md',
];

const DEFAULT_SKILLS_BASE_URL = '/public/skills';

function getSkillsBaseUrl() {
    const origin =
        typeof globalThis !== 'undefined' && globalThis.location?.origin
            ? globalThis.location.origin
            : '';
    if (!origin) return DEFAULT_SKILLS_BASE_URL;
    return `${origin.replace(/\/$/, '')}${DEFAULT_SKILLS_BASE_URL}`;
}

function buildFileProvidersFromRelativePaths(relativePaths) {
    const prefix = getSkillsBaseUrl();
    const files = {};
    for (const rel of relativePaths) {
        const bashPath = `/workspace/skills/${rel}`;
        const url = `${prefix}/${rel}`;
        files[bashPath] = async () => {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`Failed to load skill file: ${url} (${res.status})`);
            return res.text();
        };
    }
    return files as Record<string, LazyFileProvider>;
}

/**
 * Builds the default skill files map: each path is /workspace/skills/<relative path>,
 * value is a lazy getter that fetches the file from assets/skills (served at /public/skills).
 * @returns {Record<string, () => Promise<string>>}
 */
function buildCoreDefaultSkillsFiles() {
    return buildFileProvidersFromRelativePaths(CORE_SKILL_FILE_PATHS);
}

function getParentDirectoriesForFilePaths(filePaths) {
    const out = new Set();
    const addParents = fullPath => {
        const raw = String(fullPath || '');
        if (!raw.startsWith('/')) return;
        const parts = raw.split('/').filter(Boolean);
        if (parts.length <= 1) return;
        // Treat last segment as file name.
        const dirParts = parts.slice(0, -1);
        let current = '';
        for (const part of dirParts) {
            current += `/${part}`;
            out.add(current);
        }
    };
    (filePaths || []).forEach(addParents);
    return Array.from(out).sort((a, b) => a.length - b.length);
}

function seedDefaultFilesIfNeeded(fs, dbName) {
    if (seededDefaultsByDbName.has(dbName)) return;
    seededDefaultsByDbName.add(dbName);

    // Async best-effort seed; never blocks app boot.
    (async () => {
        try {
            await fs.ready;
            const coreDefaultFiles = {};//buildCoreDefaultSkillsFiles();
            const coreEnsureDirs = getParentDirectoriesForFilePaths(Object.keys(coreDefaultFiles));
            // Repair: older versions could have created empty placeholder files under
            // `/workspace/skills/...`, which then prevents registering lazy providers (no overwrite).
            // If the default skill file exists but is empty, delete it so the lazy loader can work.
            for (const skillPath of Object.keys(coreDefaultFiles)) {
                const existing = await fs.getEntry(skillPath).catch(() => null);
                const isEmptyFile =
                    existing &&
                    existing.type === 'file' &&
                    ((typeof existing.size === 'number' && existing.size === 0) ||
                        !existing.contentBase64);
                if (isEmptyFile) {
                    await fs.rm(skillPath, { force: true }).catch(() => {});
                }
            }
            for (const dir of coreEnsureDirs) {
                await fs.mkdir(dir, { recursive: true }).catch(() => {});
            }
            await fs.registerInitialFiles(coreDefaultFiles);

        } catch (_) {
            // ignore seeding failures (offline, blocked fetch, etc.)
        }
    })();
}

function mergeEnsureDirectories(ensureDirectories, initialFiles) {
    const dirs = new Set(['/workspace', '/workspace/skills']);
    (ensureDirectories || []).forEach(d => dirs.add(d));
    const parents = getParentDirectoriesForFilePaths(Object.keys(initialFiles || {}));
    parents.forEach(d => dirs.add(d));
    return Array.from(dirs);
}

function createSingletonFs(options: IndexedDbFsOptions = {}) {
    const { dbName = INDEXED_DB_DEFAULT_NAME, initialFiles = {}, ensureDirectories } = options;
    const defaultFiles = buildCoreDefaultSkillsFiles();
    const mergedInitialFiles = { ...defaultFiles, ...(initialFiles || {}) };
    const fs = createIndexedDbFileSystem({
        dbName,
        initialFiles: mergedInitialFiles,
        ensureDirectories: mergeEnsureDirectories(ensureDirectories, mergedInitialFiles),
    });
    fsByDbName.set(dbName, fs);
    seedDefaultFilesIfNeeded(fs, dbName);
    return fs;
}

export function getIndexedDbFileSystem(options: IndexedDbFsOptions = {}) {
    const { dbName = INDEXED_DB_DEFAULT_NAME, initialFiles = {}, ensureDirectories } = options;
    const existing = fsByDbName.get(dbName);
    if (!existing) {
        return createSingletonFs({ dbName, initialFiles, ensureDirectories });
    }

    // Ensure default files are available on the singleton (best-effort, no overwrite).
    seedDefaultFilesIfNeeded(existing, dbName);

    if (initialFiles && Object.keys(initialFiles).length > 0) {
        existing.registerInitialFiles(initialFiles).catch(() => {});
    }

    return existing;
}

export default getIndexedDbFileSystem();
