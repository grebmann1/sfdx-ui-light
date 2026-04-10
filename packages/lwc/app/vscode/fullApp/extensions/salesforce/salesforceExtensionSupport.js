export const EXTENSION_VERSION = '1.0.O';
export const EXTENSION_PUBLISHER = 'salesforce';

function createObjectUrl(content, mimeType) {
    return URL.createObjectURL(new Blob([content], { type: mimeType }));
}

async function fetchTextAsset(sourcePath) {
    const response = await fetch(sourcePath);
    return response.text();
}

async function loadRemoteAssets(filesOrContents, assets) {
    const loadedAssets = await Promise.all(
        (assets || []).map(async ({ sourcePath, targetPath, mimeType }) => ({
            targetPath,
            objectUrl: createObjectUrl(await fetchTextAsset(sourcePath), mimeType),
        }))
    );

    for (const { targetPath, objectUrl } of loadedAssets) {
        filesOrContents.set(targetPath, objectUrl);
    }
}

function loadInlineAssets(filesOrContents, assets) {
    for (const { targetPath, mimeType, content } of assets || []) {
        filesOrContents.set(targetPath, createObjectUrl(content, mimeType));
    }
}

async function tryLoadAssetGroup(loadGroup) {
    try {
        await loadGroup();
    } catch {
        // ignore
    }
}

export function buildSalesforceExtensionConfig({
    name,
    displayName,
    description,
    contributes = {},
}) {
    return {
        name,
        displayName,
        description,
        version: EXTENSION_VERSION,
        publisher: EXTENSION_PUBLISHER,
        license: 'MIT',
        engines: { vscode: '*' },
        activationEvents: ['*'],
        contributes,
    };
}

export async function buildSalesforceExtensionBundle({
    config,
    inlineAssets = [],
    remoteAssets = [],
}) {
    const filesOrContents = new Map();

    await tryLoadAssetGroup(() =>
        Promise.resolve(loadInlineAssets(filesOrContents, inlineAssets))
    );
    await tryLoadAssetGroup(() => loadRemoteAssets(filesOrContents, remoteAssets));

    return {
        config,
        filesOrContents,
    };
}
