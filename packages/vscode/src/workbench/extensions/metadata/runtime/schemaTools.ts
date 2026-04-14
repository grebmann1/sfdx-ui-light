import { writeTextFile } from '../core/workspaceCache';
import { getWorkspaceUri } from '../core/workspacePaths';

export async function registerSchemaTools({ connectionRuntime, context }) {
    const { vscode } = context;
    const schemaCacheUri = getWorkspaceUri(vscode, '.salesforce/schema-cache.json');
    const schemaTtlMs = 24 * 60 * 60 * 1000;
    let schemaCacheMem = null;

    async function loadSchemaCache() {
        if (schemaCacheMem) return schemaCacheMem;
        try {
            const bytes = await vscode.workspace.fs.readFile(schemaCacheUri);
            const text = new TextDecoder().decode(bytes || new Uint8Array());
            const parsed = JSON.parse(text || '{}');
            const next = parsed && typeof parsed === 'object' ? parsed : {};
            if (!next.objects || typeof next.objects !== 'object') next.objects = {};
            schemaCacheMem = next;
            return next;
        } catch {
            const next = { generatedAt: null, ttlMs: schemaTtlMs, global: null, objects: {} };
            schemaCacheMem = next;
            return next;
        }
    }

    async function saveSchemaCache(cache) {
        const next = cache && typeof cache === 'object' ? cache : { objects: {} };
        if (!next.objects || typeof next.objects !== 'object') next.objects = {};
        schemaCacheMem = next;
        await writeTextFile(vscode, schemaCacheUri, JSON.stringify(next, null, 2), {
            skipCache: true,
        });
    }

    function isCacheFresh(isoValue, ttlMs) {
        try {
            const time = Date.parse(String(isoValue || ''));
            if (!Number.isFinite(time)) return false;
            return Date.now() - time < (Number.isFinite(ttlMs) ? ttlMs : schemaTtlMs);
        } catch {
            return false;
        }
    }

    async function ensureGlobalDescribe(conn, { force } = {} as { force?: boolean }) {
        const cache = await loadSchemaCache();
        const ttlMs = Number(cache.ttlMs || schemaTtlMs);
        const globalHasQueryable =
            Array.isArray(cache.global?.sobjects) &&
            cache.global.sobjects.every(item =>
                Object.prototype.hasOwnProperty.call(item || {}, 'queryable')
            );
        if (
            !force &&
            cache.global &&
            globalHasQueryable &&
            isCacheFresh(cache.global.generatedAt, ttlMs) &&
            cache.global.instanceUrl === conn.instanceUrl
        ) {
            return cache.global;
        }
        const global = await connectionRuntime.withToolingClientAuthed(conn, async client => {
            const response = await client.requestJson('/sobjects/');
            const sobjects = Array.isArray(response?.sobjects) ? response.sobjects : [];
            return {
                instanceUrl: conn.instanceUrl,
                generatedAt: new Date().toISOString(),
                sobjects: sobjects
                    .map(item => ({
                        name: item?.name || item?.Name,
                        label: item?.label || item?.Label || item?.name || item?.Name,
                        custom: Boolean(item?.custom),
                        queryable: item?.queryable !== false,
                    }))
                    .filter(item => item?.name),
            };
        });
        cache.global = global;
        cache.generatedAt = new Date().toISOString();
        cache.instanceUrl = conn.instanceUrl;
        await saveSchemaCache(cache);
        return global;
    }

    async function ensureSObjectDescribe(conn, sobjectName, { force } = {} as { force?: boolean }) {
        const name = String(sobjectName || '').trim();
        if (!name) return null;
        const cache = await loadSchemaCache();
        const ttlMs = Number(cache.ttlMs || schemaTtlMs);
        const existing = cache.objects?.[name];
        const existingHasRichFieldMetadata =
            Array.isArray(existing?.fields) &&
            existing.fields.every(field => {
                const candidate = field || {};
                return (
                    Object.prototype.hasOwnProperty.call(candidate, 'relationshipName') &&
                    Object.prototype.hasOwnProperty.call(candidate, 'referenceTo') &&
                    Object.prototype.hasOwnProperty.call(candidate, 'picklistValues')
                );
            });
        if (
            !force &&
            existing &&
            existingHasRichFieldMetadata &&
            existing.instanceUrl === conn.instanceUrl &&
            isCacheFresh(existing.generatedAt, ttlMs)
        ) {
            return existing;
        }
        const describeResult = await connectionRuntime.withToolingClientAuthed(
            conn,
            async client => {
                return await client.requestJson(`/sobjects/${encodeURIComponent(name)}/describe`);
            }
        );
        const next = {
            instanceUrl: conn.instanceUrl,
            generatedAt: new Date().toISOString(),
            name,
            label: describeResult?.label || name,
            fields: Array.isArray(describeResult?.fields)
                ? describeResult.fields
                      .map(field => ({
                          name: field?.name,
                          label: field?.label || field?.name,
                          type: field?.type || '',
                          relationshipName: field?.relationshipName || '',
                          referenceTo: Array.isArray(field?.referenceTo) ? field.referenceTo : [],
                          picklistValues: Array.isArray(field?.picklistValues)
                              ? field.picklistValues
                                    .map(value => {
                                        if (typeof value === 'string') return value;
                                        if (value && typeof value === 'object' && value.active === false) return null;
                                        return value?.value ?? null;
                                    })
                                    .filter(Boolean)
                                    .slice(0, 200)
                              : [],
                          filterable: field?.filterable !== false,
                          sortable: field?.sortable !== false,
                          aggregatable: field?.aggregatable !== false,
                          groupable: field?.groupable !== false,
                          nillable: field?.nillable !== false,
                      }))
                      .filter(field => field?.name)
                : [],
            childRelationships: Array.isArray(describeResult?.childRelationships)
                ? describeResult.childRelationships.map(relationship => ({
                      childSObject: relationship?.childSObject,
                      field: relationship?.field,
                      relationshipName: relationship?.relationshipName,
                  }))
                : [],
        };
        cache.objects[name] = next;
        cache.generatedAt = new Date().toISOString();
        cache.instanceUrl = conn.instanceUrl;
        await saveSchemaCache(cache);
        return next;
    }

    function isLwcDoc(doc) {
        const path = doc?.uri?.path || '';
        if (!path.includes('/force-app/main/') || !path.includes('/lwc/')) return false;
        return (
            path.endsWith('.js') ||
            path.endsWith('.ts') ||
            path.endsWith('.html') ||
            path.endsWith('.css')
        );
    }

    async function lintLwcDocument() {
        // No-op: LWC lint execution is not yet implemented in the web workbench runtime.
    }

    return {
        ensureGlobalDescribe,
        ensureSObjectDescribe,
        isLwcDoc,
        lintLwcDocument,
        loadSchemaCache,
    };
}

export const __testables = {
    isCacheFresh(isoValue, ttlMs, now = Date.now()) {
        try {
            const time = Date.parse(String(isoValue || ''));
            if (!Number.isFinite(time)) return false;
            return now - time < ttlMs;
        } catch {
            return false;
        }
    },
    isLwcDocPath(path) {
        return (
            String(path || '').includes('/force-app/main/') &&
            String(path || '').includes('/lwc/') &&
            (String(path || '').endsWith('.js') ||
                String(path || '').endsWith('.ts') ||
                String(path || '').endsWith('.html') ||
                String(path || '').endsWith('.css'))
        );
    },
};
