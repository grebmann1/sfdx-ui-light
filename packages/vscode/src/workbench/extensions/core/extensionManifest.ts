import { EXTENSION_PUBLISHER, EXTENSION_VERSION } from './constants';
import { createObjectUrl, fetchTextAsset } from './extensionAssets';

async function loadRemoteAssets(
    filesOrContents: Map<string, string>,
    assets: Array<{ sourcePath: string; targetPath: string; mimeType: string }>
) {
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

function loadInlineAssets(
    filesOrContents: Map<string, string>,
    assets: Array<{ targetPath: string; mimeType: string; content: string }>
) {
    for (const { targetPath, mimeType, content } of assets || []) {
        filesOrContents.set(targetPath, createObjectUrl(content, mimeType));
    }
}

async function tryLoadAssetGroup(loadGroup: () => Promise<void>) {
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
}: {
    name: string;
    displayName: string;
    description: string;
    contributes?: Record<string, unknown>;
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
}: {
    config: Record<string, unknown>;
    inlineAssets?: Array<{ targetPath: string; mimeType: string; content: string }>;
    remoteAssets?: Array<{ sourcePath: string; targetPath: string; mimeType: string }>;
}) {
    const filesOrContents = new Map<string, string>();

    await tryLoadAssetGroup(() => Promise.resolve(loadInlineAssets(filesOrContents, inlineAssets)));
    await tryLoadAssetGroup(() => loadRemoteAssets(filesOrContents, remoteAssets));

    return {
        config,
        filesOrContents,
    };
}
