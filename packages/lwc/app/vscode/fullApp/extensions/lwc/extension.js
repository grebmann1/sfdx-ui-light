import { registerLwcComponentScaffolding } from '../metadata/commands/lwcComponentScaffolding.js';
import { registerSalesforceExtension } from '../shared.js';
import { getOrCreateSalesforceWorkbenchHost } from '../salesforce/salesforceWorkbenchHost.js';
import { buildLwcExtensionConfig } from './extensionConfig.js';

const WEB_LANGUAGE_ASSETS = [
    { sourcePath: '/libs/extensions/vscode-basics/vscode.javascript/javascript-language-configuration.json', targetPath: '/workspace/vscode/javascript-language-configuration.json', mimeType: 'application/json' },
    { sourcePath: '/libs/extensions/vscode-basics/vscode.javascript/syntaxes/JavaScript.tmLanguage.json', targetPath: '/workspace/vscode/JavaScript.tmLanguage.json', mimeType: 'application/json' },
    { sourcePath: '/libs/extensions/vscode-basics/vscode.javascript/syntaxes/JavaScriptReact.tmLanguage.json', targetPath: '/workspace/vscode/JavaScriptReact.tmLanguage.json', mimeType: 'application/json' },
    { sourcePath: '/libs/extensions/vscode-basics/vscode.typescript/language-configuration.json', targetPath: '/workspace/vscode/typescript-language-configuration.json', mimeType: 'application/json' },
    { sourcePath: '/libs/extensions/vscode-basics/vscode.typescript/syntaxes/TypeScript.tmLanguage.json', targetPath: '/workspace/vscode/TypeScript.tmLanguage.json', mimeType: 'application/json' },
    { sourcePath: '/libs/extensions/vscode-basics/vscode.typescript/syntaxes/TypeScriptReact.tmLanguage.json', targetPath: '/workspace/vscode/TypeScriptReact.tmLanguage.json', mimeType: 'application/json' },
    { sourcePath: '/libs/extensions/vscode-basics/vscode.typescript/syntaxes/jsdoc.js.injection.tmLanguage.json', targetPath: '/workspace/vscode/jsdoc.js.injection.tmLanguage.json', mimeType: 'application/json' },
    { sourcePath: '/libs/extensions/vscode-basics/vscode.typescript/syntaxes/jsdoc.ts.injection.tmLanguage.json', targetPath: '/workspace/vscode/jsdoc.ts.injection.tmLanguage.json', mimeType: 'application/json' },
    { sourcePath: '/libs/extensions/vscode-basics/vscode.html/language-configuration.json', targetPath: '/workspace/vscode/html-language-configuration.json', mimeType: 'application/json' },
    { sourcePath: '/libs/extensions/vscode-basics/vscode.html/syntaxes/html.tmLanguage.json', targetPath: '/workspace/vscode/html.tmLanguage.json', mimeType: 'application/json' },
    { sourcePath: '/libs/extensions/vscode-basics/vscode.css/language-configuration.json', targetPath: '/workspace/vscode/css-language-configuration.json', mimeType: 'application/json' },
    { sourcePath: '/libs/extensions/vscode-basics/vscode.css/syntaxes/css.tmLanguage.json', targetPath: '/workspace/vscode/css.tmLanguage.json', mimeType: 'application/json' },
];

const LWC_SNIPPET_ASSETS = [
    { sourcePath: '/libs/extensions/salesforce-lwc/snippets/lwc-js.json', targetPath: '/workspace/vscode/lwc-js.code-snippets', mimeType: 'application/json' },
    { sourcePath: '/libs/extensions/salesforce-lwc/snippets/lwc-html.json', targetPath: '/workspace/vscode/lwc-html.code-snippets', mimeType: 'application/json' },
];

export async function register(vscodeBundle) {
    return registerSalesforceExtension(
        vscodeBundle,
        {
            config: buildLwcExtensionConfig(),
            remoteAssets: [...WEB_LANGUAGE_ASSETS, ...LWC_SNIPPET_ASSETS],
        },
        async (_vscode, { push }) => {
            const sfHost = await getOrCreateSalesforceWorkbenchHost(vscodeBundle);
            if (!sfHost) return;

            await sfHost.activateFeatureOnce(
                'salesforce-lwc',
                async ({ connectionRuntime, context, deployTools }) => {
                    registerLwcComponentScaffolding({ connectionRuntime, context });
                    deployTools.registerCommandGroups(['lwc']);
                }
            );
        }
    );
}
