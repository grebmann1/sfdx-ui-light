export function toDisposable(value) {
    if (value && typeof value.dispose === 'function') {
        return value;
    }
    return { dispose() {} };
}

export function createCallbackDisposable(callback) {
    return {
        dispose() {
            try {
                callback?.();
            } catch {
                // ignore cleanup errors
            }
        },
    };
}

function createObjectUrl(content, mimeType) {
    return URL.createObjectURL(new Blob([content], { type: mimeType }));
}

async function fetchTextAsset(sourcePath) {
    const response = await fetch(sourcePath);
    return response.text();
}

async function buildAssetsMap({ remoteAssets, inlineAssets, filesOrContents } = {}) {
    const map = new Map(filesOrContents ? filesOrContents.entries() : []);

    for (const { targetPath, mimeType, content } of inlineAssets || []) {
        map.set(targetPath, createObjectUrl(content, mimeType));
    }

    const remoteLoaded = await Promise.allSettled(
        (remoteAssets || []).map(async ({ sourcePath, targetPath, mimeType, content }) => ({
            targetPath,
            objectUrl: createObjectUrl(content || await fetchTextAsset(sourcePath), mimeType),
        }))
    );

    for (const result of remoteLoaded) {
        if (result.status === 'fulfilled') {
            map.set(result.value.targetPath, result.value.objectUrl);
        }
    }

    return map;
}

/**
 * Registers a Salesforce extension dynamically (post-init) via the vscode extensions API.
 *
 * Handles asset loading (remote + inline), extension registration, file URL mapping,
 * setup callback execution, and composite disposable teardown — mirroring the reference
 * `registerDemoExtension` pattern from the monaco-editor project.
 *
 * @param {object} vscodeBundle
 * @param {{ config, remoteAssets?, inlineAssets?, filesOrContents? }} definition
 * @param {(vscode, { push, vscodeBundle }) => Promise<any>} setup
 * @param {object} [options] - passed to registerExtension (e.g. { system: true })
 * @returns {Promise<{ dispose(): void }>}
 */
export async function registerSalesforceExtension(vscodeBundle, definition, setup, options = undefined) {
    const extensionsApi = vscodeBundle?.extensions;
    if (!extensionsApi?.registerExtension || !extensionsApi?.ExtensionHostKind) {
        return toDisposable();
    }

    const { config } = definition;
    const assetsMap = await buildAssetsMap(definition);
    const registration = extensionsApi.registerExtension(
        config,
        extensionsApi.ExtensionHostKind.LocalProcess, // LocalProcess
        options
    );

    const disposables = [];
    if (registration?.dispose) {
        disposables.push(registration);
    }

    if (assetsMap.size > 0 && typeof registration?.registerFileUrl === 'function') {
        for (const [path, fileUrl] of assetsMap.entries()) {
            const fileReg = registration.registerFileUrl(path, fileUrl);
            if (fileReg?.dispose) {
                disposables.push(fileReg);
            }
        }
    }

    const push = (...items) => {
        for (const item of items.flat()) {
            if (item && typeof item.dispose === 'function') {
                disposables.push(item);
            }
        }
    };
    console.log('registration', registration);
    const registrationResult = await registration.whenReady();
    console.log('registrationResult', registrationResult);

    const vscode = await registration?.getApi?.().catch(() => null);
    const result = await setup?.(vscode, { push, vscodeBundle });
    push(result);

    return createCallbackDisposable(() => {
        for (const disposable of [...disposables].reverse()) {
            try {
                disposable?.dispose?.();
            } catch {
                // ignore
            }
        }
    });
}
