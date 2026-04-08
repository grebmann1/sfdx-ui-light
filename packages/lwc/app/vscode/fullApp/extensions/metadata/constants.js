export const EXTENSION_ID = 'salesforce.sf-metadata';
export const AUTO_DEPLOY_KEY = 'sf_ext_autoDeployOnSave';
export const ONBOARDING_WALKTHROUGH_ID = 'workbenchOnboarding';
export const METADATA_WALKTHROUGH_FULL_ID = `${EXTENSION_ID}#${ONBOARDING_WALKTHROUGH_ID}`;
export const ONBOARDING_MARKDOWN_PATH = '/workspace/vscode/walkthroughs/workbench-onboarding.md';
export const OPEN_ONBOARDING_COMMAND = 'salesforceMetadata.openOnboarding';
export const OPEN_AGENT_CHAT_COMMAND = 'salesforceMetadata.openAgentChat';
export const OPEN_SALESFORCE_PANEL_COMMAND = 'salesforceMetadata.openSalesforcePanel';
export const OPEN_TOOLKIT_CONNECTIONS_COMMAND = 'salesforceMetadata.openToolkitConnections';

export const EXTENSION_VERSION = '1.0.O';

export const ANSI = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    brightBlack: '\x1b[90m',
};
const JSON_MIME_TYPE = 'application/json';
const XML_MIME_TYPE = 'application/xml';

export const APEX_LANGUAGE_ASSETS = [
    {
        sourcePath: '/libs/extensions/salesforce-apex/grammars/apex.tmLanguage',
        targetPath: '/workspace/vscode/apex.tmLanguage',
        mimeType: XML_MIME_TYPE,
    },
    {
        sourcePath: '/libs/extensions/salesforce-apex/grammars/soql.tmLanguage',
        targetPath: '/workspace/vscode/apex.soql.tmLanguage',
        mimeType: XML_MIME_TYPE,
    },
    {
        sourcePath: '/libs/extensions/salesforce-apex/syntaxes/apex.configuration.json',
        targetPath: '/workspace/vscode/apex.configuration.json',
        mimeType: JSON_MIME_TYPE,
    },
];

export const SOQL_LANGUAGE_ASSETS = [
    {
        sourcePath: '/libs/extensions/salesforcedx-vscode-soql/grammars/soql.tmLanguage',
        targetPath: '/workspace/vscode/soql.tmLanguage',
        mimeType: XML_MIME_TYPE,
    },
];

export const WEB_LANGUAGE_ASSETS = [
    {
        sourcePath:
            '/libs/extensions/vscode-basics/vscode.javascript/javascript-language-configuration.json',
        targetPath: '/workspace/vscode/javascript-language-configuration.json',
        mimeType: JSON_MIME_TYPE,
    },
    {
        sourcePath:
            '/libs/extensions/vscode-basics/vscode.javascript/syntaxes/JavaScript.tmLanguage.json',
        targetPath: '/workspace/vscode/JavaScript.tmLanguage.json',
        mimeType: JSON_MIME_TYPE,
    },
    {
        sourcePath:
            '/libs/extensions/vscode-basics/vscode.javascript/syntaxes/JavaScriptReact.tmLanguage.json',
        targetPath: '/workspace/vscode/JavaScriptReact.tmLanguage.json',
        mimeType: JSON_MIME_TYPE,
    },
    {
        sourcePath: '/libs/extensions/vscode-basics/vscode.typescript/language-configuration.json',
        targetPath: '/workspace/vscode/typescript-language-configuration.json',
        mimeType: JSON_MIME_TYPE,
    },
    {
        sourcePath:
            '/libs/extensions/vscode-basics/vscode.typescript/syntaxes/TypeScript.tmLanguage.json',
        targetPath: '/workspace/vscode/TypeScript.tmLanguage.json',
        mimeType: JSON_MIME_TYPE,
    },
    {
        sourcePath:
            '/libs/extensions/vscode-basics/vscode.typescript/syntaxes/TypeScriptReact.tmLanguage.json',
        targetPath: '/workspace/vscode/TypeScriptReact.tmLanguage.json',
        mimeType: JSON_MIME_TYPE,
    },
    {
        sourcePath:
            '/libs/extensions/vscode-basics/vscode.typescript/syntaxes/jsdoc.js.injection.tmLanguage.json',
        targetPath: '/workspace/vscode/jsdoc.js.injection.tmLanguage.json',
        mimeType: JSON_MIME_TYPE,
    },
    {
        sourcePath:
            '/libs/extensions/vscode-basics/vscode.typescript/syntaxes/jsdoc.ts.injection.tmLanguage.json',
        targetPath: '/workspace/vscode/jsdoc.ts.injection.tmLanguage.json',
        mimeType: JSON_MIME_TYPE,
    },
    {
        sourcePath: '/libs/extensions/vscode-basics/vscode.html/language-configuration.json',
        targetPath: '/workspace/vscode/html-language-configuration.json',
        mimeType: JSON_MIME_TYPE,
    },
    {
        sourcePath: '/libs/extensions/vscode-basics/vscode.html/syntaxes/html.tmLanguage.json',
        targetPath: '/workspace/vscode/html.tmLanguage.json',
        mimeType: JSON_MIME_TYPE,
    },
    {
        sourcePath: '/libs/extensions/vscode-basics/vscode.css/language-configuration.json',
        targetPath: '/workspace/vscode/css-language-configuration.json',
        mimeType: JSON_MIME_TYPE,
    },
    {
        sourcePath: '/libs/extensions/vscode-basics/vscode.css/syntaxes/css.tmLanguage.json',
        targetPath: '/workspace/vscode/css.tmLanguage.json',
        mimeType: JSON_MIME_TYPE,
    },
];

export const LWC_SNIPPET_ASSETS = [
    {
        sourcePath: '/libs/extensions/salesforce-lwc/snippets/lwc-js.json',
        targetPath: '/workspace/vscode/lwc-js.code-snippets',
        mimeType: JSON_MIME_TYPE,
    },
    {
        sourcePath: '/libs/extensions/salesforce-lwc/snippets/lwc-html.json',
        targetPath: '/workspace/vscode/lwc-html.code-snippets',
        mimeType: JSON_MIME_TYPE,
    },
];
