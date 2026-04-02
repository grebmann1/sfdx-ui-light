import { loadStoredConnection } from './activeConnection.js';
import { isAuthError, refreshStoredConnection, resolveStoredConnection } from './sharedConnection.js';

function getEffectiveProxyUrl(app) {
    return app.sfUseProxy
        ? (app.sfProxyUrl?.trim() || window.location.origin)
        : undefined;
}

function createAppToolingClient(app, createToolingClient, connection) {
    return createToolingClient({
        instanceUrl: connection.instanceUrl,
        accessToken: connection.accessToken,
        apiVersion: connection.apiVersion || app.sfApiVersion || '63.0',
        proxyUrl: getEffectiveProxyUrl(app),
    });
}

function getAppConnection(app) {
    const storedConnection = loadStoredConnection();
    if (storedConnection?.sharedAlias || (storedConnection?.instanceUrl && storedConnection?.accessToken)) {
        return storedConnection;
    }

    return {
        instanceUrl: app.sfInstanceUrl,
        accessToken: app.sfAccessToken,
        apiVersion: app.sfApiVersion,
        authType: '',
        sharedAlias: '',
        username: '',
        userId: '',
        orgId: '',
        workspaceRoot: app?._workspaceRoot || '',
    };
}

async function resolveAppConnection(app) {
    const current = getAppConnection(app);
    const resolved = await resolveStoredConnection(current).catch(() => current);
    app._applyActiveConnection?.(resolved);
    return resolved;
}

async function withAuthedToolingClient(app, createToolingClient, fn) {
    const current = await resolveAppConnection(app);

    try {
        return await fn(createAppToolingClient(app, createToolingClient, current), current);
    } catch (error) {
        if (!isAuthError(error)) {
            throw error;
        }
        const refreshed = await refreshStoredConnection(current).catch(() => null);
        if (!refreshed) {
            throw error;
        }
        app._applyActiveConnection?.(refreshed);
        return await fn(createAppToolingClient(app, createToolingClient, refreshed), refreshed);
    }
}

export async function refreshSalesforceMetadataForApp(
    app,
    {
        createToolingClient,
        mapWithConcurrency,
        sanitizePathSegment,
        auraFilename,
    }
) {
    if (!app?.sfConnected) {
        throw new Error('Not connected.');
    }
    await app._seedWorkspaceFiles();
    if (!app._fsProvider || !app._vscode) {
        throw new Error('Workbench filesystem is not ready yet.');
    }

    // Clear only Salesforce metadata nodes (keep base workspace files).
    app._disposeSfRegistrations();

    const workspaceRoot = app?._workspaceRoot || '/workspace';
    const root = `${workspaceRoot}/force-app/main/default`;
    const classesDir = `${root}/classes`;
    const triggersDir = `${root}/triggers`;
    const lwcDir = `${root}/lwc`;
    const auraDir = `${root}/aura`;
    app._mkdirp(classesDir);
    app._mkdirp(triggersDir);
    app._mkdirp(lwcDir);
    app._mkdirp(auraDir);
    app._mkdirp(`${workspaceRoot}/.salesforce`);

    const { connection, apexClasses, apexTriggers, lwcBundles, auraBundles } = await withAuthedToolingClient(
        app,
        createToolingClient,
        async (client, resolvedConnection) => ({
            connection: resolvedConnection,
            apexClasses: await client.listApexClasses(),
            apexTriggers: await client.listApexTriggers(),
            lwcBundles: await client.listLwcBundles(),
            auraBundles: await client.listAuraBundles(),
        })
    );

    const index = {
        generatedAt: new Date().toISOString(),
        instanceUrl: connection.instanceUrl,
        apiVersion: connection.apiVersion || app.sfApiVersion || '63.0',
        counts: {
            apexClasses: apexClasses.length,
            apexTriggers: apexTriggers.length,
            lwcBundles: lwcBundles.length,
            auraBundles: auraBundles.length,
        },
        apex: { classes: [], triggers: [] },
        lwc: [],
        aura: [],
    };

    // ApexClass
    for (const c of apexClasses) {
        const name = sanitizePathSegment(c?.Name);
        const path = `${classesDir}/${name}.cls`;
        app._registerSfLazyReadOnlyFile(path, async () => {
            const row = await withAuthedToolingClient(app, createToolingClient, async (client) => {
                return await client.getApexClassBody(c.Id);
            });
            return row?.Body ?? '';
        });
        index.apex.classes.push({ id: c.Id, name: c.Name, path });
    }

    // ApexTrigger
    for (const t of apexTriggers) {
        const name = sanitizePathSegment(t?.Name);
        const path = `${triggersDir}/${name}.trigger`;
        app._registerSfLazyReadOnlyFile(path, async () => {
            const row = await withAuthedToolingClient(app, createToolingClient, async (client) => {
                return await client.getApexTriggerBody(t.Id);
            });
            return row?.Body ?? '';
        });
        index.apex.triggers.push({ id: t.Id, name: t.Name, path });
    }

    // LWC bundles + resources
    const lwcResourcesByBundle = await mapWithConcurrency(lwcBundles, 4, async (bundle) => {
        const bundleName = sanitizePathSegment(bundle?.DeveloperName);
        const resources = await withAuthedToolingClient(app, createToolingClient, async (client) => {
            return await client.listLwcResources(bundle.Id);
        });
        return { bundle, bundleName, resources };
    });

    for (const entry of lwcResourcesByBundle) {
        const bundleName = entry.bundleName || 'unnamed';
        const bundlePath = `${lwcDir}/${bundleName}`;
        app._mkdirp(bundlePath);
        const bundleIndex = {
            id: entry.bundle?.Id,
            name: entry.bundle?.DeveloperName,
            path: bundlePath,
            resources: [],
        };

        for (const resource of entry.resources || []) {
            let rel = String(resource?.FilePath || '').replace(/^\/+/, '');
            if (rel.startsWith(`${bundleName}/`)) {
                rel = rel.slice(bundleName.length + 1);
            }
            rel = rel || `${bundleName}.txt`;
            const filePath = `${bundlePath}/${rel}`;
            const lastSlash = filePath.lastIndexOf('/');
            if (lastSlash > bundlePath.length) {
                app._mkdirp(filePath.slice(0, lastSlash));
            }
            app._registerSfLazyReadOnlyFile(filePath, async () => {
                const row = await withAuthedToolingClient(app, createToolingClient, async (client) => {
                    return await client.getLwcResourceSource(resource.Id);
                });
                return row?.Source ?? '';
            });
            bundleIndex.resources.push({
                id: resource.Id,
                filePath: resource.FilePath,
                path: filePath,
                format: resource.Format,
            });
        }

        index.lwc.push(bundleIndex);
    }

    // Aura bundles + definitions
    const auraDefsByBundle = await mapWithConcurrency(auraBundles, 4, async (bundle) => {
        const bundleName = sanitizePathSegment(bundle?.DeveloperName);
        const defs = await withAuthedToolingClient(app, createToolingClient, async (client) => {
            return await client.listAuraDefinitions(bundle.Id);
        });
        return { bundle, bundleName, defs };
    });

    for (const entry of auraDefsByBundle) {
        const bundleName = entry.bundleName || 'unnamed';
        const bundlePath = `${auraDir}/${bundleName}`;
        app._mkdirp(bundlePath);
        const bundleIndex = {
            id: entry.bundle?.Id,
            name: entry.bundle?.DeveloperName,
            path: bundlePath,
            definitions: [],
        };

        const usedNames = new Set();
        for (const definition of entry.defs || []) {
            let fileName = auraFilename(bundleName, definition?.DefType, definition?.Format);
            fileName = sanitizePathSegment(fileName);
            if (usedNames.has(fileName)) {
                fileName = `${fileName}.${String(definition?.Id || '').slice(-6) || 'dup'}`;
            }
            usedNames.add(fileName);
            const filePath = `${bundlePath}/${fileName}`;
            app._registerSfLazyReadOnlyFile(filePath, async () => {
                const row = await withAuthedToolingClient(app, createToolingClient, async (client) => {
                    return await client.getAuraDefinitionSource(definition.Id);
                });
                return row?.Source ?? '';
            });
            bundleIndex.definitions.push({
                id: definition.Id,
                defType: definition.DefType,
                format: definition.Format,
                path: filePath,
            });
        }

        index.aura.push(bundleIndex);
    }

    await app._registerSfTextFile(
        `${workspaceRoot}/.salesforce/metadata-index.json`,
        JSON.stringify(index, null, 2),
        { overwrite: true }
    );
}
