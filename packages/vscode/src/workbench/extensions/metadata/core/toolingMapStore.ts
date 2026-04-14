import { writeTextFile } from './workspaceCache';
import { getWorkspaceUri } from './workspacePaths';

/**
 * Shared tooling-map store.
 *
 * Centralises all read/write/cache logic for `.salesforce/tooling-map.json`
 * so that both the metadata API commands and the deploy/source-tracking
 * commands share one implementation instead of maintaining separate copies.
 */
export function createToolingMapStore(vscode, state) {
    /**
     * Load the flat items map from the tooling-map JSON file, with a simple
     * in-memory cache stored on the shared `state` object.
     */
    async function loadItems({ force } = {}) {
        if (!force && state.toolingMapCache) {
            return state.toolingMapCache;
        }
        try {
            const uri = getWorkspaceUri(vscode, '.salesforce/tooling-map.json');
            const bytes = await vscode.workspace.fs.readFile(uri);
            const text = new TextDecoder().decode(bytes || new Uint8Array());
            const parsed = JSON.parse(text || '{}');
            state.toolingMapCache =
                parsed?.items && typeof parsed.items === 'object' ? parsed.items : {};
            return state.toolingMapCache;
        } catch {
            state.toolingMapCache = {};
            return state.toolingMapCache;
        }
    }

    /** Load the full tooling-map JSON envelope (items + metadata). */
    async function loadJson() {
        try {
            const uri = getWorkspaceUri(vscode, '.salesforce/tooling-map.json');
            const bytes = await vscode.workspace.fs.readFile(uri);
            const text = new TextDecoder().decode(bytes || new Uint8Array());
            const parsed = JSON.parse(text || '{}');
            return parsed && typeof parsed === 'object' ? parsed : { items: {} };
        } catch {
            return { items: {} };
        }
    }

    /** Persist a full tooling-map JSON envelope and invalidate the cache. */
    async function saveJson(obj) {
        const uri = getWorkspaceUri(vscode, '.salesforce/tooling-map.json');
        const next = obj && typeof obj === 'object' ? obj : { items: {} };
        if (!next.items || typeof next.items !== 'object') next.items = {};
        next.generatedAt = new Date().toISOString();
        await writeTextFile(vscode, uri, JSON.stringify(next, null, 2), { skipCache: true });
        invalidate();
    }

    function invalidate() {
        state.toolingMapCache = null;
    }

    return { loadItems, loadJson, saveJson, invalidate };
}
