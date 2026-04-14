import { DEFAULT_SOURCE_API_VERSION, normalizeSfApiVersion } from '../../../workbenchWorkspace';
import { ensureDir, writeTextFile } from '../core/workspaceCache';

function toUri(vscode, value) {
    if (!value) return null;
    if (value?.scheme && typeof value?.toString === 'function') return value;
    const path = value?.path || value?.uri?.path || value;
    return path ? vscode.Uri.file(String(path)) : null;
}

function getBaseName(path) {
    return String(path || '')
        .replace(/\/+$/, '')
        .split('/')
        .filter(Boolean)
        .pop();
}

function isValidBundleName(name) {
    return /^[a-z][A-Za-z0-9_]*$/.test(String(name || ''));
}

function toComponentClassName(name) {
    return String(name || '')
        .replace(/(^|_+)([a-zA-Z0-9])/g, (_match, _prefix, character) =>
            String(character).toUpperCase()
        )
        .replace(/[^A-Za-z0-9]/g, '');
}

function createComponentFiles(bundleName, apiVersion = DEFAULT_SOURCE_API_VERSION) {
    const className = toComponentClassName(bundleName);
    return {
        [`${bundleName}.js`]: `import { LightningElement } from 'lwc';

export default class ${className} extends LightningElement {}
`,
        [`${bundleName}.html`]: `<template>
    <div>
        ${bundleName}
    </div>
</template>
`,
        [`${bundleName}.js-meta.xml`]: `<?xml version="1.0" encoding="UTF-8"?>
<LightningComponentBundle xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>${normalizeSfApiVersion(apiVersion, DEFAULT_SOURCE_API_VERSION)}</apiVersion>
    <isExposed>false</isExposed>
</LightningComponentBundle>
`,
    };
}

async function exists(vscode, uri) {
    try {
        await vscode.workspace.fs.stat(uri);
        return true;
    } catch {
        return false;
    }
}

export function registerLwcComponentScaffolding({ connectionRuntime, context }) {
    const { vscode } = context;

    return context.addDisposable(
        vscode.commands.registerCommand(
            'salesforceMetadata.createLightningComponent',
            async target => {
                const targetUri = toUri(vscode, target);
                const folderName = getBaseName(targetUri?.path);
                if (!targetUri || folderName !== 'lwc') {
                    await vscode.window.showWarningMessage(
                        'Create Lightning Component can only be used on an "lwc" folder.'
                    );
                    return;
                }

                const bundleName = await vscode.window.showInputBox({
                    title: 'Create Lightning Component',
                    prompt: 'Enter the Lightning component bundle name',
                    placeHolder: 'myComponent',
                    ignoreFocusOut: true,
                    validateInput(value) {
                        const trimmed = String(value || '').trim();
                        if (!trimmed) {
                            return 'A component name is required.';
                        }
                        if (!isValidBundleName(trimmed)) {
                            return 'Use lowerCamelCase or underscores, starting with a letter.';
                        }
                        return undefined;
                    },
                });
                const normalizedName = String(bundleName || '').trim();
                if (!normalizedName) return;

                const componentDir = vscode.Uri.joinPath(targetUri, normalizedName);
                if (await exists(vscode, componentDir)) {
                    await vscode.window.showErrorMessage(
                        `A Lightning component named "${normalizedName}" already exists.`
                    );
                    return;
                }

                await ensureDir(vscode, componentDir);
                const apiVersion = await connectionRuntime.getWorkspaceApiVersion();
                const componentFiles = createComponentFiles(normalizedName, apiVersion);
                for (const [fileName, contents] of Object.entries(componentFiles)) {
                    const fileUri = vscode.Uri.joinPath(componentDir, fileName);
                    // eslint-disable-next-line no-await-in-loop
                    await writeTextFile(vscode, fileUri, contents);
                }

                try {
                    const mainFile = vscode.Uri.joinPath(componentDir, `${normalizedName}.js`);
                    const doc = await vscode.workspace.openTextDocument(mainFile);
                    await vscode.window.showTextDocument(doc, { preview: false });
                } catch {
                    // ignore
                }

                await vscode.window.showInformationMessage(
                    `Created Lightning component "${normalizedName}".`
                );
            }
        )
    );
}

export const __testables = {
    createComponentFiles,
    isValidBundleName,
    toComponentClassName,
};
