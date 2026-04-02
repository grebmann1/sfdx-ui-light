import { createToolingClient } from 'vscode/toolingApi';
import { createMetadataApiClient, unzipRetrieveZip, zipUnpackagedFiles } from 'vscode/metadataApi';
import { hashText, loadSourceTracking, pickRemoteStamp, saveSourceTracking } from 'vscode/sourceTracking';
import { getConfigurations, OAUTH_TYPES } from 'core/connector';
import {
    createBashInstance,
    createShellRunner,
    getApexExecutionExitCode,
    registerSalesforceShellCommands,
} from 'core/bash';
import {
    deriveWorkspaceRootFromConnection,
    loadStoredConnection,
} from '../../workbench/activeConnection.js';
import {
    clearActiveConnection,
    connectUsingSharedConfiguration,
    getConnectionAuthType,
    isAuthError,
    persistActiveConnection,
    refreshStoredConnection,
    resolveStoredConnection,
    toStoredConnectionFromConnector,
} from '../../workbench/sharedConnection.js';

export const EXTENSION_ID = 'salesforce.sf-metadata';

const AUTO_DEPLOY_KEY = 'sf_ext_autoDeployOnSave';

const config = {
    name: 'sf-metadata',
    displayName: 'Salesforce Metadata (Workbench)',
    description: 'Fetch Salesforce metadata into the workbench Explorer',
    version: '0.0.2',
    publisher: 'salesforce',
    license: 'MIT',
    engines: { vscode: '*' },
    activationEvents: ['*'],
    contributes: {
        viewsContainers: {
            panel: [
                {
                    id: 'salesforcePanel',
                    title: 'Salesforce',
                    icon: '/workspace/salesforce-panel-icon.svg',
                },
            ],
        },
        views: {
            salesforcePanel: [
                {
                    id: 'salesforceMetadata.salesforcePanel',
                    name: 'Salesforce',
                },
                {
                    id: 'salesforceMetadata.schemaExplorer',
                    name: 'Schema',
                },
            ],
        },
        languages: [
            {
                id: 'apex',
                aliases: ['Apex'],
                extensions: ['.cls', '.trigger'],
                configuration: '/workspace/apex.configuration.json',
            },
            { id: 'soql', aliases: ['SOQL'], extensions: ['.soql'] },
            // Ensure syntax highlighting works even when the web extension host is disabled.
            { id: 'javascript', aliases: ['JavaScript'], extensions: ['.js', '.mjs', '.cjs'], configuration: '/workspace/javascript-language-configuration.json' },
            { id: 'javascriptreact', aliases: ['JavaScript React'], extensions: ['.jsx'], configuration: '/workspace/javascript-language-configuration.json' },
            { id: 'typescript', aliases: ['TypeScript'], extensions: ['.ts'], configuration: '/workspace/typescript-language-configuration.json' },
            { id: 'typescriptreact', aliases: ['TypeScript React'], extensions: ['.tsx'], configuration: '/workspace/typescript-language-configuration.json' },
            { id: 'html', aliases: ['HTML'], extensions: ['.html', '.htm'], configuration: '/workspace/html-language-configuration.json' },
            { id: 'css', aliases: ['CSS'], extensions: ['.css'], configuration: '/workspace/css-language-configuration.json' },
        ],
        grammars: [
            {
                language: 'apex',
                scopeName: 'source.apex',
                path: '/workspace/apex.tmLanguage',
            },
            // Soql grammar is included to support embedded injections from the Apex grammar.
            {
                language: 'soql',
                scopeName: 'source.soql',
                path: '/workspace/soql.tmLanguage',
            },
            // VS Code built-in language basics (TextMate grammars).
            { language: 'javascript', scopeName: 'source.js', path: '/workspace/JavaScript.tmLanguage.json' },
            { language: 'javascriptreact', scopeName: 'source.js.jsx', path: '/workspace/JavaScriptReact.tmLanguage.json' },
            { language: 'typescript', scopeName: 'source.ts', path: '/workspace/TypeScript.tmLanguage.json' },
            { language: 'typescriptreact', scopeName: 'source.tsx', path: '/workspace/TypeScriptReact.tmLanguage.json' },
            { language: 'html', scopeName: 'text.html.basic', path: '/workspace/html.tmLanguage.json' },
            { language: 'css', scopeName: 'source.css', path: '/workspace/css.tmLanguage.json' },
            // JSDoc injections (improves doc comment tokenization in JS/TS)
            { scopeName: 'documentation.injection.ts', path: '/workspace/jsdoc.ts.injection.tmLanguage.json', injectTo: ['source.ts', 'source.tsx'] },
            { scopeName: 'documentation.injection.js.jsx', path: '/workspace/jsdoc.js.injection.tmLanguage.json', injectTo: ['source.js', 'source.js.jsx'] },
        ],
        snippets: [
            { language: 'javascript', path: '/workspace/lwc-js.code-snippets' },
            { language: 'html', path: '/workspace/lwc-html.code-snippets' },
        ],
        commands: [
            { command: 'salesforceMetadata.connect', title: 'Salesforce: Connect' },
            { command: 'salesforceMetadata.fetchMetadata', title: 'Salesforce: Sync Project (fetch/update/delete)' },
            { command: 'salesforceMetadata.disconnect', title: 'Salesforce: Disconnect' },
            { command: 'salesforceMetadata.sourceStatus', title: 'Salesforce: Source Status (Tooling API)' },
            { command: 'salesforceMetadata.pullRemoteChanges', title: 'Salesforce: Pull Remote Changes (Tooling API)' },
            { command: 'salesforceMetadata.orgBrowser', title: 'Salesforce: Org Browser (Tooling API)' },
            { command: 'salesforceMetadata.retrieveManifest', title: 'Salesforce: Retrieve Source in Manifest (Tooling API)' },
            { command: 'salesforceMetadata.retrieveMetadataApi', title: 'Salesforce: Retrieve Source in Manifest (Metadata API)' },
            { command: 'salesforceMetadata.retrieveMetadataApiPick', title: 'Salesforce: Retrieve (Metadata API)…' },
            { command: 'salesforceMetadata.deployMetadataApi', title: 'Salesforce: Deploy (Metadata API)' },
            { command: 'salesforceMetadata.validateDeployMetadataApi', title: 'Salesforce: Validate Deploy (Metadata API)' },
            { command: 'salesforceMetadata.runSoqlQuery', title: 'Salesforce: Run SOQL Query (REST)' },
            { command: 'salesforceMetadata.runToolingQuery', title: 'Salesforce: Run Tooling Query (Tooling API)' },
            { command: 'salesforceMetadata.openSoqlScratch', title: 'Salesforce: Open SOQL Scratch' },
            { command: 'salesforceMetadata.refreshSchemaCache', title: 'Salesforce: Refresh Schema Cache' },
            { command: 'salesforceMetadata.executeAnonymous', title: 'Salesforce: Execute Anonymous Apex (Tooling API)' },
            { command: 'salesforceMetadata.runApexTests', title: 'Salesforce: Run Apex Tests (Tooling API)' },
            { command: 'salesforceMetadata.enableDebugLogs', title: 'Salesforce: Enable Debug Logs (Tooling API)' },
            { command: 'salesforceMetadata.openDebugLogs', title: 'Salesforce: Open Debug Logs (Tooling API)' },
            { command: 'salesforceMetadata.compareOrgs', title: 'Salesforce: Compare Two Orgs (Tooling API)' },
            { command: 'salesforceMetadata.whereUsed', title: 'Salesforce: Where Used / Dependencies (Tooling API)' },
            { command: 'salesforceMetadata.diffCurrentFile', title: 'Salesforce: Diff Current File (local vs org)' },
            { command: 'salesforceMetadata.showOutput', title: 'Salesforce: Show Output (Workbench)' },
            { command: 'salesforceMetadata.installExtensions', title: 'Salesforce: Install Linting/Language Extensions (Open VSX)' },
            { command: 'salesforceMetadata.lintCurrentFile', title: 'Salesforce: Lint Current File (LWC ESLint)' },
            { command: 'salesforceMetadata.deployCurrentFile', title: 'Salesforce: Deploy Current File (Tooling API)' },
            { command: 'salesforceMetadata.fetchCurrentFile', title: 'Salesforce: Fetch Current File (Tooling API)' },
            { command: 'salesforceMetadata.deployChangedFiles', title: 'Salesforce: Deploy Changed Files (Tooling API)' },
            { command: 'salesforceMetadata.toggleAutoDeploy', title: 'Salesforce: Toggle Auto Deploy on Save' },
            { command: 'salesforceMetadata.refreshProject', title: 'Salesforce: Refresh Project (alias of Sync Project)' },
            { command: 'salesforceMetadata.openNamespaceReport', title: 'Salesforce: Open Namespace/Managed Report' },
            { command: 'salesforceMetadata.openShellTerminal', title: 'Salesforce: Open Shell Terminal' },
            { command: 'salesforceMetadata.runShellCommand', title: 'Salesforce: Run Shell Command' },
        ],
        menus: {
            commandPalette: [
                { command: 'salesforceMetadata.connect' },
                { command: 'salesforceMetadata.fetchMetadata' },
                { command: 'salesforceMetadata.disconnect' },
                { command: 'salesforceMetadata.sourceStatus' },
                { command: 'salesforceMetadata.pullRemoteChanges' },
                { command: 'salesforceMetadata.orgBrowser' },
                { command: 'salesforceMetadata.retrieveManifest' },
                { command: 'salesforceMetadata.retrieveMetadataApi' },
                { command: 'salesforceMetadata.retrieveMetadataApiPick' },
                { command: 'salesforceMetadata.deployMetadataApi' },
                { command: 'salesforceMetadata.validateDeployMetadataApi' },
                { command: 'salesforceMetadata.runSoqlQuery' },
                { command: 'salesforceMetadata.runToolingQuery' },
                { command: 'salesforceMetadata.openSoqlScratch' },
                { command: 'salesforceMetadata.refreshSchemaCache' },
                { command: 'salesforceMetadata.executeAnonymous' },
                { command: 'salesforceMetadata.runApexTests' },
                { command: 'salesforceMetadata.enableDebugLogs' },
                { command: 'salesforceMetadata.openDebugLogs' },
                { command: 'salesforceMetadata.compareOrgs' },
                { command: 'salesforceMetadata.whereUsed' },
                { command: 'salesforceMetadata.diffCurrentFile' },
                { command: 'salesforceMetadata.showOutput' },
                { command: 'salesforceMetadata.installExtensions' },
                { command: 'salesforceMetadata.lintCurrentFile' },
                { command: 'salesforceMetadata.deployCurrentFile' },
                { command: 'salesforceMetadata.fetchCurrentFile' },
                { command: 'salesforceMetadata.deployChangedFiles' },
                { command: 'salesforceMetadata.toggleAutoDeploy' },
                { command: 'salesforceMetadata.refreshProject' },
                { command: 'salesforceMetadata.openNamespaceReport' },
                { command: 'salesforceMetadata.openShellTerminal' },
                { command: 'salesforceMetadata.runShellCommand' },
            ],
            'editor/context': [
                // Keep editor context menu minimal & high-signal.
                { command: 'salesforceMetadata.fetchMetadata' },
                { command: 'salesforceMetadata.fetchCurrentFile' },
                { command: 'salesforceMetadata.diffCurrentFile' },
                { command: 'salesforceMetadata.deployCurrentFile' },
            ],
        },
    },
};

export async function loadExtension() {
    const filesOrContents = new Map();

    // Panel icon for the Salesforce view.
    try {
        const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
  <path fill="#00A1E0" d="M12 2c-2.7 0-5.1 1.3-6.7 3.3C4.5 5.1 3.8 5 3 5 1.3 5 0 6.3 0 8c0 1.5 1 2.7 2.4 3 0 .3-.1.7-.1 1 0 4.9 4 9 8.9 9 2.2 0 4.2-.8 5.8-2.1.4.1.8.1 1.2.1 2.2 0 4-1.8 4-4 0-.4-.1-.8-.2-1.2 1.1-.7 1.9-1.9 1.9-3.3 0-2.2-1.8-4-4-4-.3 0-.6 0-.9.1C18.3 3.7 15.4 2 12 2z"/>
</svg>`;
        filesOrContents.set(
            '/workspace/salesforce-panel-icon.svg',
            URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
        );
    } catch {
        // ignore
    }

    // Vendor grammar assets (copied from the Salesforce Apex VSIX into playground/assets)
    // and expose them to the extension host from /workspace.
    try {
        const [apexGrammar, soqlGrammar, apexConfig] = await Promise.all([
            fetch('/libs/extensions/salesforce-apex/grammars/apex.tmLanguage').then((r) => r.text()),
            fetch('/libs/extensions/salesforce-apex/grammars/soql.tmLanguage').then((r) => r.text()),
            fetch('/libs/extensions/salesforce-apex/syntaxes/apex.configuration.json').then((r) => r.text()),
        ]);

        filesOrContents.set(
            '/workspace/apex.tmLanguage',
            URL.createObjectURL(new Blob([apexGrammar], { type: 'application/xml' }))
        );
        filesOrContents.set(
            '/workspace/soql.tmLanguage',
            URL.createObjectURL(new Blob([soqlGrammar], { type: 'application/xml' }))
        );
        filesOrContents.set(
            '/workspace/apex.configuration.json',
            URL.createObjectURL(new Blob([apexConfig], { type: 'application/json' }))
        );
    } catch {
        // If assets aren't present, Apex highlighting will degrade gracefully.
    }

    // VS Code built-in grammars/configs (vendored from Open VSX).
    try {
        const [
            jsConfig,
            jsGrammar,
            jsxGrammar,
            tsConfig,
            tsGrammar,
            tsxGrammar,
            jsdocJsInjection,
            jsdocTsInjection,
            htmlConfig,
            htmlGrammar,
            cssConfig,
            cssGrammar,
        ] = await Promise.all([
            fetch('/libs/extensions/vscode-basics/vscode.javascript/javascript-language-configuration.json').then((r) => r.text()),
            fetch('/libs/extensions/vscode-basics/vscode.javascript/syntaxes/JavaScript.tmLanguage.json').then((r) => r.text()),
            fetch('/libs/extensions/vscode-basics/vscode.javascript/syntaxes/JavaScriptReact.tmLanguage.json').then((r) => r.text()),
            fetch('/libs/extensions/vscode-basics/vscode.typescript/language-configuration.json').then((r) => r.text()),
            fetch('/libs/extensions/vscode-basics/vscode.typescript/syntaxes/TypeScript.tmLanguage.json').then((r) => r.text()),
            fetch('/libs/extensions/vscode-basics/vscode.typescript/syntaxes/TypeScriptReact.tmLanguage.json').then((r) => r.text()),
            fetch('/libs/extensions/vscode-basics/vscode.typescript/syntaxes/jsdoc.js.injection.tmLanguage.json').then((r) => r.text()),
            fetch('/libs/extensions/vscode-basics/vscode.typescript/syntaxes/jsdoc.ts.injection.tmLanguage.json').then((r) => r.text()),
            fetch('/libs/extensions/vscode-basics/vscode.html/language-configuration.json').then((r) => r.text()),
            fetch('/libs/extensions/vscode-basics/vscode.html/syntaxes/html.tmLanguage.json').then((r) => r.text()),
            fetch('/libs/extensions/vscode-basics/vscode.css/language-configuration.json').then((r) => r.text()),
            fetch('/libs/extensions/vscode-basics/vscode.css/syntaxes/css.tmLanguage.json').then((r) => r.text()),
        ]);

        filesOrContents.set('/workspace/javascript-language-configuration.json', URL.createObjectURL(new Blob([jsConfig], { type: 'application/json' })));
        filesOrContents.set('/workspace/JavaScript.tmLanguage.json', URL.createObjectURL(new Blob([jsGrammar], { type: 'application/json' })));
        filesOrContents.set('/workspace/JavaScriptReact.tmLanguage.json', URL.createObjectURL(new Blob([jsxGrammar], { type: 'application/json' })));

        filesOrContents.set('/workspace/typescript-language-configuration.json', URL.createObjectURL(new Blob([tsConfig], { type: 'application/json' })));
        filesOrContents.set('/workspace/TypeScript.tmLanguage.json', URL.createObjectURL(new Blob([tsGrammar], { type: 'application/json' })));
        filesOrContents.set('/workspace/TypeScriptReact.tmLanguage.json', URL.createObjectURL(new Blob([tsxGrammar], { type: 'application/json' })));
        filesOrContents.set('/workspace/jsdoc.js.injection.tmLanguage.json', URL.createObjectURL(new Blob([jsdocJsInjection], { type: 'application/json' })));
        filesOrContents.set('/workspace/jsdoc.ts.injection.tmLanguage.json', URL.createObjectURL(new Blob([jsdocTsInjection], { type: 'application/json' })));

        filesOrContents.set('/workspace/html-language-configuration.json', URL.createObjectURL(new Blob([htmlConfig], { type: 'application/json' })));
        filesOrContents.set('/workspace/html.tmLanguage.json', URL.createObjectURL(new Blob([htmlGrammar], { type: 'application/json' })));

        filesOrContents.set('/workspace/css-language-configuration.json', URL.createObjectURL(new Blob([cssConfig], { type: 'application/json' })));
        filesOrContents.set('/workspace/css.tmLanguage.json', URL.createObjectURL(new Blob([cssGrammar], { type: 'application/json' })));
    } catch {
        // ignore
    }

    // LWC snippets (vendored from the official Salesforce LWC VSIX).
    try {
        const [lwcJsSnippets, lwcHtmlSnippets] = await Promise.all([
            fetch('/libs/extensions/salesforce-lwc/snippets/lwc-js.json').then((r) => r.text()),
            fetch('/libs/extensions/salesforce-lwc/snippets/lwc-html.json').then((r) => r.text()),
        ]);
        filesOrContents.set(
            '/workspace/lwc-js.code-snippets',
            URL.createObjectURL(new Blob([lwcJsSnippets], { type: 'application/json' }))
        );
        filesOrContents.set(
            '/workspace/lwc-html.code-snippets',
            URL.createObjectURL(new Blob([lwcHtmlSnippets], { type: 'application/json' }))
        );
    } catch {
        // ignore
    }

    return { config, filesOrContents };
}

function safeSeg(s) {
    return String(s || 'unnamed').replace(/[\\/:*?"<>|]/g, '_').trim();
}

function auraFilename(bundleName, defType, format) {
    const b = safeSeg(bundleName);
    const t = String(defType || '').toUpperCase();
    if (t === 'APPLICATION') return `${b}.app`;
    if (t === 'COMPONENT') return `${b}.cmp`;
    if (t === 'EVENT') return `${b}.evt`;
    if (t === 'INTERFACE') return `${b}.intf`;
    if (t === 'TOKENS') return `${b}.tokens`;
    if (t === 'TESTSUITE') return `${b}.testSuite`;
    if (t === 'STYLE') return `${b}.css`;
    if (t === 'CONTROLLER') return `${b}Controller.js`;
    if (t === 'HELPER') return `${b}Helper.js`;
    if (t === 'RENDERER') return `${b}Renderer.js`;
    if (t === 'DESIGN') return `${b}.design`;
    if (t === 'DOCUMENTATION') return `${b}.auradoc`;
    if (t === 'SVG') return `${b}.svg`;
    const ext = String(format || '').toUpperCase() === 'JS' ? 'js' : String(format || '').toUpperCase() === 'CSS' ? 'css' : 'txt';
    return `${b}.${t.toLowerCase()}.${ext}`;
}

async function ensureDir(vscode, uri) {
    try {
        await vscode.workspace.fs.createDirectory(uri);
    } catch {
        // ignore
    }
}

async function listFilesAndDirsRecursive(vscode, dirUri) {
    const files = [];
    const dirs = [];

    async function walk(uri) {
        let entries;
        try {
            entries = await vscode.workspace.fs.readDirectory(uri);
        } catch {
            return;
        }
        for (const [name, type] of entries) {
            const child = vscode.Uri.joinPath(uri, name);
            const t = Number(type);
            const isDir = vscode.FileType?.Directory ? (t & vscode.FileType.Directory) === vscode.FileType.Directory : t === 2;
            if (isDir) {
                dirs.push(child);
                // eslint-disable-next-line no-await-in-loop
                await walk(child);
            } else {
                files.push(child);
            }
        }
    }

    await walk(dirUri);
    return { files, dirs };
}

// Persistent cache for workspace metadata files (IndexedDB).
const SF_CACHE = {
    dbName: 'sf_workbench_cache_v1',
    storeName: 'files',
};

function looksLikeBadLwcPath(p) {
    // Old bug produced nested duplicate LWC bundle paths under force-app/main.
    return /\/force-app\/main\/[^/]+\/lwc\/[^/]+\/lwc\//.test(String(p || ''));
}

function shouldCachePath(path) {
    const p = String(path || '');
    if (looksLikeBadLwcPath(p)) return false;
    return p.includes('/force-app/main/') || p.includes('/.salesforce/');
}

function openCacheDb() {
    return new Promise((resolve, reject) => {
        if (typeof indexedDB === 'undefined') {
            reject(new Error('IndexedDB not available'));
            return;
        }
        const req = indexedDB.open(SF_CACHE.dbName, 1);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(SF_CACHE.storeName)) {
                db.createObjectStore(SF_CACHE.storeName, { keyPath: 'path' });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error || new Error('Failed to open cache db'));
    });
}

async function cachePutFile(path, text) {
    if (!shouldCachePath(path)) return;
    let db;
    try {
        db = await openCacheDb();
    } catch {
        return;
    }
    await new Promise((resolve, reject) => {
        const tx = db.transaction(SF_CACHE.storeName, 'readwrite');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        const store = tx.objectStore(SF_CACHE.storeName);
        store.put({ path, text: String(text ?? ''), updatedAt: Date.now() });
    }).finally(() => {
        try {
            db.close();
        } catch {
            // ignore
        }
    });
}

async function cacheDeleteFile(path) {
    if (!shouldCachePath(path)) return;
    let db;
    try {
        db = await openCacheDb();
    } catch {
        return;
    }
    await new Promise((resolve, reject) => {
        const tx = db.transaction(SF_CACHE.storeName, 'readwrite');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        const store = tx.objectStore(SF_CACHE.storeName);
        store.delete(String(path || ''));
    }).finally(() => {
        try {
            db.close();
        } catch {
            // ignore
        }
    });
}

async function cacheListFiles(prefix) {
    let db;
    try {
        db = await openCacheDb();
    } catch {
        return [];
    }
    return await new Promise((resolve, reject) => {
        const out = [];
        const tx = db.transaction(SF_CACHE.storeName, 'readonly');
        tx.oncomplete = () => resolve(out);
        tx.onerror = () => reject(tx.error);
        const store = tx.objectStore(SF_CACHE.storeName);
        const req = store.openCursor();
        req.onsuccess = () => {
            const cursor = req.result;
            if (!cursor) return;
            const v = cursor.value;
            if (!prefix || String(v?.path || '').startsWith(prefix)) out.push(v);
            cursor.continue();
        };
        req.onerror = () => reject(req.error);
    }).finally(() => {
        try {
            db.close();
        } catch {
            // ignore
        }
    });
}

async function restoreCachedFilesToWorkspace(vscode) {
    const files = await cacheListFiles(`${getWorkspaceRootPath(vscode).replace(/\/+$/, '')}/`);
    if (!files.length) return;

    // Restore in small batches to avoid blocking the UI.
    const chunkSize = 25;
    for (let i = 0; i < files.length; i += chunkSize) {
        const chunk = files.slice(i, i + chunkSize);
        // eslint-disable-next-line no-await-in-loop
        await Promise.all(
            chunk.map(async (f) => {
                try {
                    if (looksLikeBadLwcPath(f.path)) return;
                    const uri = vscode.Uri.file(f.path);
                    await ensureDir(vscode, parentUri(uri));
                    const bytes = new TextEncoder().encode(f.text || '');
                    await vscode.workspace.fs.writeFile(uri, bytes);
                } catch {
                    // ignore
                }
            })
        );
    }
}

function lwcExtFromFormat(format) {
    const f = String(format || '').toUpperCase();
    if (f === 'JS') return 'js';
    if (f === 'HTML') return 'html';
    if (f === 'CSS') return 'css';
    if (f === 'XML') return 'xml';
    if (f === 'SVG') return 'svg';
    if (f === 'JSON') return 'json';
    return 'txt';
}

function normalizeLwcResourceRelPath(bundleName, filePath, format) {
    const bn = String(bundleName || '');
    let rel = String(filePath || '').replace(/^\/+/, '');

    // Tooling API often returns: lwc/<bundle>/<file>
    if (/^lwc\//i.test(rel)) rel = rel.slice(4);
    if (bn && rel.toLowerCase().startsWith(`${bn.toLowerCase()}/`)) rel = rel.slice(bn.length + 1);
    rel = rel.replace(/^\/+/, '');

    if (!rel) {
        return `${bn || 'component'}.${lwcExtFromFormat(format)}`;
    }
    return rel;
}

function parentUri(uri) {
    const p = uri.path || '';
    const idx = p.lastIndexOf('/');
    const parentPath = idx > 0 ? p.slice(0, idx) : '/';
    return uri.with({ path: parentPath });
}

async function writeTextFile(vscode, uri, text, { skipCache } = {}) {
    await ensureDir(vscode, parentUri(uri));
    const bytes = new TextEncoder().encode(text || '');
    await vscode.workspace.fs.writeFile(uri, bytes);
    if (!skipCache) {
        try {
            await cachePutFile(uri.path, text || '');
        } catch {
            // ignore
        }
    }
}

async function writeBytesFile(vscode, uri, bytes) {
    await ensureDir(vscode, parentUri(uri));
    const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
    await vscode.workspace.fs.writeFile(uri, b);
}

async function fetchAndPopulateWorkspace(vscode, client) {
    const mainRoot = getWorkspaceMainRootUri(vscode);
    const root = getWorkspaceDefaultRootUri(vscode);

    const classesDir = vscode.Uri.joinPath(root, 'classes');
    const triggersDir = vscode.Uri.joinPath(root, 'triggers');
    const lwcDir = vscode.Uri.joinPath(root, 'lwc');
    const auraDir = vscode.Uri.joinPath(root, 'aura');
    const sfDir = getSalesforceStateDirUri(vscode);

    await Promise.all([
        ensureDir(vscode, classesDir),
        ensureDir(vscode, triggersDir),
        ensureDir(vscode, lwcDir),
        ensureDir(vscode, auraDir),
        ensureDir(vscode, mainRoot),
        ensureDir(vscode, sfDir),
    ]);

    function isEditableManagedState(rec) {
        // Many Tooling metadata objects expose ManageableState/IsProtected.
        // For our purposes: treat "installed" (managed packages) and "beta" as non-editable.
        const ms = String(rec?.ManageableState || '').toLowerCase();
        if (!ms) return true; // field not present
        return ms === 'unmanaged';
    }
    function isProtected(rec) {
        return rec?.IsProtected === true;
    }
    function namespacePrefix(rec) {
        return rec?.NamespacePrefix ? String(rec.NamespacePrefix) : '';
    }

    async function toolingQueryAllWithFallback(primary, fallback) {
        try {
            return await client.toolingQueryAll(primary);
        } catch {
            return await client.toolingQueryAll(fallback);
        }
    }

    const [classes, triggers, lwcBundles, auraBundles] = await Promise.all([
        toolingQueryAllWithFallback(
            'SELECT Id, Name, Body, NamespacePrefix, ManageableState, IsProtected, LastModifiedDate, SystemModstamp FROM ApexClass ORDER BY Name',
            'SELECT Id, Name, Body, NamespacePrefix FROM ApexClass ORDER BY Name'
        ),
        toolingQueryAllWithFallback(
            'SELECT Id, Name, Body, NamespacePrefix, ManageableState, IsProtected, LastModifiedDate, SystemModstamp FROM ApexTrigger ORDER BY Name',
            'SELECT Id, Name, Body, NamespacePrefix FROM ApexTrigger ORDER BY Name'
        ),
        toolingQueryAllWithFallback(
            'SELECT Id, DeveloperName, NamespacePrefix, ManageableState, IsProtected FROM LightningComponentBundle ORDER BY DeveloperName',
            'SELECT Id, DeveloperName, NamespacePrefix FROM LightningComponentBundle ORDER BY DeveloperName'
        ),
        toolingQueryAllWithFallback(
            'SELECT Id, DeveloperName, NamespacePrefix, ManageableState, IsProtected FROM AuraDefinitionBundle ORDER BY DeveloperName',
            'SELECT Id, DeveloperName, NamespacePrefix FROM AuraDefinitionBundle ORDER BY DeveloperName'
        ),
    ]);

    const namespaceReport = {
        generatedAt: new Date().toISOString(),
        instanceUrl: client.instanceUrl,
        apiVersion: client.apiVersion,
        excluded: {
            ApexClass: [],
            ApexTrigger: [],
            LightningComponentBundle: [],
            AuraDefinitionBundle: [],
        },
        namespaces: {},
    };

    function noteNamespace(ns) {
        const key = String(ns || '').trim();
        if (!key) return;
        namespaceReport.namespaces[key] = namespaceReport.namespaces[key] || { count: 0 };
        namespaceReport.namespaces[key].count += 1;
    }

    async function cacheDeletePrefix(prefix) {
        const files = await cacheListFiles(prefix);
        await Promise.all(
            files.map(async (f) => {
                try {
                    await cacheDeleteFile(f?.path);
                } catch {
                    // ignore
                }
            })
        );
    }

    async function excludePath(path, reason, meta) {
        try {
            await vscode.workspace.fs.delete(vscode.Uri.file(path), { recursive: false });
        } catch {
            // ignore
        }
        try {
            await cacheDeleteFile(path);
        } catch {
            // ignore
        }
        const ns = meta?.NamespacePrefix ? String(meta.NamespacePrefix) : '';
        if (ns) {
            namespaceReport.namespaces[ns] = namespaceReport.namespaces[ns] || { count: 0 };
            namespaceReport.namespaces[ns].count += 1;
        }
        return {
            path,
            reason,
            ...(ns ? { namespace: ns } : {}),
            ...(meta?.Id ? { id: meta.Id } : {}),
            ...(meta?.Name ? { name: meta.Name } : {}),
        };
    }

    const toolingMap = {
        generatedAt: new Date().toISOString(),
        instanceUrl: client.instanceUrl,
        apiVersion: client.apiVersion,
        items: {},
    };

    const sourceTracking = {
        generatedAt: new Date().toISOString(),
        instanceUrl: client.instanceUrl,
        apiVersion: client.apiVersion,
        items: {},
    };

    function trackFile(path, entry, text, rec) {
        try {
            if (!path || !entry?.type || !entry?.id) return;
            sourceTracking.items[path] = {
                type: entry.type,
                id: entry.id,
                ...(entry.namespace ? { namespace: entry.namespace } : {}),
                ...(entry.readOnly ? { readOnly: true } : {}),
                remoteStamp: pickRemoteStamp(rec),
                hash: hashText(text ?? ''),
            };
        } catch {
            // ignore
        }
    }

    const desiredPaths = new Set();

    function nsRoot(ns) {
        return vscode.Uri.joinPath(mainRoot, safeSeg(ns));
    }

    async function purgeOldDefaultPath(uri, reason, meta) {
        // If we previously wrote this under /default (older behavior), remove it + cache entry.
        try {
            await vscode.workspace.fs.delete(uri, { recursive: false });
        } catch {
            // ignore
        }
        try {
            await cacheDeleteFile(uri.path);
        } catch {
            // ignore
        }
        if (reason) {
            try {
                await excludePath(uri.path, reason, meta);
            } catch {
                // ignore
            }
        }
    }

    await Promise.all(classes.map(async (c) => {
        const ns = namespacePrefix(c);
        const defaultUri = vscode.Uri.joinPath(classesDir, `${safeSeg(c.Name)}.cls`);

        if (ns) {
            await purgeOldDefaultPath(defaultUri);
            if (!c?.Body) return;
            const nsClassesDir = vscode.Uri.joinPath(nsRoot(ns), 'classes');
            await ensureDir(vscode, nsClassesDir);
            const uri = vscode.Uri.joinPath(nsClassesDir, `${safeSeg(c.Name)}.cls`);
            await writeTextFile(vscode, uri, c.Body || '');
            desiredPaths.add(uri.path);
            noteNamespace(ns);
            toolingMap.items[uri.path] = { type: 'ApexClass', id: c.Id, namespace: ns, readOnly: true };
            trackFile(uri.path, toolingMap.items[uri.path], c.Body || '', c);
            return;
        }

        if (isProtected(c) || !isEditableManagedState(c) || !c?.Body) {
            namespaceReport.excluded.ApexClass.push(
                await excludePath(defaultUri.path, isProtected(c) ? 'protected' : !isEditableManagedState(c) ? 'managed' : 'no-body', c)
            );
            return;
        }

        await writeTextFile(vscode, defaultUri, c.Body || '');
        desiredPaths.add(defaultUri.path);
        toolingMap.items[defaultUri.path] = { type: 'ApexClass', id: c.Id };
        trackFile(defaultUri.path, toolingMap.items[defaultUri.path], c.Body || '', c);
    }));
    await Promise.all(triggers.map(async (t) => {
        const ns = namespacePrefix(t);
        const defaultUri = vscode.Uri.joinPath(triggersDir, `${safeSeg(t.Name)}.trigger`);

        if (ns) {
            await purgeOldDefaultPath(defaultUri);
            if (!t?.Body) return;
            const nsTriggersDir = vscode.Uri.joinPath(nsRoot(ns), 'triggers');
            await ensureDir(vscode, nsTriggersDir);
            const uri = vscode.Uri.joinPath(nsTriggersDir, `${safeSeg(t.Name)}.trigger`);
            await writeTextFile(vscode, uri, t.Body || '');
            desiredPaths.add(uri.path);
            noteNamespace(ns);
            toolingMap.items[uri.path] = { type: 'ApexTrigger', id: t.Id, namespace: ns, readOnly: true };
            trackFile(uri.path, toolingMap.items[uri.path], t.Body || '', t);
            return;
        }

        if (isProtected(t) || !isEditableManagedState(t) || !t?.Body) {
            namespaceReport.excluded.ApexTrigger.push(
                await excludePath(defaultUri.path, isProtected(t) ? 'protected' : !isEditableManagedState(t) ? 'managed' : 'no-body', t)
            );
            return;
        }

        await writeTextFile(vscode, defaultUri, t.Body || '');
        desiredPaths.add(defaultUri.path);
        toolingMap.items[defaultUri.path] = { type: 'ApexTrigger', id: t.Id };
        trackFile(defaultUri.path, toolingMap.items[defaultUri.path], t.Body || '', t);
    }));

    for (const b of (lwcBundles || [])) {
        const ns = namespacePrefix(b);
        const bundleName = safeSeg(b.DeveloperName);

        if (ns) {
            // Remove any previously-written default bundle folder (older behavior).
            try {
                const oldDefaultBundlePath = vscode.Uri.joinPath(lwcDir, bundleName);
                await vscode.workspace.fs.delete(oldDefaultBundlePath, { recursive: true });
                await cacheDeletePrefix(oldDefaultBundlePath.path.endsWith('/') ? oldDefaultBundlePath.path : `${oldDefaultBundlePath.path}/`);
            } catch {
                // ignore
            }

            const nsLwcDir = vscode.Uri.joinPath(nsRoot(ns), 'lwc');
            const bundlePath = vscode.Uri.joinPath(nsLwcDir, bundleName);
            await ensureDir(vscode, bundlePath);

            // Cleanup from older path bug: remove nested "lwc/" folder inside the bundle.
            try {
                await vscode.workspace.fs.delete(vscode.Uri.joinPath(bundlePath, 'lwc'), { recursive: true });
            } catch {
                // ignore
            }

            const resources = await toolingQueryAllWithFallback(
                `SELECT Id, FilePath, Format, Source, LastModifiedDate, SystemModstamp FROM LightningComponentResource WHERE LightningComponentBundleId='${b.Id}' ORDER BY FilePath`,
                `SELECT Id, FilePath, Format, Source FROM LightningComponentResource WHERE LightningComponentBundleId='${b.Id}' ORDER BY FilePath`
            );
            for (const r of resources) {
                if (!r?.Source) continue;
                const rel = normalizeLwcResourceRelPath(bundleName, r.FilePath, r.Format);
                const parts = rel
                    .split('/')
                    .map(safeSeg)
                    .filter((p) => p && p !== '.' && p !== '..');
                const target = vscode.Uri.joinPath(bundlePath, ...parts);
                await writeTextFile(vscode, target, r.Source || '');
                desiredPaths.add(target.path);
                noteNamespace(ns);
                toolingMap.items[target.path] = {
                    type: 'LightningComponentResource',
                    id: r.Id,
                    format: r.Format,
                    filePath: r.FilePath,
                    namespace: ns,
                    readOnly: true,
                };
                trackFile(target.path, toolingMap.items[target.path], r.Source || '', r);
            }
            continue;
        }

        if (isProtected(b) || !isEditableManagedState(b)) {
            namespaceReport.excluded.LightningComponentBundle.push({ id: b?.Id, name: b?.DeveloperName, namespace: ns || undefined, reason: isProtected(b) ? 'protected' : 'managed' });
            // Purge any previously-cached/written bundle folder (from older fetches).
            try {
                const bundlePath = vscode.Uri.joinPath(lwcDir, bundleName);
                await vscode.workspace.fs.delete(bundlePath, { recursive: true });
                await cacheDeletePrefix(bundlePath.path.endsWith('/') ? bundlePath.path : `${bundlePath.path}/`);
            } catch {
                // ignore
            }
            continue;
        }

        const bundlePath = vscode.Uri.joinPath(lwcDir, bundleName);
        await ensureDir(vscode, bundlePath);

        // Cleanup from older path bug: remove nested "lwc/" folder inside the bundle.
        try {
            await vscode.workspace.fs.delete(vscode.Uri.joinPath(bundlePath, 'lwc'), { recursive: true });
        } catch {
            // ignore
        }

        const resources = await toolingQueryAllWithFallback(
            `SELECT Id, FilePath, Format, Source, LastModifiedDate, SystemModstamp FROM LightningComponentResource WHERE LightningComponentBundleId='${b.Id}' ORDER BY FilePath`,
            `SELECT Id, FilePath, Format, Source FROM LightningComponentResource WHERE LightningComponentBundleId='${b.Id}' ORDER BY FilePath`
        );
        for (const r of resources) {
            if (!r?.Source) continue;
            const rel = normalizeLwcResourceRelPath(bundleName, r.FilePath, r.Format);
            const parts = rel
                .split('/')
                .map(safeSeg)
                .filter((p) => p && p !== '.' && p !== '..');
            const target = vscode.Uri.joinPath(bundlePath, ...parts);
            await writeTextFile(vscode, target, r.Source || '');
            desiredPaths.add(target.path);
            toolingMap.items[target.path] = {
                type: 'LightningComponentResource',
                id: r.Id,
                format: r.Format,
                filePath: r.FilePath,
            };
            trackFile(target.path, toolingMap.items[target.path], r.Source || '', r);
        }
    }

    for (const b of (auraBundles || [])) {
        const ns = namespacePrefix(b);
        const bundleName = safeSeg(b.DeveloperName);

        if (ns) {
            // Remove any previously-written default bundle folder (older behavior).
            try {
                const oldDefaultBundlePath = vscode.Uri.joinPath(auraDir, bundleName);
                await vscode.workspace.fs.delete(oldDefaultBundlePath, { recursive: true });
                await cacheDeletePrefix(oldDefaultBundlePath.path.endsWith('/') ? oldDefaultBundlePath.path : `${oldDefaultBundlePath.path}/`);
            } catch {
                // ignore
            }

            const nsAuraDir = vscode.Uri.joinPath(nsRoot(ns), 'aura');
            const bundlePath = vscode.Uri.joinPath(nsAuraDir, bundleName);
            await ensureDir(vscode, bundlePath);
            const defs = await toolingQueryAllWithFallback(
                `SELECT Id, DefType, Format, Source, LastModifiedDate, SystemModstamp FROM AuraDefinition WHERE AuraDefinitionBundleId='${b.Id}' ORDER BY DefType`,
                `SELECT Id, DefType, Format, Source FROM AuraDefinition WHERE AuraDefinitionBundleId='${b.Id}' ORDER BY DefType`
            );
            const used = new Set();
            for (const d of defs) {
                if (!d?.Source) continue;
                let file = safeSeg(auraFilename(bundleName, d.DefType, d.Format));
                if (used.has(file)) file = `${file}.${String(d.Id || '').slice(-6)}`;
                used.add(file);
                const target = vscode.Uri.joinPath(bundlePath, file);
                await writeTextFile(vscode, target, d.Source || '');
                desiredPaths.add(target.path);
                noteNamespace(ns);
                toolingMap.items[target.path] = {
                    type: 'AuraDefinition',
                    id: d.Id,
                    defType: d.DefType,
                    format: d.Format,
                    namespace: ns,
                    readOnly: true,
                };
                trackFile(target.path, toolingMap.items[target.path], d.Source || '', d);
            }
            continue;
        }

        if (isProtected(b) || !isEditableManagedState(b)) {
            namespaceReport.excluded.AuraDefinitionBundle.push({ id: b?.Id, name: b?.DeveloperName, namespace: ns || undefined, reason: isProtected(b) ? 'protected' : 'managed' });
            // Purge any previously-cached/written bundle folder (from older fetches).
            try {
                const bundlePath = vscode.Uri.joinPath(auraDir, bundleName);
                await vscode.workspace.fs.delete(bundlePath, { recursive: true });
                await cacheDeletePrefix(bundlePath.path.endsWith('/') ? bundlePath.path : `${bundlePath.path}/`);
            } catch {
                // ignore
            }
            continue;
        }

        const bundlePath = vscode.Uri.joinPath(auraDir, bundleName);
        await ensureDir(vscode, bundlePath);
        const defs = await toolingQueryAllWithFallback(
            `SELECT Id, DefType, Format, Source, LastModifiedDate, SystemModstamp FROM AuraDefinition WHERE AuraDefinitionBundleId='${b.Id}' ORDER BY DefType`,
            `SELECT Id, DefType, Format, Source FROM AuraDefinition WHERE AuraDefinitionBundleId='${b.Id}' ORDER BY DefType`
        );
        const used = new Set();
        for (const d of defs) {
            if (!d?.Source) continue;
            let file = safeSeg(auraFilename(bundleName, d.DefType, d.Format));
            if (used.has(file)) file = `${file}.${String(d.Id || '').slice(-6)}`;
            used.add(file);
            const target = vscode.Uri.joinPath(bundlePath, file);
            await writeTextFile(vscode, target, d.Source || '');
            desiredPaths.add(target.path);
            toolingMap.items[target.path] = {
                type: 'AuraDefinition',
                id: d.Id,
                defType: d.DefType,
                format: d.Format,
            };
            trackFile(target.path, toolingMap.items[target.path], d.Source || '', d);
        }
    }

    // Sync cleanup: remove local files under the project root that are no longer present in the org snapshot.
    // This makes Refresh behave like a true "reconcile to server" operation.
    try {
        // Migration cleanup: remove legacy namespace folder if present.
        try {
            const legacy = vscode.Uri.joinPath(mainRoot, '__namespace__');
            await vscode.workspace.fs.delete(legacy, { recursive: true });
            await cacheDeletePrefix(legacy.path.endsWith('/') ? legacy.path : `${legacy.path}/`);
        } catch {
            // ignore
        }

        const projectRoot = mainRoot; // /workspace/force-app/main
        const { files, dirs } = await listFilesAndDirsRecursive(vscode, projectRoot);
        await Promise.all(
            files.map(async (uri) => {
                try {
                    if (!uri?.path?.startsWith(projectRoot.path)) return;
                    // Only reconcile the project structure we control.
                    if (!uri.path.includes('/force-app/main/')) return;
                    if (desiredPaths.has(uri.path)) return;
                    await vscode.workspace.fs.delete(uri, { recursive: false });
                    await cacheDeleteFile(uri.path);
                } catch {
                    // ignore
                }
            })
        );

        // Best-effort: delete empty directories bottom-up.
        const sortedDirs = dirs.slice().sort((a, b) => (b.path || '').length - (a.path || '').length);
        for (const d of sortedDirs) {
            try {
                // eslint-disable-next-line no-await-in-loop
                await vscode.workspace.fs.delete(d, { recursive: false });
            } catch {
                // ignore (likely not empty)
            }
        }
    } catch {
        // ignore
    }

    const index = {
        generatedAt: new Date().toISOString(),
        instanceUrl: client.instanceUrl,
        apiVersion: client.apiVersion,
        counts: {
            apexClasses: classes.length,
            apexTriggers: triggers.length,
            lwcBundles: lwcBundles.length,
            auraBundles: auraBundles.length,
        },
        excluded: {
            apexClasses: namespaceReport.excluded.ApexClass.length,
            apexTriggers: namespaceReport.excluded.ApexTrigger.length,
            lwcBundles: namespaceReport.excluded.LightningComponentBundle.length,
            auraBundles: namespaceReport.excluded.AuraDefinitionBundle.length,
        },
        namespaces: Object.keys(namespaceReport.namespaces || {}),
    };
    await writeTextFile(vscode, vscode.Uri.joinPath(sfDir, 'metadata-index.json'), JSON.stringify(index, null, 2));
    await writeTextFile(vscode, vscode.Uri.joinPath(sfDir, 'tooling-map.json'), JSON.stringify(toolingMap, null, 2));
    try {
        await saveSourceTracking(vscode, sourceTracking);
    } catch {
        // ignore
    }
    await writeTextFile(vscode, vscode.Uri.joinPath(sfDir, 'namespaces.json'), JSON.stringify(namespaceReport, null, 2));
}

function loadStoredConn() {
    return loadStoredConnection();
}

async function saveConn({
    instanceUrl,
    apiVersion,
    accessToken,
    authType,
    sharedAlias,
    oauthConnectionId,
    username,
    userId,
    orgId,
    workspaceRoot,
}) {
    await persistActiveConnection({
        instanceUrl,
        apiVersion,
        accessToken,
        authType,
        sharedAlias,
        oauthConnectionId,
        username,
        userId,
        orgId,
        workspaceRoot,
    });
}

async function clearConn() {
    await clearActiveConnection();
}

function getWorkspaceRootUri(vscode) {
    const folder = Array.isArray(vscode?.workspace?.workspaceFolders)
        ? vscode.workspace.workspaceFolders[0]
        : null;
    return folder?.uri || vscode.Uri.file('/workspace');
}

function getWorkspaceRootPath(vscode) {
    return getWorkspaceRootUri(vscode)?.path || '/workspace';
}

function getWorkspaceUri(vscode, relativePath = '') {
    const root = getWorkspaceRootUri(vscode);
    const segments = String(relativePath || '')
        .split('/')
        .filter(Boolean);
    return segments.length ? vscode.Uri.joinPath(root, ...segments) : root;
}

function getWorkspacePath(vscode, relativePath = '') {
    return getWorkspaceUri(vscode, relativePath).path;
}

function getWorkspaceMainRootUri(vscode) {
    return getWorkspaceUri(vscode, 'force-app/main');
}

function getWorkspaceDefaultRootUri(vscode) {
    return getWorkspaceUri(vscode, 'force-app/main/default');
}

function getSalesforceStateDirUri(vscode) {
    return getWorkspaceUri(vscode, '.salesforce');
}

function toWorkspaceRelativeLabel(vscode, path) {
    const root = `${getWorkspaceRootPath(vscode).replace(/\/+$/, '')}/`;
    const value = String(path || '');
    return value.startsWith(root) ? value.slice(root.length) : value;
}

function getConnectionTypeLabel(configuration) {
    switch (configuration?.credentialType) {
        case OAUTH_TYPES.OAUTH:
            return 'OAuth';
        case OAUTH_TYPES.SESSION:
            return 'Session';
        case OAUTH_TYPES.USERNAME:
            return 'Username';
        default:
            return 'Saved';
    }
}

async function listSharedConnectionEntries() {
    const configurations = await getConfigurations().catch(() => []);
    return (Array.isArray(configurations) ? configurations : [])
        .filter((item) => item?.alias && item?.instanceUrl)
        .map((item) => {
            let host = item.instanceUrl;
            try {
                host = new URL(item.instanceUrl).host;
            } catch {
                // ignore
            }
            return {
                label: item.username
                    ? `${item.username} (${host})`
                    : `${item.alias} (${host})`,
                description: getConnectionTypeLabel(item),
                detail: item.alias,
                host,
                configuration: item,
                _shared: true,
            };
        })
        .sort((a, b) => String(a.label || '').localeCompare(String(b.label || '')));
}

function reloadForConnectionWorkspaceIfNeeded(vscode, conn) {
    const currentRoot = getWorkspaceRootPath(vscode);
    const desiredRoot = conn?.workspaceRoot || deriveWorkspaceRootFromConnection(conn, currentRoot);
    if (!desiredRoot || desiredRoot === currentRoot) {
        return false;
    }
    window.location.reload();
    return true;
}

function setStatus(statusItem, conn) {
    if (!statusItem) return;
    if (!conn?.instanceUrl || !conn?.accessToken) {
        statusItem.text = '$(cloud) SF: Disconnected';
        statusItem.tooltip = 'Click to connect to Salesforce';
        statusItem.command = 'salesforceMetadata.connect';
        return;
    }
    try {
        const host = new URL(conn.instanceUrl).host;
        const who = conn.username ? ` (${conn.username})` : '';
        statusItem.text = `$(cloud) SF: ${host}${who}`;
        const auth = conn.authType ? `Auth: ${conn.authType}` : 'Auth: unknown';
        const ids = [conn.orgId ? `Org: ${conn.orgId}` : '', conn.userId ? `User: ${conn.userId}` : ''].filter(Boolean).join('\n');
        statusItem.tooltip = `${auth}${ids ? `\n${ids}` : ''}\n\nClick to fetch metadata into Explorer`;
        statusItem.command = 'salesforceMetadata.fetchMetadata';
    } catch {
        statusItem.text = '$(cloud) SF: Connected';
        statusItem.tooltip = 'Click to fetch metadata into Explorer';
        statusItem.command = 'salesforceMetadata.fetchMetadata';
    }
}

function isChromeExtensionEnv() {
    return Boolean(globalThis?.chrome?.runtime?.id && typeof chrome?.runtime?.sendMessage === 'function');
}

async function fetchUserInfo({ instanceUrl, accessToken }) {
    try {
        const url = `${String(instanceUrl || '').replace(/\/+$/, '')}/services/oauth2/userinfo`;
        const resp = await fetch(url, { method: 'GET', headers: { Authorization: `Bearer ${accessToken}` } });
        if (!resp.ok) return null;
        const json = await resp.json().catch(() => null);
        if (!json || typeof json !== 'object') return null;
        return {
            username: json?.preferred_username || json?.email || json?.username || '',
            userId: json?.user_id || '',
            orgId: json?.organization_id || '',
        };
    } catch {
        return null;
    }
}

async function withToolingClientAuthed(conn, fn) {
    const current = await resolveStoredConnection(conn).catch(() => conn);
    const isChromeExtension = Boolean(globalThis?.chrome?.runtime?.id);
    const proxyUrl = isChromeExtension ? undefined : window.location.origin;
    const client = createToolingClient({
        instanceUrl: current.instanceUrl,
        apiVersion: current.apiVersion,
        accessToken: current.accessToken,
        proxyUrl,
    });
    try {
        return await fn(client, current);
    } catch (e) {
        if (!isAuthError(e)) throw e;
        const refreshed = await refreshStoredConnection(current).catch(() => null);
        if (!refreshed) throw e;
        const retryClient = createToolingClient({
            instanceUrl: refreshed.instanceUrl,
            apiVersion: refreshed.apiVersion,
            accessToken: refreshed.accessToken,
            proxyUrl,
        });
        return await fn(retryClient, refreshed);
    }
}

export async function activate(vscodeBundle) {
    const vscode = vscodeBundle?.vscode;
    if (!vscode?.commands || !vscode?.window || !vscode?.workspace) {
        return { dispose() {} };
    }

    const disposables = [];
    let apexLanguageClientWrapper = null;
    let lwcLanguageClientWrapper = null;
    let deployWorker = null;

    // Hide utility/non-editable files from Explorer (keep them on disk for deploy/cache).
    try {
        if (typeof vscode.workspace?.getConfiguration === 'function') {
            const filesCfg = vscode.workspace.getConfiguration('files');
            const current = (typeof filesCfg?.get === 'function' && filesCfg.get('exclude')) || {};
            const merged = {
                ...(current && typeof current === 'object' ? current : {}),
                '**/.salesforce/**': true,
                '**/*.map': true,
            };
            if (typeof filesCfg?.update === 'function') {
                // Try global first (web workbench), fallback to default target if unsupported.
                try {
                    await filesCfg.update('exclude', merged, true);
                } catch {
                    await filesCfg.update('exclude', merged);
                }
            }
        }
    } catch {
        // ignore
    }

    const lwcDiagnostics = vscode.languages?.createDiagnosticCollection
        ? vscode.languages.createDiagnosticCollection('salesforceLwcEslint')
        : null;
    if (lwcDiagnostics) {
        disposables.push(lwcDiagnostics);
    }

    const deployDiagnostics = vscode.languages?.createDiagnosticCollection
        ? vscode.languages.createDiagnosticCollection('salesforceDeploy')
        : null;
    if (deployDiagnostics) {
        disposables.push(deployDiagnostics);
    }

    const loginDiagnostics = vscode.languages?.createDiagnosticCollection
        ? vscode.languages.createDiagnosticCollection('salesforceLogin')
        : null;
    if (loginDiagnostics) {
        disposables.push(loginDiagnostics);
    }

    const apexExecDiagnostics = vscode.languages?.createDiagnosticCollection
        ? vscode.languages.createDiagnosticCollection('apexExecuteAnonymous')
        : null;
    if (apexExecDiagnostics) {
        disposables.push(apexExecDiagnostics);
    }

    const apexTestDiagnostics = vscode.languages?.createDiagnosticCollection
        ? vscode.languages.createDiagnosticCollection('apexTests')
        : null;
    if (apexTestDiagnostics) {
        disposables.push(apexTestDiagnostics);
    }

    const shellDiagnostics = vscode.languages?.createDiagnosticCollection
        ? vscode.languages.createDiagnosticCollection('salesforceShell')
        : null;
    if (shellDiagnostics) {
        disposables.push(shellDiagnostics);
    }

    const loginDiagUri = getWorkspaceUri(vscode, '.salesforce/login');
    async function setLoginProblem(message) {
        if (!loginDiagnostics) return;
        try {
            if (!message) {
                loginDiagnostics.delete(loginDiagUri);
                return;
            }
            const range = new vscode.Range(0, 0, 0, 1);
            const diag = new vscode.Diagnostic(range, String(message), vscode.DiagnosticSeverity.Error);
            diag.source = 'salesforce login';
            loginDiagnostics.set(loginDiagUri, [diag]);
        } catch {
            // ignore
        }
    }

    // Salesforce panel view (panel tab).
    // Webviews are not consistently available in this runtime, so we register a TreeDataProvider
    // to ensure the panel always displays useful info instead of "no data provider".
    try {
        if (typeof vscode.window?.registerTreeDataProvider === 'function' && typeof vscode.TreeItem === 'function') {
            class SfPanelProvider {
                getTreeItem(el) {
                    return el;
                }
                getChildren(el) {
                    if (el) return [];

                    const mkItem = (label, { icon, tooltip, description } = {}) => {
                        const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
                        if (icon && vscode.ThemeIcon) item.iconPath = new vscode.ThemeIcon(icon);
                        if (description) item.description = description;
                        if (tooltip && vscode.MarkdownString) {
                            const md = new vscode.MarkdownString(tooltip);
                            md.isTrusted = true;
                            item.tooltip = md;
                        } else if (tooltip) {
                            item.tooltip = tooltip;
                        }
                        return item;
                    };

                    const mkAction = (label, command, { icon, tooltip, description, args } = {}) => {
                        const item = mkItem(label, { icon, tooltip, description });
                        item.command = { command, title: label, arguments: Array.isArray(args) ? args : undefined };
                        return item;
                    };

                    const conn = loadStoredConn();
                    const connected = Boolean(conn?.instanceUrl && conn?.accessToken);
                    let host = '';
                    try { host = connected ? new URL(conn.instanceUrl).host : ''; } catch { host = ''; }

                    const items = [];
                    items.push(
                        mkItem(connected ? `Connected${host ? `: ${host}` : ''}` : 'Not connected', {
                            icon: connected ? 'cloud' : 'cloud-off',
                        })
                    );
                    items.push(
                        mkAction(connected ? 'Disconnect' : 'Connect', connected ? 'salesforceMetadata.disconnect' : 'salesforceMetadata.connect', {
                            icon: connected ? 'sign-out' : 'sign-in',
                        })
                    );
                    if (connected) {
                        items.push(mkAction('Sync Project (fetch/update/delete)', 'salesforceMetadata.fetchMetadata', { icon: 'sync' }));
                        items.push(mkAction('Source Status', 'salesforceMetadata.sourceStatus', { icon: 'diff' }));
                        items.push(mkAction('Pull Remote Changes', 'salesforceMetadata.pullRemoteChanges', { icon: 'cloud-download' }));
                        items.push(mkAction('Show Output', 'salesforceMetadata.showOutput', { icon: 'output' }));
                    }
                    items.push(mkAction('Open Shell Terminal', 'salesforceMetadata.openShellTerminal', { icon: 'terminal' }));
                    items.push(mkAction('Run Shell Command', 'salesforceMetadata.runShellCommand', { icon: 'play' }));
                    items.push(mkAction('Open SOQL scratch', 'salesforceMetadata.openSoqlScratch', { icon: 'edit' }));
                    return items;
                }
            }

            disposables.push(vscode.window.registerTreeDataProvider('salesforceMetadata.salesforcePanel', new SfPanelProvider()));
        }
    } catch {
        // ignore
    }

    const SCHEMA_CACHE_URI = getWorkspaceUri(vscode, '.salesforce/schema-cache.json');
    const SCHEMA_TTL_MS = 24 * 60 * 60 * 1000;
    let schemaCacheMem = null;

    async function loadSchemaCache() {
        if (schemaCacheMem) return schemaCacheMem;
        try {
            const bytes = await vscode.workspace.fs.readFile(SCHEMA_CACHE_URI);
            const text = new TextDecoder().decode(bytes || new Uint8Array());
            const parsed = JSON.parse(text || '{}');
            const next = parsed && typeof parsed === 'object' ? parsed : {};
            if (!next.objects || typeof next.objects !== 'object') next.objects = {};
            schemaCacheMem = next;
            return next;
        } catch {
            const next = { generatedAt: null, ttlMs: SCHEMA_TTL_MS, global: null, objects: {} };
            schemaCacheMem = next;
            return next;
        }
    }

    async function saveSchemaCache(cache) {
        const next = cache && typeof cache === 'object' ? cache : { objects: {} };
        if (!next.objects || typeof next.objects !== 'object') next.objects = {};
        schemaCacheMem = next;
        await writeTextFile(vscode, SCHEMA_CACHE_URI, JSON.stringify(next, null, 2), { skipCache: true });
    }

    function isCacheFresh(iso, ttlMs) {
        try {
            const t = Date.parse(String(iso || ''));
            if (!Number.isFinite(t)) return false;
            return Date.now() - t < (Number.isFinite(ttlMs) ? ttlMs : SCHEMA_TTL_MS);
        } catch {
            return false;
        }
    }

    async function ensureGlobalDescribe(conn, { force } = {}) {
        const cache = await loadSchemaCache();
        const ttlMs = Number(cache.ttlMs || SCHEMA_TTL_MS);
        if (!force && cache.global && isCacheFresh(cache.global.generatedAt, ttlMs) && cache.global.instanceUrl === conn.instanceUrl) {
            return cache.global;
        }
        const global = await withToolingClientAuthed(conn, async (client) => {
            const res = await client.requestJson('/sobjects/');
            const list = Array.isArray(res?.sobjects) ? res.sobjects : [];
            return {
                instanceUrl: conn.instanceUrl,
                generatedAt: new Date().toISOString(),
                sobjects: list.map((o) => ({
                    name: o?.name || o?.Name,
                    label: o?.label || o?.Label || o?.name || o?.Name,
                    custom: Boolean(o?.custom),
                })).filter((o) => o?.name),
            };
        });
        cache.global = global;
        cache.generatedAt = new Date().toISOString();
        cache.instanceUrl = conn.instanceUrl;
        await saveSchemaCache(cache);
        return global;
    }

    async function ensureSObjectDescribe(conn, sobjectName, { force } = {}) {
        const name = String(sobjectName || '').trim();
        if (!name) return null;
        const cache = await loadSchemaCache();
        const ttlMs = Number(cache.ttlMs || SCHEMA_TTL_MS);
        const existing = cache.objects?.[name];
        if (!force && existing && existing.instanceUrl === conn.instanceUrl && isCacheFresh(existing.generatedAt, ttlMs)) {
            return existing;
        }
        const desc = await withToolingClientAuthed(conn, async (client) => {
            return await client.requestJson(`/sobjects/${encodeURIComponent(name)}/describe`);
        });
        const next = {
            instanceUrl: conn.instanceUrl,
            generatedAt: new Date().toISOString(),
            name,
            label: desc?.label || name,
            fields: Array.isArray(desc?.fields) ? desc.fields.map((f) => ({
                name: f?.name,
                label: f?.label || f?.name,
                type: f?.type || '',
            })).filter((f) => f?.name) : [],
            childRelationships: Array.isArray(desc?.childRelationships)
                ? desc.childRelationships.map((r) => ({
                    childSObject: r?.childSObject,
                    field: r?.field,
                    relationshipName: r?.relationshipName,
                }))
                : [],
        };
        cache.objects[name] = next;
        cache.generatedAt = new Date().toISOString();
        cache.instanceUrl = conn.instanceUrl;
        await saveSchemaCache(cache);
        return next;
    }

    disposables.push(vscode.commands.registerCommand('salesforceMetadata.insertTextAtCursor', async (text) => {
        const editor = vscode.window?.activeTextEditor;
        if (!editor) return;
        const t = String(text || '');
        if (!t) return;
        await editor.edit((b) => b.insert(editor.selection.active, t));
    }));

    try {
        if (typeof vscode.window?.registerTreeDataProvider === 'function' && typeof vscode.TreeItem === 'function') {
            const emitter = new (vscode.EventEmitter || class { constructor(){ this.event = () => {}; } fire(){} dispose(){} })();

            class SchemaProvider {
                onDidChangeTreeData = emitter.event;

                refresh() { try { emitter.fire(); } catch {} }

                getTreeItem(el) {
                    if (el?.kind === 'action') {
                        const item = new vscode.TreeItem(el.label, vscode.TreeItemCollapsibleState.None);
                        if (vscode.ThemeIcon && el.icon) item.iconPath = new vscode.ThemeIcon(el.icon);
                        if (el.tooltip) item.tooltip = el.tooltip;
                        if (el.command) item.command = el.command;
                        return item;
                    }
                    if (el?.kind === 'object') {
                        const item = new vscode.TreeItem(`${el.name}`, vscode.TreeItemCollapsibleState.Collapsed);
                        item.description = el.label && el.label !== el.name ? el.label : '';
                        if (vscode.ThemeIcon) item.iconPath = new vscode.ThemeIcon('database');
                        return item;
                    }
                    if (el?.kind === 'group') {
                        const item = new vscode.TreeItem(el.label, vscode.TreeItemCollapsibleState.Collapsed);
                        if (vscode.ThemeIcon) item.iconPath = new vscode.ThemeIcon(el.icon || 'list-unordered');
                        return item;
                    }
                    if (el?.kind === 'field') {
                        const item = new vscode.TreeItem(el.name, vscode.TreeItemCollapsibleState.None);
                        item.description = el.type || '';
                        if (vscode.ThemeIcon) item.iconPath = new vscode.ThemeIcon('symbol-field');
                        item.command = { command: 'salesforceMetadata.insertTextAtCursor', title: 'Insert', arguments: [el.name] };
                        return item;
                    }
                    if (el?.kind === 'relationship') {
                        const item = new vscode.TreeItem(el.label, vscode.TreeItemCollapsibleState.None);
                        item.description = el.detail || '';
                        if (vscode.ThemeIcon) item.iconPath = new vscode.ThemeIcon('link');
                        return item;
                    }
                    return new vscode.TreeItem(String(el?.label || 'Item'), vscode.TreeItemCollapsibleState.None);
                }

                async getChildren(el) {
                    const conn = loadStoredConn();
                    if (!conn.instanceUrl || !conn.accessToken) {
                        return [
                            { kind: 'action', label: 'Not connected (click to connect)', icon: 'cloud', command: { command: 'salesforceMetadata.connect', title: 'Connect' } },
                        ];
                    }

                    if (!el) {
                        const global = await loadSchemaCache().then((c) => c.global).catch(() => null);
                        if (!global || global.instanceUrl !== conn.instanceUrl) {
                            return [
                                { kind: 'action', label: 'Load schema cache…', icon: 'refresh', command: { command: 'salesforceMetadata.refreshSchemaCache', title: 'Refresh schema' } },
                            ];
                        }
                        const list = Array.isArray(global.sobjects) ? global.sobjects : [];
                        return list.slice(0, 500).map((o) => ({ kind: 'object', name: o.name, label: o.label || o.name }));
                    }

                    if (el.kind === 'object') {
                        return [
                            { kind: 'group', group: 'fields', objectName: el.name, label: 'Fields', icon: 'symbol-field' },
                            { kind: 'group', group: 'relationships', objectName: el.name, label: 'Child relationships', icon: 'link' },
                        ];
                    }

                    if (el.kind === 'group') {
                        const desc = await ensureSObjectDescribe(conn, el.objectName);
                        if (!desc) return [];
                        if (el.group === 'fields') {
                            return (desc.fields || []).slice(0, 500).map((f) => ({ kind: 'field', objectName: desc.name, name: f.name, type: f.type }));
                        }
                        if (el.group === 'relationships') {
                            return (desc.childRelationships || [])
                                .slice(0, 200)
                                .map((r) => ({
                                    kind: 'relationship',
                                    label: r.relationshipName || r.childSObject || 'relationship',
                                    detail: [r.childSObject, r.field].filter(Boolean).join(' • '),
                                }));
                        }
                        return [];
                    }

                    return [];
                }
            }

            const schemaProvider = new SchemaProvider();
            disposables.push({ dispose: () => { try { emitter.dispose?.(); } catch {} } });
            disposables.push(vscode.window.registerTreeDataProvider('salesforceMetadata.schemaExplorer', schemaProvider));

            disposables.push(vscode.commands.registerCommand('salesforceMetadata.refreshSchemaCache', async () => {
                const conn = loadStoredConn();
                if (!conn.instanceUrl || !conn.accessToken) {
                    await vscode.commands.executeCommand('salesforceMetadata.connect');
                    return;
                }
                await vscode.window.withProgress(
                    { location: vscode.ProgressLocation.Notification, title: 'Refreshing schema cache…', cancellable: false },
                    async () => {
                        await ensureGlobalDescribe(conn, { force: true });
                    }
                );
                schemaProvider.refresh();
                await vscode.window.showInformationMessage('Schema cache refreshed.');
            }));

            // SOQL completions for `.soql` files.
            if (typeof vscode.languages?.registerCompletionItemProvider === 'function') {
                const provider = {
                    provideCompletionItems: async (doc, position) => {
                        const conn = loadStoredConn();
                        if (!conn.instanceUrl || !conn.accessToken) return [];

                        const text = doc.getText?.() ?? '';
                        const before = text.slice(0, doc.offsetAt(position));
                        const fromMatch = before.match(/\bFROM\s+([A-Za-z0-9_$.]+)\b/i);
                        const fromObj = fromMatch ? fromMatch[1] : '';
                        const inFrom = /\bFROM\s+[A-Za-z0-9_$.]*$/i.test(before);

                        const cache = await loadSchemaCache();
                        const global = cache.global?.instanceUrl === conn.instanceUrl ? cache.global : await ensureGlobalDescribe(conn);
                        const sobjects = Array.isArray(global?.sobjects) ? global.sobjects : [];

                        if (inFrom || !fromObj) {
                            return sobjects.slice(0, 500).map((o) => {
                                const item = new vscode.CompletionItem(o.name, vscode.CompletionItemKind.Class);
                                item.detail = o.label || o.name;
                                return item;
                            });
                        }

                        const desc = await ensureSObjectDescribe(conn, fromObj);
                        const fields = Array.isArray(desc?.fields) ? desc.fields : [];
                        return fields.slice(0, 500).map((f) => {
                            const item = new vscode.CompletionItem(f.name, vscode.CompletionItemKind.Field);
                            item.detail = f.type || '';
                            item.documentation = f.label || f.name;
                            return item;
                        });
                    },
                };
                disposables.push(vscode.languages.registerCompletionItemProvider('soql', provider, '.', ' '));
            }
        }
    } catch {
        // ignore
    }

    function isLwcDoc(doc) {
        const path = doc?.uri?.path || '';
        const isMain = path.includes('/force-app/main/');
        if (!isMain) return false;
        if (!path.includes('/lwc/')) return false;
        return (
            path.endsWith('.js') ||
            path.endsWith('.ts') ||
            path.endsWith('.html') ||
            path.endsWith('.css')
        );
    }

    async function lintLwcDocument(doc) {
        if (!lwcDiagnostics) return;
        if (!doc || !isLwcDoc(doc)) return;

        const text = doc.getText?.() ?? '';
        const body = JSON.stringify({ uri: doc.uri?.path || doc.uri?.toString?.() || '', text });
        const res = await fetch('/lint/lwc', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new Error(payload?.error || 'Lint request failed');
        }

        const diags = (payload?.diagnostics || []).map((d) => {
            const start = d?.range?.start || { line: 0, character: 0 };
            const end = d?.range?.end || start;
            const range = new vscode.Range(start.line, start.character, end.line, end.character);
            const sev = d?.severity === 2
                ? vscode.DiagnosticSeverity.Warning
                : vscode.DiagnosticSeverity.Error;
            const diag = new vscode.Diagnostic(range, d?.message || 'Lint issue', sev);
            diag.source = d?.source || 'eslint';
            if (d?.code) diag.code = d.code;
            return diag;
        });

        lwcDiagnostics.set(doc.uri, diags);
    }

    const monaco = vscodeBundle?.monaco;
    if (monaco?.languages?.register) {
        const regs = [
            { id: 'apex', aliases: ['Apex'], extensions: ['.cls', '.trigger'] },
            { id: 'javascript', aliases: ['JavaScript'], extensions: ['.js', '.mjs', '.cjs'] },
            { id: 'javascriptreact', aliases: ['JavaScript React'], extensions: ['.jsx'] },
            { id: 'typescript', aliases: ['TypeScript'], extensions: ['.ts'] },
            { id: 'typescriptreact', aliases: ['TypeScript React'], extensions: ['.tsx'] },
            { id: 'html', aliases: ['HTML'], extensions: ['.html', '.htm'] },
            { id: 'css', aliases: ['CSS'], extensions: ['.css'] },
        ];
        for (const r of regs) {
            try {
                monaco.languages.register(r);
            } catch {
                // ignore
            }
        }
    }

    // Restore cached workspace metadata quickly on reload (best-effort).
    try {
        void restoreCachedFilesToWorkspace(vscode);
    } catch {
        // ignore
    }

    // Ensure .cls/.trigger documents are assigned the Apex language id.
    try {
        if (vscode.workspace?.onDidOpenTextDocument && vscode.languages?.setTextDocumentLanguage) {
            const sub = vscode.workspace.onDidOpenTextDocument(async (doc) => {
                try {
                    const p = doc?.uri?.path || '';
                    if (p.endsWith('.cls') || p.endsWith('.trigger')) {
                        if (doc.languageId !== 'apex') {
                            await vscode.languages.setTextDocumentLanguage(doc, 'apex');
                        }
                    }
                    // Ensure LWC files get a highlighting language (Monaco sometimes opens as plaintext in virtual FS).
                    if (p.includes('/force-app/main/') && p.includes('/lwc/')) {
                        if (p.endsWith('.html') && doc.languageId !== 'html') {
                            await vscode.languages.setTextDocumentLanguage(doc, 'html');
                        } else if (p.endsWith('.css') && doc.languageId !== 'css') {
                            await vscode.languages.setTextDocumentLanguage(doc, 'css');
                        } else if (p.endsWith('.js') && doc.languageId !== 'javascript') {
                            await vscode.languages.setTextDocumentLanguage(doc, 'javascript');
                        } else if (p.endsWith('.ts') && doc.languageId !== 'typescript') {
                            await vscode.languages.setTextDocumentLanguage(doc, 'typescript');
                        }
                    }
                } catch {
                    // ignore
                }
            });
            disposables.push(sub);
        }
    } catch {
        // ignore
    }

    // Start Apex LSP (worker) using the same LanguageClientWrapper mechanism as AgentScript.
    try {
        const LanguageClientWrapper = vscodeBundle?.monacoLanguageClient?.LanguageClient?.LanguageClientWrapper;
        if (LanguageClientWrapper) {
            const workerUrl = '/libs/extensions/salesforce-apex/server/server.browser.js';
            const worker = new Worker(workerUrl, { type: 'module', name: 'Apex LS' });
            const languageClientConfig = {
                languageId: 'apex',
                clientOptions: {
                    documentSelector: [
                        // Match by glob even if the workbench hasn't set a languageId yet.
                        { scheme: 'file', pattern: '**/*.cls' },
                        { scheme: 'file', pattern: '**/*.trigger' },
                    ],
                },
                connection: {
                    options: {
                        worker,
                    },
                },
            };
            apexLanguageClientWrapper = new LanguageClientWrapper(languageClientConfig);
            await apexLanguageClientWrapper.start();
            disposables.push({ dispose: () => apexLanguageClientWrapper?.dispose?.() });
        }
    } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('Apex language client failed to start:', e);
    }



    const statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusItem.show();
    setStatus(statusItem, loadStoredConn());
    disposables.push(statusItem);

    const output = typeof vscode.window?.createOutputChannel === 'function'
        ? vscode.window.createOutputChannel('Salesforce (Workbench)')
        : null;
    if (output) {
        disposables.push(output);
    }

    function logLines(lines) {
        if (!output) return;
        try {
            for (const l of lines || []) {
                output.appendLine(String(l));
            }
        } catch {
            // ignore
        }
    }

    function toShellOutputLines(result) {
        const lines = [
            '',
            `=== Shell (${new Date(result?.endedAt || Date.now()).toLocaleString()}) ===`,
            `Command: ${result?.command || ''}`,
            `CWD: ${result?.cwd || getWorkspaceRootPath(vscode)}`,
            `Exit code: ${Number(result?.exitCode ?? 1)}`,
        ];
        const stdout = String(result?.stdout || '').trim();
        const stderr = String(result?.stderr || '').trim();
        if (stdout) {
            lines.push('', '[stdout]', ...stdout.split('\n'));
        }
        if (stderr) {
            lines.push('', '[stderr]', ...stderr.split('\n'));
        }
        return lines;
    }

    async function ensureShellWorkspaceDir() {
        const dir = getWorkspaceUri(vscode, '.salesforce/shell');
        await ensureDir(vscode, dir);
        return dir;
    }

    async function writeShellErrorLog(result) {
        const dir = await ensureShellWorkspaceDir();
        const logUri = vscode.Uri.joinPath(dir, 'last-error.log');
        const text = [
            `Command: ${result?.command || ''}`,
            `CWD: ${result?.cwd || getWorkspaceRootPath(vscode)}`,
            `Exit code: ${Number(result?.exitCode ?? 1)}`,
            '',
            '[stderr]',
            String(result?.stderr || '').trim() || '(empty)',
            '',
            '[stdout]',
            String(result?.stdout || '').trim() || '(empty)',
            '',
        ].join('\n');
        await writeTextFile(vscode, logUri, text, { skipCache: true });
        return logUri;
    }

    function parseHeaderValues(headerValues) {
        const headers = {};
        for (const raw of headerValues || []) {
            const line = String(raw || '').trim();
            if (!line) continue;
            const index = line.indexOf(':');
            if (index <= 0) {
                throw new Error(`Invalid header "${line}". Expected "Name: Value".`);
            }
            const name = line.slice(0, index).trim();
            const value = line.slice(index + 1).trim();
            if (!name) {
                throw new Error(`Invalid header "${line}". Expected "Name: Value".`);
            }
            headers[name] = value;
        }
        return headers;
    }

    async function getShellOrgEntries() {
        const out = [];
        const pushEntry = (entry) => {
            if (!entry?.instanceUrl) return;
            const key = `${entry.instanceUrl}|${entry.alias || ''}|${entry.username || ''}`;
            if (out.some(item => `${item.instanceUrl}|${item.alias || ''}|${item.username || ''}` === key)) {
                return;
            }
            out.push(entry);
        };

        const current = loadStoredConn();
        if (current?.instanceUrl && current?.accessToken) {
            let host = current.instanceUrl;
            try {
                host = new URL(current.instanceUrl).host;
            } catch {
                // ignore
            }
            pushEntry({
                alias: current.username || host || 'current',
                username: current.username || '',
                instanceUrl: current.instanceUrl,
                sessionId: current.accessToken,
                authType: current.authType || 'current',
                label: host,
            });
        }

        try {
            const sharedConnections = await listSharedConnectionEntries();
            for (const item of sharedConnections) {
                const configuration = item?.configuration;
                if (!configuration?.instanceUrl) continue;
                pushEntry({
                    alias: configuration.alias || configuration.username || item.host || 'saved-org',
                    username: configuration.username || '',
                    instanceUrl: configuration.instanceUrl || '',
                    sessionId: configuration.accessToken || '',
                    authType: getConnectionAuthType(configuration),
                    sharedAlias: configuration.alias || '',
                    label: item.host || configuration.instanceUrl || '',
                });
            }
        } catch {
            // ignore
        }

        if (isChromeExtensionEnv()) {
            try {
                const tabSessions = await chrome.runtime.sendMessage({ action: 'listOrgSessions' });
                for (const item of Array.isArray(tabSessions) ? tabSessions : []) {
                    pushEntry({
                        alias: item?.label || item?.serverUrl || 'tab-session',
                        username: item?.label || '',
                        instanceUrl: item?.serverUrl || '',
                        sessionId: item?.sessionId || '',
                        authType: 'cookie',
                        label: item?.label || item?.serverUrl || '',
                    });
                }
            } catch {
                // ignore
            }
        }

        out.sort((a, b) => String(a.alias || a.label || '').localeCompare(String(b.alias || b.label || '')));
        return out;
    }

    async function ensureShellConn() {
        let conn = loadStoredConn();
        conn = await resolveStoredConnection(conn).catch(() => conn);
        if (!conn.instanceUrl || !conn.accessToken) {
            await vscode.commands.executeCommand('salesforceMetadata.connect');
            conn = loadStoredConn();
            conn = await resolveStoredConnection(conn).catch(() => conn);
        }
        if (!conn.instanceUrl || !conn.accessToken) {
            throw new Error('Not connected to Salesforce.');
        }
        return conn;
    }

    function createWorkbenchShellService() {
        const bash = createBashInstance();
        const runner = createShellRunner({ bash });
        const history = [];
        const listeners = new Set();

        registerSalesforceShellCommands({
            shell: bash,
            handlers: {
                async executeApex({ apexCode, sourceFilePath }) {
                    const conn = await ensureShellConn();
                    const res = await withToolingClientAuthed(conn, async (client) => {
                        return await client.requestJson(`/tooling/executeAnonymous/?anonymousBody=${encodeURIComponent(apexCode)}`);
                    });

                    if (shellDiagnostics) {
                        try {
                            const targetUri = sourceFilePath
                                ? vscode.Uri.file(sourceFilePath)
                                : getWorkspaceUri(vscode, '.salesforce/shell/execute-anonymous.apex');
                            if (!sourceFilePath) {
                                await ensureShellWorkspaceDir();
                                await writeTextFile(vscode, targetUri, apexCode, { skipCache: true });
                            }
                            const compiled = Boolean(res?.compiled);
                            const success = Boolean(res?.success);
                            if (compiled && success) {
                                shellDiagnostics.delete(targetUri);
                            } else {
                                const line = Number(res?.line);
                                const column = Number(res?.column);
                                const l = Number.isFinite(line) && line > 0 ? line - 1 : 0;
                                const c = Number.isFinite(column) && column > 0 ? column - 1 : 0;
                                const range = new vscode.Range(l, c, l, c + 1);
                                const msg = res?.compileProblem || res?.exceptionMessage || 'Execute Anonymous failed';
                                const diag = new vscode.Diagnostic(range, msg, vscode.DiagnosticSeverity.Error);
                                diag.source = 'salesforce shell';
                                shellDiagnostics.set(targetUri, [diag]);
                            }
                        } catch {
                            // ignore
                        }
                    }

                    return {
                        result: res,
                        exitCode: getApexExecutionExitCode(res),
                    };
                },
                async executeSoql({ query, useToolingApi, includeDeletedRecords }) {
                    const conn = await ensureShellConn();
                    return {
                        result: await withToolingClientAuthed(conn, async (client) => {
                            const basePath = useToolingApi
                                ? '/tooling/query'
                                : includeDeletedRecords
                                  ? '/queryAll'
                                  : '/query';
                            const first = await client.requestJson(`${basePath}?q=${encodeURIComponent(query)}`);
                            const pages = [first];
                            let nextUrl = first?.nextRecordsUrl;
                            while (nextUrl) {
                                // eslint-disable-next-line no-await-in-loop
                                const page = await client.requestJson(nextUrl);
                                pages.push(page);
                                nextUrl = page?.nextRecordsUrl;
                            }
                            const records = pages.flatMap((page) => page?.records || []);
                            return {
                                query,
                                tooling: Boolean(useToolingApi),
                                allRows: Boolean(includeDeletedRecords),
                                totalSize: Number(first?.totalSize ?? records.length),
                                records,
                            };
                        }),
                    };
                },
                async executeApi({ method, endpoint, body, headerValues }) {
                    const conn = await ensureShellConn();
                    const parsedHeaders = parseHeaderValues(headerValues);
                    let parsedBody;
                    if (body) {
                        try {
                            parsedBody = JSON.parse(body);
                        } catch {
                            throw new Error('API request body must be valid JSON.');
                        }
                    }
                    return {
                        result: await withToolingClientAuthed(conn, async (client) => {
                            const text = await client.requestText(endpoint, {
                                method,
                                body: parsedBody,
                                headers: parsedHeaders,
                            });
                            try {
                                return JSON.parse(text);
                            } catch {
                                return text;
                            }
                        }),
                    };
                },
                async listOrgs() {
                    return {
                        result: await getShellOrgEntries(),
                    };
                },
                async openOrg({ alias }) {
                    const targets = await getShellOrgEntries();
                    const normalized = String(alias || '').trim().toLowerCase();
                    const match = targets.find((entry) => {
                        let host = '';
                        try {
                            host = new URL(entry.instanceUrl).host;
                        } catch {
                            host = '';
                        }
                        return [
                            entry.alias,
                            entry.username,
                            entry.label,
                            entry.instanceUrl,
                            host,
                        ].filter(Boolean).some((value) => String(value).trim().toLowerCase() === normalized);
                    });
                    if (!match) {
                        throw new Error(`Unknown org alias "${alias}". Run "sf org list" to inspect available aliases.`);
                    }
                    const sid = match.sessionId || '';
                    const url = sid
                        ? `${String(match.instanceUrl).replace(/\/+$/, '')}/secur/frontdoor.jsp?sid=${encodeURIComponent(sid)}`
                        : match.instanceUrl;
                    await vscode.env.openExternal(vscode.Uri.parse(url));
                    return { result: `Opened org ${match.alias || alias}` };
                },
            },
        });

        return {
            async run(command, { cwd, source } = {}) {
                const startedAt = Date.now();
                const result = await runner.run(command, { cwd });
                const event = {
                    ...result,
                    source: source || 'command',
                    startedAt,
                    endedAt: Date.now(),
                };
                history.push(event);
                if (history.length > 100) history.shift();
                for (const listener of listeners) {
                    try {
                        listener(event);
                    } catch {
                        // ignore
                    }
                }
                return event;
            },
            getCwd() {
                return runner.getCwd();
            },
            getHistory() {
                return history.slice();
            },
            onDidRun(listener) {
                listeners.add(listener);
                return {
                    dispose() {
                        listeners.delete(listener);
                    },
                };
            },
        };
    }

    const shellService = createWorkbenchShellService();
    let shellTerminalController = null;

    disposables.push(shellService.onDidRun(async (result) => {
        logLines(toShellOutputLines(result));
        if (!result || Number(result.exitCode) === 0 || !shellDiagnostics) {
            return;
        }
        try {
            const logUri = await writeShellErrorLog(result);
            const diag = new vscode.Diagnostic(
                new vscode.Range(0, 0, 0, 1),
                String(result.stderr || result.stdout || 'Shell command failed'),
                vscode.DiagnosticSeverity.Error
            );
            diag.source = 'salesforce shell';
            shellDiagnostics.set(logUri, [diag]);
        } catch {
            // ignore
        }
    }));

    function ensureShellTerminal() {
        if (shellTerminalController) return shellTerminalController;

        const writeEmitter = new vscode.EventEmitter();
        const closeEmitter = new vscode.EventEmitter();
        let inputBuffer = '';
        let isRunning = false;
        let terminal = null;

        const normalizeTerminalText = (value) => String(value || '').replace(/\r?\n/g, '\r\n');
        const write = (value) => {
            if (!value) return;
            writeEmitter.fire(normalizeTerminalText(value));
        };
        const prompt = () => `sf-shell:${shellService.getCwd()}$ `;
        const renderPrompt = () => {
            write(`\r\n${prompt()}`);
        };

        const runCommand = async (command, { echoCommand = false, reveal = true, source = 'terminal' } = {}) => {
            const text = String(command || '');
            const trimmed = text.trim();
            if (!trimmed) {
                renderPrompt();
                return null;
            }
            if (trimmed === 'clear') {
                writeEmitter.fire('\x1bc');
                write(prompt());
                return null;
            }
            if (trimmed === 'exit') {
                closeEmitter.fire();
                return null;
            }
            if (isRunning) {
                write(`\r\n[busy] Waiting for the current shell command to finish.`);
                renderPrompt();
                return null;
            }

            isRunning = true;
            try {
                if (echoCommand) {
                    write(`\r\n${prompt()}${text}\r\n`);
                } else {
                    write('\r\n');
                }
                const result = await shellService.run(text, {
                    cwd: shellService.getCwd(),
                    source,
                });
                if (result.stdout) write(result.stdout);
                if (result.stderr) write(`${result.stderr}`);
                if (!result.stdout && !result.stderr) {
                    write(`[exit ${Number(result.exitCode ?? 0)}]`);
                }
                renderPrompt();
                return result;
            } finally {
                isRunning = false;
            }
        };

        const pty = {
            onDidWrite: writeEmitter.event,
            onDidClose: closeEmitter.event,
            open: () => {
                write('Salesforce Shell');
                write(`\r\nType sf commands like "sf org list", "sf data query --query \\"SELECT Id FROM Account LIMIT 5\\"" or "sf apex run --file ${getWorkspacePath(vscode, '.salesforce/shell/execute-anonymous.apex')}".`);
                write(`\r\n${prompt()}`);
            },
            close: () => {
                shellTerminalController = null;
                try { writeEmitter.dispose(); } catch {}
                try { closeEmitter.dispose(); } catch {}
            },
            handleInput: async (data) => {
                if (data === '\r') {
                    const command = inputBuffer;
                    inputBuffer = '';
                    await runCommand(command, { echoCommand: false, source: 'terminal' });
                    return;
                }
                if (data === '\u007F') {
                    if (!inputBuffer) return;
                    inputBuffer = inputBuffer.slice(0, -1);
                    writeEmitter.fire('\b \b');
                    return;
                }
                if (data === '\u0003') {
                    write('^C');
                    inputBuffer = '';
                    renderPrompt();
                    return;
                }
                if (!data || data.startsWith('\u001b')) {
                    return;
                }
                inputBuffer += data;
                writeEmitter.fire(data);
            },
        };

        terminal = vscode.window.createTerminal({
            name: 'Salesforce Shell',
            pty,
        });

        shellTerminalController = {
            show(preserveFocus = false) {
                terminal?.show?.(preserveFocus);
            },
            async runCommand(command, options = {}) {
                if (options.reveal !== false) {
                    terminal?.show?.(true);
                }
                return await runCommand(command, {
                    echoCommand: true,
                    reveal: options.reveal,
                    source: options.source || 'command',
                });
            },
            dispose() {
                try {
                    terminal?.dispose?.();
                } catch {
                    // ignore
                }
            },
        };

        disposables.push(shellTerminalController);
        return shellTerminalController;
    }

    async function runShellCommand(command, { source = 'command', reveal = true } = {}) {
        const text = String(command || '').trim();
        if (!text) return null;

        try {
            shellDiagnostics?.clear?.();
        } catch {
            // ignore
        }

        const terminal = ensureShellTerminal();
        const result = await terminal.runCommand(text, { reveal, source });
        if (result && Number(result.exitCode) !== 0) {
            const message = `Shell command failed (${result.exitCode}): ${text}`;
            if (output) {
                const action = await vscode.window.showErrorMessage(message, 'Open Output');
                if (action === 'Open Output') {
                    try { output.show(true); } catch {}
                }
            } else {
                await vscode.window.showErrorMessage(message);
            }
        }
        return result;
    }

    disposables.push(vscode.commands.registerCommand('salesforceMetadata.showOutput', async () => {
        if (!output) {
            await vscode.window.showWarningMessage('Output channel is not available in this runtime.');
            return;
        }
        try {
            output.show(true);
        } catch {
            // ignore
        }
    }));

    disposables.push(vscode.commands.registerCommand('salesforceMetadata.openShellTerminal', async () => {
        ensureShellTerminal().show(true);
    }));

    disposables.push(vscode.commands.registerCommand('salesforceMetadata.runShellCommand', async () => {
        const editor = vscode.window?.activeTextEditor;
        const selected = editor?.document && editor?.selection && !editor.selection.isEmpty
            ? editor.document.getText(editor.selection)
            : '';
        const command = await vscode.window.showInputBox({
            title: 'Run Salesforce Shell Command',
            prompt: 'Examples: sf org list, sf data query --query "SELECT Id FROM Account LIMIT 5"',
            value: selected?.trim() || 'sf ',
            ignoreFocusOut: true,
        });
        if (!command) return;
        await runShellCommand(command, { source: 'palette', reveal: true });
    }));

    function loadAutoDeployOnSave() {
        try {
            const raw = localStorage.getItem(AUTO_DEPLOY_KEY);
            if (raw === null) {
                // Default to ON for the Chrome extension experience (still requires connection + tooling-map entry).
                const isChromeExtension = Boolean(globalThis?.chrome?.runtime?.id);
                return isChromeExtension;
            }
            return raw === 'true';
        } catch {
            return false;
        }
    }
    function saveAutoDeployOnSave(v) {
        try {
            localStorage.setItem(AUTO_DEPLOY_KEY, v ? 'true' : 'false');
        } catch {
            // ignore
        }
    }

    const autoDeployStatusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 99);
    function setAutoDeployStatus() {
        const on = loadAutoDeployOnSave();
        autoDeployStatusItem.text = on ? '$(cloud-upload) AutoDeploy: On' : '$(cloud-upload) AutoDeploy: Off';
        autoDeployStatusItem.tooltip = 'Click to toggle auto deploy on save';
        autoDeployStatusItem.command = 'salesforceMetadata.toggleAutoDeploy';
    }
    setAutoDeployStatus();
    autoDeployStatusItem.show();
    disposables.push(autoDeployStatusItem);

    let toolingMapCache = null;
    async function loadToolingMapItems({ force } = {}) {
        if (!force && toolingMapCache) return toolingMapCache;
        try {
            const uri = getWorkspaceUri(vscode, '.salesforce/tooling-map.json');
            const bytes = await vscode.workspace.fs.readFile(uri);
            const text = new TextDecoder().decode(bytes || new Uint8Array());
            const parsed = JSON.parse(text || '{}');
            toolingMapCache = parsed?.items && typeof parsed.items === 'object' ? parsed.items : {};
            return toolingMapCache;
        } catch {
            toolingMapCache = {};
            return toolingMapCache;
        }
    }

    function ensureDeployWorker() {
        if (deployWorker) return deployWorker;
        const workerUrl = '/libs/extensions/salesforce-deploy/deploy.worker.js';
        deployWorker = new Worker(workerUrl, { type: 'module', name: 'SF Deploy' });
        disposables.push({ dispose: () => deployWorker?.terminate?.() });
        return deployWorker;
    }

    function toDeployItemFromMapEntry(path, entry, text) {
        if (entry?.readOnly) return null;
        const type = entry?.type;
        const id = entry?.id;
        if (!type || !id) return null;
        if (type !== 'ApexClass' && type !== 'ApexTrigger' && type !== 'LightningComponentResource' && type !== 'AuraDefinition') return null;
        const field = type === 'ApexClass' || type === 'ApexTrigger' ? 'Body' : 'Source';
        return { path, sobject: type, id, field, text: String(text ?? '') };
    }

    async function readTextForPath(path) {
        try {
            const open = vscode.workspace?.textDocuments?.find((d) => d?.uri?.path === path);
            if (open) return open.getText();
        } catch {
            // ignore
        }
        const bytes = await vscode.workspace.fs.readFile(vscode.Uri.file(path));
        return new TextDecoder().decode(bytes || new Uint8Array());
    }

    async function deployPaths(paths, { showProgress, title } = {}) {
        const conn = loadStoredConn();
        if (!conn.instanceUrl || !conn.accessToken) {
            await vscode.commands.executeCommand('salesforceMetadata.connect');
            return null;
        }

        const mapItems = await loadToolingMapItems();
        const items = [];
        let skippedReadOnly = 0;
        for (const p of paths) {
            const entry = mapItems?.[p];
            if (!entry) continue;
            if (entry?.readOnly) {
                skippedReadOnly += 1;
                continue;
            }
            // eslint-disable-next-line no-await-in-loop
            const text = await readTextForPath(p);
            const item = toDeployItemFromMapEntry(p, entry, text);
            if (item) items.push(item);
        }

        if (!items.length) {
            if (showProgress) {
                const msg = skippedReadOnly
                    ? `No deployable files selected (${skippedReadOnly} read-only namespaced/managed file(s) were skipped).`
                    : 'No deployable files selected (missing tooling-map entry). Fetch metadata first.';
                await vscode.window.showWarningMessage(msg);
            }
            return { results: [], failures: [], skippedReadOnly };
        }

        const w = ensureDeployWorker();
        const requestId = `deploy_${Date.now()}_${Math.random().toString(16).slice(2)}`;
        const results = [];

        const run = () => new Promise((resolve) => {
            const onMsg = (ev) => {
                const msg = ev?.data;
                if (!msg || msg.requestId !== requestId) return;
                if (msg.type === 'result') results.push(msg);
                if (msg.type === 'done') {
                    try { w.removeEventListener('message', onMsg); } catch {}
                    resolve();
                }
            };
            w.addEventListener('message', onMsg);
            w.postMessage({ type: 'deploy', requestId, connection: conn, items });
        });

        if (showProgress) {
            await vscode.window.withProgress(
                { location: vscode.ProgressLocation.Notification, title: title || 'Deploying to Salesforce...', cancellable: true },
                async (progress, token) => {
                    try {
                        token?.onCancellationRequested?.(() => {
                            try {
                                w.postMessage({ type: 'cancel', requestId });
                            } catch {
                                // ignore
                            }
                        });
                    } catch {
                        // ignore
                    }

                    let lastPct = 0;
                    const onMsg = (ev) => {
                        const msg = ev?.data;
                        if (!msg || msg.requestId !== requestId) return;
                        if (msg.type === 'progress') {
                            const total = msg.total || 0;
                            const done = msg.done || 0;
                            const pct = total ? Math.max(0, Math.min(100, Math.round((done / total) * 100))) : 0;
                            progress.report({
                                message: msg.currentPath ? `Deploying ${msg.currentPath}` : undefined,
                                increment: Math.max(0, pct - lastPct),
                            });
                            lastPct = pct;
                        }
                    };
                    w.addEventListener('message', onMsg);
                    try {
                        await run();
                    } finally {
                        try { w.removeEventListener('message', onMsg); } catch {}
                    }
                }
            );
        } else {
            await run();
        }

        const failures = results.filter((r) => r && r.ok === false);
        try {
            const successes = results.filter((r) => r && r.ok === true);
            logLines([
                '',
                `=== Deploy (${new Date().toLocaleString()}) ===`,
                `Target: ${conn.instanceUrl}`,
                `Items: ${results.length} • Success: ${successes.length} • Failed: ${failures.length}`,
                '',
                'Success:',
                ...successes.map((r) => `  OK   ${r.path}`),
                ...(failures.length ? ['','Failures:', ...failures.map((r) => `  FAIL ${r.path} • ${r.error || 'Unknown error'}`)] : []),
            ]);
        } catch {
            // ignore
        }
        try {
            if (deployDiagnostics) {
                for (const r of results) {
                    if (!r?.path) continue;
                    const uri = vscode.Uri.file(r.path);
                    if (r.ok) {
                        deployDiagnostics.delete(uri);
                    } else {
                        const range = new vscode.Range(0, 0, 0, 1);
                        const diag = new vscode.Diagnostic(range, r.error || 'Deploy failed', vscode.DiagnosticSeverity.Error);
                        diag.source = 'salesforce deploy';
                        deployDiagnostics.set(uri, [diag]);
                    }
                }
            }
        } catch {
            // ignore
        }
        if (failures.length) {
            const first = failures[0];
            const msg = `Deploy failed for ${first.path}: ${first.error || 'Unknown error'}`;
            if (output) {
                const action = await vscode.window.showErrorMessage(msg, 'Open Output');
                if (action === 'Open Output') {
                    try { output.show(true); } catch {}
                }
            } else {
                await vscode.window.showErrorMessage(msg);
            }
        } else if (showProgress) {
            await vscode.window.showInformationMessage('Deploy complete.');
        }
        return { results, failures, skippedReadOnly };
    }

    async function fetchPathFromSalesforce(path, { showProgress } = {}) {
        const conn = loadStoredConn();
        if (!conn.instanceUrl || !conn.accessToken) {
            await vscode.commands.executeCommand('salesforceMetadata.connect');
            return;
        }

        const mapItems = await loadToolingMapItems();
        const entry = mapItems?.[path];
        if (!entry?.type || !entry?.id) {
            await vscode.window.showWarningMessage('This file is not in tooling-map.json. Fetch metadata first.');
            return;
        }

        const run = async () => {
            const text = await withToolingClientAuthed(conn, async (client) => {
                const id = String(entry.id);
                if (entry.type === 'ApexClass') {
                    const rows = await client.toolingQueryAll(`SELECT Id, Body FROM ApexClass WHERE Id='${id}'`);
                    return rows?.[0]?.Body ?? null;
                }
                if (entry.type === 'ApexTrigger') {
                    const rows = await client.toolingQueryAll(`SELECT Id, Body FROM ApexTrigger WHERE Id='${id}'`);
                    return rows?.[0]?.Body ?? null;
                }
                if (entry.type === 'LightningComponentResource') {
                    const rows = await client.toolingQueryAll(
                        `SELECT Id, Source FROM LightningComponentResource WHERE Id='${id}'`
                    );
                    return rows?.[0]?.Source ?? null;
                }
                if (entry.type === 'AuraDefinition') {
                    const rows = await client.toolingQueryAll(`SELECT Id, Source FROM AuraDefinition WHERE Id='${id}'`);
                    return rows?.[0]?.Source ?? null;
                }
                return null;
            });
            if (text == null) {
                await vscode.window.showWarningMessage(`Salesforce returned no source for ${entry.type}/${entry.id}.`);
                return;
            }
            await writeTextFile(vscode, vscode.Uri.file(path), text);
            try {
                deployDiagnostics?.delete?.(vscode.Uri.file(path));
            } catch {
                // ignore
            }
        };

        if (showProgress) {
            await vscode.window.withProgress(
                { location: vscode.ProgressLocation.Notification, title: 'Fetching file from Salesforce...', cancellable: false },
                run
            );
        } else {
            await run();
        }

        await vscode.window.showInformationMessage('File refreshed from Salesforce.');
    }

    const deployInFlight = new Set();
    const deployPending = new Map();
    let deployTimer = null;
    let autoDeployUiLock = false;
    function setAutoDeployBusyState(isBusy, { pendingCount } = {}) {
        if (!autoDeployStatusItem) return;
        const on = loadAutoDeployOnSave();
        if (!on) return;
        try {
            if (isBusy) {
                autoDeployUiLock = true;
                const n = Number(pendingCount || 0);
                autoDeployStatusItem.text = `$(sync~spin) AutoDeploy: Deploying${n ? ` (${n} pending)` : ''}`;
                autoDeployStatusItem.tooltip = 'Auto deploy is running in the background';
                return;
            }
        } catch {
            // ignore
        } finally {
            if (!isBusy) {
                autoDeployUiLock = false;
                setAutoDeployStatus();
            }
        }
    }

    async function flushAutoDeployQueue() {
        const docs = Array.from(deployPending.values());
        deployPending.clear();
        if (!docs.length) return;

        const paths = [];
        for (const doc of docs) {
            const p = doc?.uri?.path;
            if (!p) continue;
            if (deployInFlight.has(p)) {
                deployPending.set(p, doc);
                continue;
            }
            deployInFlight.add(p);
            paths.push(p);
        }

        if (!paths.length) return;
        try {
            setAutoDeployBusyState(true, { pendingCount: deployPending.size });
            const summary = await deployPaths(paths, { showProgress: false });
            const failures = summary?.failures || [];
            if (failures.length) {
                const first = failures[0];
                const msg = first?.error || 'Deploy failed';
                try {
                    if (output) {
                        const action = await vscode.window.showErrorMessage(`Auto deploy failed: ${msg}`, 'Open Output');
                        if (action === 'Open Output') {
                            try { output.show(true); } catch {}
                        }
                    } else {
                        await vscode.window.showErrorMessage(`Auto deploy failed: ${msg}`);
                    }
                } catch {
                    // ignore
                }
            }
        } finally {
            for (const p of paths) deployInFlight.delete(p);
            setAutoDeployBusyState(false);
            if (deployPending.size && !deployTimer) {
                deployTimer = setTimeout(() => {
                    deployTimer = null;
                    void flushAutoDeployQueue();
                }, 350);
            }
        }
    }
    function enqueueAutoDeploy(doc) {
        const p = doc?.uri?.path;
        if (!p) return;
        deployPending.set(p, doc);
        if (deployTimer) clearTimeout(deployTimer);
        if (!autoDeployUiLock) {
            try {
                const on = loadAutoDeployOnSave();
                if (on) {
                    const n = deployPending.size;
                    autoDeployStatusItem.text = `$(cloud-upload) AutoDeploy: On${n ? ` (${n})` : ''}`;
                    autoDeployStatusItem.tooltip = 'Click to toggle auto deploy on save';
                }
            } catch {
                // ignore
            }
        }
        deployTimer = setTimeout(() => {
            deployTimer = null;
            void flushAutoDeployQueue();
        }, 350);
    }

    disposables.push(vscode.commands.registerCommand('salesforceMetadata.connect', async () => {
        await setLoginProblem(null);
        const current = loadStoredConn();
        const isChromeExtension = Boolean(globalThis?.chrome?.runtime?.id);

        let instanceUrl = '';
        let accessToken = '';
        let authType = '';
        let username = '';
        let userId = '';
        let orgId = '';
        let selectedSharedConfiguration = null;

        const connectMethod = await vscode.window.showQuickPick(
            [
                {
                    label: 'Select Org from list',
                    description: 'Open or create the workspace tied to a saved org',
                    _selectOrg: true,
                },
                {
                    label: 'Paste Access Token Manually',
                    description: 'Connect inside the current workspace',
                    _manual: true,
                },
            ],
            {
                title: 'Connect to Salesforce',
                placeHolder: 'Choose how you want to connect',
                ignoreFocusOut: true,
            }
        );
        if (!connectMethod) return;

        if (connectMethod._selectOrg) {
            const sharedConnections = await listSharedConnectionEntries().catch(() => []);
            if (!sharedConnections.length) {
                await vscode.window.showWarningMessage('No saved orgs were found in the shared connection list.');
                return;
            }
            const pickedOrg = await vscode.window.showQuickPick(sharedConnections, {
                title: 'Select Org from list',
                placeHolder: 'Choose the org workspace to open',
                ignoreFocusOut: true,
                matchOnDescription: true,
                matchOnDetail: true,
            });
            if (!pickedOrg?.configuration) return;
            selectedSharedConfiguration = pickedOrg.configuration;
        }

        if (selectedSharedConfiguration) {
            try {
                const connector = await connectUsingSharedConfiguration(selectedSharedConfiguration);
                const stored = toStoredConnectionFromConnector(connector, {
                    instanceUrl: selectedSharedConfiguration.instanceUrl,
                    apiVersion: selectedSharedConfiguration.version || current.apiVersion || '63.0',
                    workspaceRoot: deriveWorkspaceRootFromConnection(
                        {
                            username: selectedSharedConfiguration.username,
                            instanceUrl: selectedSharedConfiguration.instanceUrl,
                            orgId: selectedSharedConfiguration.orgId,
                        },
                        getWorkspaceRootPath(vscode)
                    ),
                });
                if (!stored.instanceUrl || !stored.accessToken) {
                    throw new Error('Selected connection did not produce a usable access token.');
                }
                await saveConn(stored);
                setStatus(statusItem, stored);
                await setLoginProblem(null);
                if (reloadForConnectionWorkspaceIfNeeded(vscode, stored)) {
                    return;
                }
                vscode.window.showInformationMessage(`Salesforce connected: ${selectedSharedConfiguration.alias}`);
                return;
            } catch (e) {
                const msg = e?.message || String(e);
                await setLoginProblem(msg);
                vscode.window.showErrorMessage(`Salesforce connect failed: ${msg}`);
                return;
            }
        }

        if (!instanceUrl) {
            instanceUrl = await vscode.window.showInputBox({
                title: 'Salesforce instance URL',
                prompt: 'Example: https://mydomain.my.salesforce.com',
                value: current.instanceUrl || '',
                ignoreFocusOut: true,
            });
            if (!instanceUrl) return;
        }

        if (!accessToken) {
            accessToken = await vscode.window.showInputBox({
                title: 'Salesforce access token',
                prompt: 'Paste an OAuth access token (stored in sessionStorage)',
                value: '',
                password: true,
                ignoreFocusOut: true,
            });
            if (!accessToken) return;
            authType = authType || 'manual';
        }

        const apiVersion = await vscode.window.showInputBox({
            title: 'Salesforce API version',
            prompt: 'Example: 63.0',
            value: current.apiVersion || '63.0',
            ignoreFocusOut: true,
        });

        const conn = createToolingClient({
            instanceUrl,
            accessToken,
            apiVersion,
            proxyUrl: isChromeExtension ? undefined : window.location.origin,
        });

        try {
            await conn.ping();
            // Best-effort identity enrichment (works for both OAuth and session cookies).
            const info = (!username || !userId || !orgId)
                ? await fetchUserInfo({ instanceUrl: conn.instanceUrl, accessToken }).catch(() => null)
                : null;
            const stored = {
                instanceUrl: conn.instanceUrl,
                apiVersion: conn.apiVersion,
                accessToken,
                authType: authType || 'manual',
                sharedAlias: '',
                oauthConnectionId: '',
                username: username || info?.username || '',
                userId: userId || info?.userId || '',
                orgId: orgId || info?.orgId || '',
                workspaceRoot: getWorkspaceRootPath(vscode),
            };
            await saveConn(stored);
            setStatus(statusItem, stored);
            await setLoginProblem(null);
            vscode.window.showInformationMessage('Salesforce connected.');
        } catch (e) {
            const msg = e?.message || String(e);
            await setLoginProblem(msg);
            vscode.window.showErrorMessage(`Salesforce connect failed: ${msg}`);
        }
    }));

    disposables.push(vscode.commands.registerCommand('salesforceMetadata.disconnect', async () => {
        clearConn();
        await removeSession().catch(() => {});
        await setLoginProblem(null);
        setStatus(statusItem, loadStoredConn());
        vscode.window.showInformationMessage('Salesforce disconnected.');
    }));

    disposables.push(vscode.commands.registerCommand('salesforceMetadata.fetchMetadata', async () => {
        const conn = loadStoredConn();
        if (!conn.instanceUrl || !conn.accessToken) {
            await vscode.commands.executeCommand('salesforceMetadata.connect');
            return;
        }
        await vscode.window.withProgress(
            { location: vscode.ProgressLocation.Notification, title: 'Syncing project from Salesforce...', cancellable: false },
            async () => {
                await withToolingClientAuthed(conn, async (client) => {
                    await fetchAndPopulateWorkspace(vscode, client);
                });
            }
        );
        toolingMapCache = null;
        try {
            await vscode.commands.executeCommand('salesforceMetadata.refreshProject');
        } catch {
            // ignore
        }
        vscode.window.showInformationMessage('Project synced from Salesforce.');
    }));

    // LWC lint on save
    if (vscode.workspace?.onDidSaveTextDocument) {
        disposables.push(
            vscode.workspace.onDidSaveTextDocument(async (doc) => {
                try {
                    await lintLwcDocument(doc);
                } catch (e) {
                    // eslint-disable-next-line no-console
                    console.warn('LWC lint failed:', e);
                }
                try {
                    if (loadAutoDeployOnSave()) {
                        const conn = loadStoredConn();
                        if (!conn.instanceUrl || !conn.accessToken) return;
                        const mapItems = await loadToolingMapItems();
                        if (mapItems?.[doc?.uri?.path]) enqueueAutoDeploy(doc);
                    }
                } catch {
                    // ignore
                }
            })
        );
    }
    if (vscode.workspace?.onDidCloseTextDocument && (lwcDiagnostics || deployDiagnostics)) {
        disposables.push(
            vscode.workspace.onDidCloseTextDocument((doc) => {
                try {
                    if (isLwcDoc(doc)) {
                        lwcDiagnostics.delete(doc.uri);
                    }
                } catch {
                    // ignore
                }
                try {
                    deployDiagnostics?.delete?.(doc?.uri);
                } catch {
                    // ignore
                }
            })
        );
    }

    disposables.push(vscode.commands.registerCommand('salesforceMetadata.lintCurrentFile', async () => {
        const editor = vscode.window?.activeTextEditor;
        const doc = editor?.document;
        if (!doc) return;
        await lintLwcDocument(doc);
    }));

    disposables.push(vscode.commands.registerCommand('salesforceMetadata.deployCurrentFile', async () => {
        const editor = vscode.window?.activeTextEditor;
        const doc = editor?.document;
        if (!doc?.uri?.path) return;
        await deployPaths([doc.uri.path], { showProgress: true, title: 'Deploying current file...' });
    }));

    disposables.push(vscode.commands.registerCommand('salesforceMetadata.fetchCurrentFile', async () => {
        const editor = vscode.window?.activeTextEditor;
        const doc = editor?.document;
        if (!doc?.uri?.path) return;
        await fetchPathFromSalesforce(doc.uri.path, { showProgress: true });
    }));

    async function fetchRemoteTextForEntry(client, entry) {
        const id = String(entry?.id || '');
        if (!id) return null;
        if (entry.type === 'ApexClass') {
            const rows = await client.toolingQueryAll(`SELECT Id, Body FROM ApexClass WHERE Id='${id}'`);
            return rows?.[0]?.Body ?? null;
        }
        if (entry.type === 'ApexTrigger') {
            const rows = await client.toolingQueryAll(`SELECT Id, Body FROM ApexTrigger WHERE Id='${id}'`);
            return rows?.[0]?.Body ?? null;
        }
        if (entry.type === 'LightningComponentResource') {
            const rows = await client.toolingQueryAll(`SELECT Id, Source FROM LightningComponentResource WHERE Id='${id}'`);
            return rows?.[0]?.Source ?? null;
        }
        if (entry.type === 'AuraDefinition') {
            const rows = await client.toolingQueryAll(`SELECT Id, Source FROM AuraDefinition WHERE Id='${id}'`);
            return rows?.[0]?.Source ?? null;
        }
        return null;
    }

    disposables.push(vscode.commands.registerCommand('salesforceMetadata.diffCurrentFile', async () => {
        const editor = vscode.window?.activeTextEditor;
        const doc = editor?.document;
        const path = doc?.uri?.path;
        if (!path) return;

        const conn = loadStoredConn();
        if (!conn.instanceUrl || !conn.accessToken) {
            await vscode.commands.executeCommand('salesforceMetadata.connect');
            return;
        }

        const mapItems = await loadToolingMapItems();
        const entry = mapItems?.[path];
        if (!entry?.type || !entry?.id) {
            await vscode.window.showWarningMessage('This file is not in tooling-map.json. Fetch metadata first.');
            return;
        }

        const remoteText = await vscode.window.withProgress(
            { location: vscode.ProgressLocation.Notification, title: 'Fetching remote source…', cancellable: false },
            async () => await withToolingClientAuthed(conn, async (client) => await fetchRemoteTextForEntry(client, entry))
        );

        if (remoteText == null) {
            await vscode.window.showWarningMessage('Salesforce returned no source for this file.');
            return;
        }

        const remoteUri = getWorkspaceUri(vscode, `.salesforce/.diff${path}`);
        await writeTextFile(vscode, remoteUri, remoteText, { skipCache: true });

        // Try opening a diff view (preferred).
        try {
            const title = `Diff: ${path.split('/').pop() || path} (local ↔ org)`;
            await vscode.commands.executeCommand('vscode.diff', remoteUri, doc.uri, title);
            return;
        } catch {
            // ignore
        }

        // Fallback: try alternate compare commands present in some workbench builds.
        try {
            const cmds = await vscode.commands.getCommands(true);
            const candidate = [
                'workbench.action.compareEditorWith',
                'workbench.action.compareEditorWithPrevious',
                'workbench.action.compareWithClipboard',
            ].find((c) => cmds.includes(c));
            if (candidate) {
                // Use the remote doc as the active editor, then invoke compare commands.
                const remoteDoc = await vscode.workspace.openTextDocument(remoteUri);
                await vscode.window.showTextDocument(remoteDoc, { preview: true });
                await vscode.window.showTextDocument(doc, { preview: true });
                await vscode.commands.executeCommand(candidate);
                return;
            }
        } catch {
            // ignore
        }

        // Fallback: open the remote doc.
        try {
            const remoteDoc = await vscode.workspace.openTextDocument(remoteUri);
            await vscode.window.showTextDocument(remoteDoc, { preview: true });
        } catch {
            await vscode.window.showInformationMessage(`Remote source written under ${getWorkspacePath(vscode, '.salesforce/.diff')} (diff command unavailable).`);
        }
    }));

    const changedPaths = new Set();
    if (vscode.workspace?.onDidChangeTextDocument) {
        disposables.push(
            vscode.workspace.onDidChangeTextDocument((e) => {
                try {
                    const p = e?.document?.uri?.path;
                    if (p) changedPaths.add(p);
                } catch {
                    // ignore
                }
            })
        );
    }

    async function queryRemoteStampsByType(client, sobject, ids) {
        const list = Array.from(ids || []).filter(Boolean);
        const out = new Map();
        const chunkSize = 100;

        const tryQuery = async (soql) => {
            const rows = await client.toolingQueryAll(soql);
            for (const r of rows || []) {
                if (!r?.Id) continue;
                const stamp = pickRemoteStamp(r);
                if (stamp) out.set(String(r.Id), stamp);
            }
        };

        for (let i = 0; i < list.length; i += chunkSize) {
            const chunk = list.slice(i, i + chunkSize);
            const inList = chunk.map((x) => `'${String(x).replace(/'/g, "\\\\'")}'`).join(',');
            try {
                // eslint-disable-next-line no-await-in-loop
                await tryQuery(`SELECT Id, LastModifiedDate, SystemModstamp FROM ${sobject} WHERE Id IN (${inList})`);
            } catch {
                try {
                    // eslint-disable-next-line no-await-in-loop
                    await tryQuery(`SELECT Id, LastModifiedDate FROM ${sobject} WHERE Id IN (${inList})`);
                } catch {
                    // Give up on this chunk.
                }
            }
        }
        return out;
    }

    function toMs(stamp) {
        if (!stamp) return null;
        const ms = Date.parse(String(stamp));
        return Number.isFinite(ms) ? ms : null;
    }

    async function computeRemoteChangeStatus() {
        const conn = loadStoredConn();
        if (!conn.instanceUrl || !conn.accessToken) {
            await vscode.commands.executeCommand('salesforceMetadata.connect');
            return {
                remoteChangedPaths: [],
                localChangedPaths: [],
                conflictPaths: [],
                note: 'Not connected.',
            };
        }

        const mapItems = await loadToolingMapItems();
        const paths = Object.keys(mapItems || {});

        const localChangedPaths = Array.from(changedPaths).filter((p) => Boolean(mapItems?.[p]));

        const tracking = await loadSourceTracking(vscode);
        const trackingInstanceUrl = tracking?.instanceUrl ? String(tracking.instanceUrl) : '';
        if (!tracking?.items || trackingInstanceUrl !== conn.instanceUrl) {
            return {
                remoteChangedPaths: [],
                localChangedPaths,
                conflictPaths: [],
                note: 'No source-tracking snapshot for this org. Run Sync Project first.',
            };
        }

        const idsByType = {
            ApexClass: new Set(),
            ApexTrigger: new Set(),
            LightningComponentResource: new Set(),
            AuraDefinition: new Set(),
        };
        for (const p of paths) {
            const e = mapItems?.[p];
            if (!e?.type || !e?.id) continue;
            if (idsByType[e.type]) idsByType[e.type].add(e.id);
        }

        return await withToolingClientAuthed(conn, async (client) => {
            const [classStamps, triggerStamps, lwcStamps, auraStamps] = await Promise.all([
                queryRemoteStampsByType(client, 'ApexClass', idsByType.ApexClass),
                queryRemoteStampsByType(client, 'ApexTrigger', idsByType.ApexTrigger),
                queryRemoteStampsByType(client, 'LightningComponentResource', idsByType.LightningComponentResource),
                queryRemoteStampsByType(client, 'AuraDefinition', idsByType.AuraDefinition),
            ]);

            const getRemoteStamp = (type, id) => {
                const key = String(id || '');
                if (!key) return null;
                if (type === 'ApexClass') return classStamps.get(key) || null;
                if (type === 'ApexTrigger') return triggerStamps.get(key) || null;
                if (type === 'LightningComponentResource') return lwcStamps.get(key) || null;
                if (type === 'AuraDefinition') return auraStamps.get(key) || null;
                return null;
            };

            const remoteChangedPaths = [];
            for (const p of paths) {
                const e = mapItems?.[p];
                if (!e?.type || !e?.id) continue;
                const remoteStamp = getRemoteStamp(e.type, e.id);
                const prevStamp = tracking?.items?.[p]?.remoteStamp || null;
                if (!remoteStamp || !prevStamp) continue;
                const remoteMs = toMs(remoteStamp);
                const prevMs = toMs(prevStamp);
                if (remoteMs != null && prevMs != null) {
                    if (remoteMs > prevMs) remoteChangedPaths.push(p);
                } else if (String(remoteStamp) !== String(prevStamp)) {
                    remoteChangedPaths.push(p);
                }
            }

            const localSet = new Set(localChangedPaths);
            const conflictPaths = remoteChangedPaths.filter((p) => localSet.has(p));
            return { remoteChangedPaths, localChangedPaths, conflictPaths, note: null };
        });
    }

    async function updateSourceTrackingForPaths(paths) {
        const conn = loadStoredConn();
        if (!conn.instanceUrl || !conn.accessToken) return;
        const mapItems = await loadToolingMapItems();
        const tracking = (await loadSourceTracking(vscode)) || {};
        if (!tracking.items || typeof tracking.items !== 'object') tracking.items = {};
        tracking.instanceUrl = conn.instanceUrl;
        tracking.apiVersion = conn.apiVersion;
        tracking.generatedAt = new Date().toISOString();

        const idsByType = {
            ApexClass: new Set(),
            ApexTrigger: new Set(),
            LightningComponentResource: new Set(),
            AuraDefinition: new Set(),
        };
        for (const p of paths || []) {
            const e = mapItems?.[p];
            if (!e?.type || !e?.id) continue;
            if (idsByType[e.type]) idsByType[e.type].add(e.id);
        }
        const stampsByType = await withToolingClientAuthed(conn, async (client) => ({
            ApexClass: await queryRemoteStampsByType(client, 'ApexClass', idsByType.ApexClass),
            ApexTrigger: await queryRemoteStampsByType(client, 'ApexTrigger', idsByType.ApexTrigger),
            LightningComponentResource: await queryRemoteStampsByType(client, 'LightningComponentResource', idsByType.LightningComponentResource),
            AuraDefinition: await queryRemoteStampsByType(client, 'AuraDefinition', idsByType.AuraDefinition),
        }));

        for (const p of paths || []) {
            const e = mapItems?.[p];
            if (!e?.type || !e?.id) continue;
            // eslint-disable-next-line no-await-in-loop
            const text = await readTextForPath(p);
            const stamp = stampsByType[e.type]?.get(String(e.id)) || null;
            tracking.items[p] = {
                type: e.type,
                id: e.id,
                ...(e.namespace ? { namespace: e.namespace } : {}),
                ...(e.readOnly ? { readOnly: true } : {}),
                remoteStamp: stamp,
                hash: hashText(text ?? ''),
            };
        }

        try {
            await saveSourceTracking(vscode, tracking);
        } catch {
            // ignore
        }
    }

    disposables.push(vscode.commands.registerCommand('salesforceMetadata.deployChangedFiles', async () => {
        const paths = Array.from(changedPaths);
        await deployPaths(paths, { showProgress: true, title: 'Deploying changed files...' });
        changedPaths.clear();
    }));

    disposables.push(vscode.commands.registerCommand('salesforceMetadata.sourceStatus', async () => {
        const status = await computeRemoteChangeStatus();
        const local = status.localChangedPaths?.length || 0;
        const remote = status.remoteChangedPaths?.length || 0;
        const conflicts = status.conflictPaths?.length || 0;
        const msg = `Local changes: ${local} • Remote changes: ${remote} • Conflicts: ${conflicts}`;
        try {
            statusItem.tooltip = status.note ? `${msg}\n\n${status.note}` : msg;
        } catch {
            // ignore
        }
        if (status.note) {
            await vscode.window.showWarningMessage(`${msg}\n\n${status.note}`);
        } else {
            await vscode.window.showInformationMessage(msg);
        }
    }));

    disposables.push(vscode.commands.registerCommand('salesforceMetadata.pullRemoteChanges', async () => {
        const status = await computeRemoteChangeStatus();
        if (status.note && !status.remoteChangedPaths?.length) {
            await vscode.window.showWarningMessage(status.note);
            return;
        }
        const remoteChanged = status.remoteChangedPaths || [];
        if (!remoteChanged.length) {
            await vscode.window.showInformationMessage('No remote changes found.');
            return;
        }

        const conflicts = status.conflictPaths || [];
        const conflictSet = new Set(conflicts);
        const nonConflicting = remoteChanged.filter((p) => !conflictSet.has(p));

        let toPull = [...nonConflicting];
        if (conflicts.length) {
            const action = await vscode.window.showQuickPick(
                [
                    { label: 'Pull non-conflicting changes', detail: `Pull ${nonConflicting.length} file(s) and skip ${conflicts.length} conflict(s).`, id: 'nonconflict' },
                    { label: 'Review conflicts…', detail: 'Choose which conflicting files to overwrite locally.', id: 'review' },
                    { label: 'Cancel', detail: '', id: 'cancel' },
                ],
                {
                    title: 'Remote changes detected',
                    placeHolder: 'Choose how to handle conflicts',
                    ignoreFocusOut: true,
                }
            );
            if (!action || action.id === 'cancel') return;
            if (action.id === 'review') {
                const picks = conflicts.map((p) => ({ label: p.split('/').pop() || p, description: p, picked: true, path: p }));
                const selected = await vscode.window.showQuickPick(picks, {
                    title: 'Conflicts: select files to pull (overwrite local)',
                    placeHolder: 'Choose conflicting files',
                    canPickMany: true,
                    ignoreFocusOut: true,
                    matchOnDescription: true,
                });
                if (!selected) return;
                const selectedPaths = selected.map((x) => x.path).filter(Boolean);
                toPull = [...nonConflicting, ...selectedPaths];
            }
        }

        if (!toPull.length) {
            await vscode.window.showInformationMessage('Nothing selected to pull.');
            return;
        }

        await vscode.window.withProgress(
            { location: vscode.ProgressLocation.Notification, title: 'Pulling remote changes...', cancellable: true },
            async (progress, token) => {
                const total = toPull.length;
                let done = 0;
                for (const p of toPull) {
                    if (token?.isCancellationRequested) break;
                    progress.report({ message: p, increment: total ? (100 / total) : 0 });
                    // eslint-disable-next-line no-await-in-loop
                    await fetchPathFromSalesforce(p, { showProgress: false });
                    done += 1;
                }
                progress.report({ message: `Pulled ${done}/${total}` });
            }
        );

        await updateSourceTrackingForPaths(toPull);
        try {
            logLines([
                '',
                `=== Pull (${new Date().toLocaleString()}) ===`,
                `Items: ${toPull.length}`,
                ...toPull.map((p) => `  PULL ${p}`),
            ]);
        } catch {
            // ignore
        }
        await vscode.window.showInformationMessage(`Pulled ${toPull.length} file(s) from Salesforce.`);
    }));

    disposables.push(vscode.commands.registerCommand('salesforceMetadata.orgBrowser', async () => {
        const conn = loadStoredConn();
        if (!conn.instanceUrl || !conn.accessToken) {
            await vscode.commands.executeCommand('salesforceMetadata.connect');
            return;
        }
        await withToolingClientAuthed(conn, async (client) => {

        const typePick = await vscode.window.showQuickPick(
            [
                { label: 'Apex Classes', type: 'ApexClass' },
                { label: 'Apex Triggers', type: 'ApexTrigger' },
                { label: 'LWC Bundles', type: 'LightningComponentBundle' },
                { label: 'Aura Bundles', type: 'AuraDefinitionBundle' },
            ],
            { title: 'Org Browser', placeHolder: 'Select a metadata type', ignoreFocusOut: true }
        );
        if (!typePick) return;

        const fetchList = async () => {
            if (typePick.type === 'ApexClass') {
                return await client.toolingQueryAll('SELECT Id, Name, Body FROM ApexClass ORDER BY Name');
            }
            if (typePick.type === 'ApexTrigger') {
                return await client.toolingQueryAll('SELECT Id, Name, Body FROM ApexTrigger ORDER BY Name');
            }
            if (typePick.type === 'LightningComponentBundle') {
                return await client.toolingQueryAll('SELECT Id, DeveloperName, NamespacePrefix FROM LightningComponentBundle ORDER BY DeveloperName');
            }
            if (typePick.type === 'AuraDefinitionBundle') {
                return await client.toolingQueryAll('SELECT Id, DeveloperName, NamespacePrefix FROM AuraDefinitionBundle ORDER BY DeveloperName');
            }
            return [];
        };

        const rows = await vscode.window.withProgress(
            { location: vscode.ProgressLocation.Notification, title: 'Loading org metadata…', cancellable: false },
            async () => await fetchList()
        );

        if (!rows?.length) {
            await vscode.window.showInformationMessage('No items found.');
            return;
        }

        const items = rows.map((r) => {
            const name = r?.Name || r?.DeveloperName || r?.Id;
            const ns = r?.NamespacePrefix ? String(r.NamespacePrefix) : '';
            const label = ns ? `${name} (${ns})` : String(name);
            return { label, description: r?.Id, row: r };
        });

        const selected = await vscode.window.showQuickPick(items, {
            title: 'Org Browser',
            placeHolder: 'Select item(s) to pull into the workspace',
            canPickMany: true,
            ignoreFocusOut: true,
            matchOnDescription: true,
        });
        if (!selected || !selected.length) return;

        // Pull behavior:
        // - Apex: write body into the active force-app/main/default/(classes|triggers)
        // - LWC/Aura: pull the entire bundle (resource/defs)
        await vscode.window.withProgress(
            { location: vscode.ProgressLocation.Notification, title: 'Pulling selected items…', cancellable: false },
            async () => {
                const defaultRoot = getWorkspaceDefaultRootUri(vscode);
                for (const s of selected) {
                    const r = s?.row;
                    if (!r) continue;
                    if (typePick.type === 'ApexClass') {
                        const uri = vscode.Uri.joinPath(defaultRoot, 'classes', `${safeSeg(r.Name)}.cls`);
                        await writeTextFile(vscode, uri, r.Body || '');
                    } else if (typePick.type === 'ApexTrigger') {
                        const uri = vscode.Uri.joinPath(defaultRoot, 'triggers', `${safeSeg(r.Name)}.trigger`);
                        await writeTextFile(vscode, uri, r.Body || '');
                    } else if (typePick.type === 'LightningComponentBundle') {
                        const bundleName = safeSeg(r.DeveloperName);
                        const bundlePath = vscode.Uri.joinPath(defaultRoot, 'lwc', bundleName);
                        await ensureDir(vscode, bundlePath);
                        const resources = await client.toolingQueryAll(
                            `SELECT Id, FilePath, Format, Source FROM LightningComponentResource WHERE LightningComponentBundleId='${r.Id}' ORDER BY FilePath`
                        );
                        for (const res of resources) {
                            if (!res?.Source) continue;
                            const rel = normalizeLwcResourceRelPath(bundleName, res.FilePath, res.Format);
                            const parts = rel.split('/').map(safeSeg).filter((p) => p && p !== '.' && p !== '..');
                            const target = vscode.Uri.joinPath(bundlePath, ...parts);
                            await writeTextFile(vscode, target, res.Source || '');
                        }
                    } else if (typePick.type === 'AuraDefinitionBundle') {
                        const bundleName = safeSeg(r.DeveloperName);
                        const bundlePath = vscode.Uri.joinPath(defaultRoot, 'aura', bundleName);
                        await ensureDir(vscode, bundlePath);
                        const defs = await client.toolingQueryAll(
                            `SELECT Id, DefType, Format, Source FROM AuraDefinition WHERE AuraDefinitionBundleId='${r.Id}' ORDER BY DefType`
                        );
                        const used = new Set();
                        for (const d of defs) {
                            if (!d?.Source) continue;
                            let file = safeSeg(auraFilename(bundleName, d.DefType, d.Format));
                            if (used.has(file)) file = `${file}.${String(d.Id || '').slice(-6)}`;
                            used.add(file);
                            const target = vscode.Uri.joinPath(bundlePath, file);
                            await writeTextFile(vscode, target, d.Source || '');
                        }
                    }
                }
            }
        );

        await vscode.window.showInformationMessage(`Pulled ${selected.length} item(s) into the workspace.`);
        try {
            await vscode.commands.executeCommand('salesforceMetadata.refreshProject');
        } catch {
            // ignore
        }
        });
    }));

    function parsePackageXml(xmlText) {
        const out = new Map(); // typeName -> Set<members>
        const text = String(xmlText || '');
        if (!text.trim()) return out;
        try {
            const doc = new DOMParser().parseFromString(text, 'application/xml');
            const types = Array.from(doc.getElementsByTagName('types') || []);
            for (const t of types) {
                const nameEl = t.getElementsByTagName('name')?.[0];
                const typeName = nameEl?.textContent ? String(nameEl.textContent).trim() : '';
                if (!typeName) continue;
                const members = Array.from(t.getElementsByTagName('members') || [])
                    .map((m) => String(m.textContent || '').trim())
                    .filter(Boolean);
                if (!members.length) continue;
                out.set(typeName, new Set(members));
            }
            return out;
        } catch {
            // fall through to regex parse
        }
        // Very small fallback parser (best-effort).
        const typesBlocks = text.split(/<types>/i).slice(1);
        for (const block of typesBlocks) {
            const nameMatch = block.match(/<name>\s*([^<]+)\s*<\/name>/i);
            const typeName = nameMatch ? String(nameMatch[1]).trim() : '';
            if (!typeName) continue;
            const members = Array.from(block.matchAll(/<members>\s*([^<]+)\s*<\/members>/gi))
                .map((m) => String(m[1] || '').trim())
                .filter(Boolean);
            if (!members.length) continue;
            out.set(typeName, new Set(members));
        }
        return out;
    }

    async function loadToolingMapJson() {
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

    async function saveToolingMapJson(obj) {
        const uri = getWorkspaceUri(vscode, '.salesforce/tooling-map.json');
        const next = obj && typeof obj === 'object' ? obj : { items: {} };
        if (!next.items || typeof next.items !== 'object') next.items = {};
        next.generatedAt = new Date().toISOString();
        await writeTextFile(vscode, uri, JSON.stringify(next, null, 2), { skipCache: true });
        toolingMapCache = null;
    }

    async function withMetadataApiClientAuthed(conn, fn) {
        const current = await resolveStoredConnection(conn).catch(() => conn);
        const isChromeExtension = Boolean(globalThis?.chrome?.runtime?.id);
        const proxyUrl = isChromeExtension ? undefined : window.location.origin;
        const client = createMetadataApiClient({
            instanceUrl: current.instanceUrl,
            apiVersion: current.apiVersion,
            accessToken: current.accessToken,
            proxyUrl,
        });
        try {
            return await fn(client, current);
        } catch (e) {
            if (!isAuthError(e)) throw e;
            const refreshed = await refreshStoredConnection(current).catch(() => null);
            if (!refreshed) throw e;
            const retryClient = createMetadataApiClient({
                instanceUrl: refreshed.instanceUrl,
                apiVersion: refreshed.apiVersion,
                accessToken: refreshed.accessToken,
                proxyUrl,
            });
            return await fn(retryClient, refreshed);
        }
    }

    async function retrieveViaMetadataApi(conn, typesMap, { title } = {}) {
        const { id, effectiveConn } = await withMetadataApiClientAuthed(conn, async (client, effectiveConn) => {
            const res = await client.retrieve({ typesMap });
            return { id: res.id, effectiveConn };
        });
        const startedAt = Date.now();
        let lastStatus = '';

        const status = await vscode.window.withProgress(
            { location: vscode.ProgressLocation.Notification, title: title || 'Retrieving via Metadata API…', cancellable: false },
            async (progress) => {
                for (;;) {
                    // eslint-disable-next-line no-await-in-loop
                    const s = await withMetadataApiClientAuthed(effectiveConn || conn, async (client) => await client.checkRetrieveStatus(id, { includeZip: true }));
                    const msg = s.status || (s.done ? (s.success ? 'Succeeded' : 'Failed') : 'In progress');
                    if (msg && msg !== lastStatus) {
                        lastStatus = msg;
                        progress.report({ message: msg });
                    }
                    if (s.done) return s;
                    if (Date.now() - startedAt > 10 * 60 * 1000) {
                        throw new Error('Retrieve timed out (10 minutes).');
                    }
                    // eslint-disable-next-line no-await-in-loop
                    await new Promise((r) => setTimeout(r, 2000));
                }
            }
        );

        if (!status.success) {
            throw new Error(status.errorMessage || `Retrieve failed: ${status.status || 'Unknown error'}`);
        }
        if (!status.zipFile) {
            throw new Error('Retrieve succeeded but returned no zipFile.');
        }

        const files = unzipRetrieveZip(status.zipFile);
        const written = [];
        const map = {
            generatedAt: new Date().toISOString(),
            instanceUrl: (effectiveConn || conn).instanceUrl,
            apiVersion: (effectiveConn || conn).apiVersion,
            items: {},
        };

        const root = getWorkspaceDefaultRootUri(vscode);
        const base = root.path;
        await ensureDir(vscode, root);

        for (const [zipPathRaw, bytes] of Object.entries(files || {})) {
            const zipPath = String(zipPathRaw || '');
            if (!zipPath || zipPath.endsWith('/')) continue;
            let rel = zipPath.replace(/\\/g, '/');
            if (rel.startsWith('unpackaged/')) rel = rel.slice('unpackaged/'.length);
            if (!rel || rel === 'package.xml' || rel.endsWith('/package.xml')) continue;

            const target = vscode.Uri.file(`${base}/${rel}`.replace(/\/+/g, '/'));
            // eslint-disable-next-line no-await-in-loop
            await writeBytesFile(vscode, target, bytes);
            written.push(target.path);
            map.items[target.path] = { zipPath };
        }

        await writeTextFile(
            vscode,
            getWorkspaceUri(vscode, '.salesforce/metadata-api-map.json'),
            JSON.stringify(map, null, 2),
            { skipCache: true }
        );

        return { writtenPaths: written };
    }

    async function deployViaMetadataApi(conn, { packageXmlText, checkOnly } = {}) {
        const root = getWorkspaceDefaultRootUri(vscode);
        const { files } = await listFilesAndDirsRecursive(vscode, root);
        const pathToBytes = {};
        pathToBytes['unpackaged/package.xml'] = new TextEncoder().encode(String(packageXmlText || ''));

        for (const u of files || []) {
            const p = u?.path || '';
            if (!p || p.includes('/.salesforce/') || p.includes('/.vscode/')) continue;
            const defaultRootPath = `${root.path.replace(/\/+$/, '')}/`;
            const rel = p.startsWith(defaultRootPath)
                ? p.slice(defaultRootPath.length)
                : null;
            if (!rel) continue;
            // eslint-disable-next-line no-await-in-loop
            const bytes = await vscode.workspace.fs.readFile(u);
            pathToBytes[`unpackaged/${rel}`] = bytes;
        }

        const zipBytes = zipUnpackagedFiles(pathToBytes);
        const { id, effectiveConn } = await withMetadataApiClientAuthed(conn, async (client, effectiveConn) => {
            const res = await client.deploy(zipBytes, { checkOnly: Boolean(checkOnly) });
            return { id: res.id, effectiveConn };
        });

        const startedAt = Date.now();
        let lastStatus = '';
        const status = await vscode.window.withProgress(
            { location: vscode.ProgressLocation.Notification, title: checkOnly ? 'Validating deploy…' : 'Deploying…', cancellable: false },
            async (progress) => {
                for (;;) {
                    // eslint-disable-next-line no-await-in-loop
                    const s = await withMetadataApiClientAuthed(effectiveConn || conn, async (client) => await client.checkDeployStatus(id, { includeDetails: true }));
                    const msg = s.status || (s.done ? (s.success ? 'Succeeded' : 'Failed') : 'In progress');
                    if (msg && msg !== lastStatus) {
                        lastStatus = msg;
                        progress.report({ message: msg });
                    }
                    if (s.done) return s;
                    if (Date.now() - startedAt > 20 * 60 * 1000) {
                        throw new Error('Deploy timed out (20 minutes).');
                    }
                    // eslint-disable-next-line no-await-in-loop
                    await new Promise((r) => setTimeout(r, 2000));
                }
            }
        );

        if (!status.success) {
            throw new Error(status.errorMessage || `Deploy failed: ${status.status || 'Unknown error'}`);
        }
        return status;
    }

    disposables.push(vscode.commands.registerCommand('salesforceMetadata.retrieveManifest', async () => {
        const conn = loadStoredConn();
        if (!conn.instanceUrl || !conn.accessToken) {
            await vscode.commands.executeCommand('salesforceMetadata.connect');
            return;
        }

        const projectRoot = getWorkspaceRootUri(vscode);
        const { files } = await listFilesAndDirsRecursive(vscode, projectRoot);
        const candidates = (files || [])
            .filter((u) => u?.path && u.path.toLowerCase().endsWith('package.xml'))
            .slice(0, 50);

        if (!candidates.length) {
            await vscode.window.showWarningMessage(`No package.xml found under ${getWorkspaceRootPath(vscode)}.`);
            return;
        }

        const pickItems = candidates.map((u) => ({
            label: toWorkspaceRelativeLabel(vscode, u.path),
            description: u.path,
            uri: u,
        }));

        const picked = await vscode.window.showQuickPick(pickItems, {
            title: 'Retrieve from manifest (package.xml)',
            placeHolder: 'Select a package.xml',
            ignoreFocusOut: true,
            matchOnDescription: true,
        });
        if (!picked?.uri) return;

        const xml = new TextDecoder().decode(await vscode.workspace.fs.readFile(picked.uri));
        const manifest = parsePackageXml(xml);
        if (!manifest.size) {
            await vscode.window.showErrorMessage('Manifest parse failed or contains no <types>.');
            return;
        }

        const toolingSupported = new Set(['ApexClass', 'ApexTrigger', 'LightningComponentBundle', 'AuraDefinitionBundle']);
        const requestedToolingTypes = Array.from(manifest.keys()).filter((t) => toolingSupported.has(t));
        const hasUnsupported = Array.from(manifest.keys()).some((t) => !toolingSupported.has(t));

        if (hasUnsupported) {
            const pick = await vscode.window.showQuickPick(
                [
                    {
                        label: 'Retrieve full manifest via Metadata API (recommended)',
                        detail: 'Supports Flows, Permission Sets, Custom Objects, and more',
                        _metadataApi: true,
                    },
                    {
                        label: 'Retrieve supported types via Tooling API (fast)',
                        detail: 'Only: ApexClass, ApexTrigger, LightningComponentBundle, AuraDefinitionBundle',
                        _tooling: true,
                    },
                ],
                { title: 'Manifest contains non-Tooling types', ignoreFocusOut: true }
            );
            if (!pick) return;
            if (pick._metadataApi) {
                const res = await retrieveViaMetadataApi(conn, manifest, { title: 'Retrieving manifest via Metadata API…' });
                toolingMapCache = null;
                try { await vscode.commands.executeCommand('salesforceMetadata.refreshProject'); } catch {}
                await vscode.window.showInformationMessage(`Retrieved ${res.writtenPaths.length} file(s) via Metadata API.`);
                return;
            }
        }

        if (!requestedToolingTypes.length) {
            await vscode.window.showWarningMessage(
                'Manifest does not include Tooling-supported types. Use “Retrieve Source in Manifest (Metadata API)” instead.'
            );
            return;
        }
        await withToolingClientAuthed(conn, async (client) => {

        const toolingMap = await loadToolingMapJson();
        const pulledPaths = [];

        const ensureDefaultDirs = async () => {
            await ensureDir(vscode, getWorkspaceUri(vscode, 'force-app/main/default/classes'));
            await ensureDir(vscode, getWorkspaceUri(vscode, 'force-app/main/default/triggers'));
            await ensureDir(vscode, getWorkspaceUri(vscode, 'force-app/main/default/lwc'));
            await ensureDir(vscode, getWorkspaceUri(vscode, 'force-app/main/default/aura'));
            await ensureDir(vscode, getSalesforceStateDirUri(vscode));
        };
        await ensureDefaultDirs();

        const membersOrAll = (set) => {
            const s = set instanceof Set ? set : new Set();
            return { all: s.has('*'), members: Array.from(s).filter((m) => m && m !== '*') };
        };

        const pullApex = async (sobject, dir, ext, members) => {
            const { all, members: names } = membersOrAll(members);
            const soql = all || !names.length
                ? `SELECT Id, Name, Body, LastModifiedDate, SystemModstamp FROM ${sobject} ORDER BY Name`
                : `SELECT Id, Name, Body, LastModifiedDate, SystemModstamp FROM ${sobject} WHERE Name IN (${names.map((n) => `'${String(n).replace(/'/g, "\\\\'")}'`).join(',')}) ORDER BY Name`;
            const rows = await client.toolingQueryAll(soql);
            for (const r of rows || []) {
                if (!r?.Id || !r?.Name) continue;
                const uri = getWorkspaceUri(vscode, `force-app/main/default/${dir}/${safeSeg(r.Name)}.${ext}`);
                await writeTextFile(vscode, uri, r.Body || '');
                pulledPaths.push(uri.path);
                toolingMap.items[uri.path] = { type: sobject, id: r.Id };
            }
        };

        const pullLwcBundles = async (members) => {
            const { all, members: names } = membersOrAll(members);
            const soql = all || !names.length
                ? 'SELECT Id, DeveloperName FROM LightningComponentBundle ORDER BY DeveloperName'
                : `SELECT Id, DeveloperName FROM LightningComponentBundle WHERE DeveloperName IN (${names.map((n) => `'${String(n).replace(/'/g, "\\\\'")}'`).join(',')}) ORDER BY DeveloperName`;
            const bundles = await client.toolingQueryAll(soql);
            for (const b of bundles || []) {
                if (!b?.Id || !b?.DeveloperName) continue;
                const bundleName = safeSeg(b.DeveloperName);
                const bundlePath = getWorkspaceUri(vscode, `force-app/main/default/lwc/${bundleName}`);
                await ensureDir(vscode, bundlePath);
                const resources = await toolingQueryAllWithFallback(
                    `SELECT Id, FilePath, Format, Source, LastModifiedDate, SystemModstamp FROM LightningComponentResource WHERE LightningComponentBundleId='${b.Id}' ORDER BY FilePath`,
                    `SELECT Id, FilePath, Format, Source FROM LightningComponentResource WHERE LightningComponentBundleId='${b.Id}' ORDER BY FilePath`
                );
                for (const r of resources || []) {
                    if (!r?.Id || !r?.Source) continue;
                    const rel = normalizeLwcResourceRelPath(bundleName, r.FilePath, r.Format);
                    const parts = rel.split('/').map(safeSeg).filter((p) => p && p !== '.' && p !== '..');
                    const target = vscode.Uri.joinPath(bundlePath, ...parts);
                    await writeTextFile(vscode, target, r.Source || '');
                    pulledPaths.push(target.path);
                    toolingMap.items[target.path] = { type: 'LightningComponentResource', id: r.Id, format: r.Format, filePath: r.FilePath };
                }
            }
        };

        const pullAuraBundles = async (members) => {
            const { all, members: names } = membersOrAll(members);
            const soql = all || !names.length
                ? 'SELECT Id, DeveloperName FROM AuraDefinitionBundle ORDER BY DeveloperName'
                : `SELECT Id, DeveloperName FROM AuraDefinitionBundle WHERE DeveloperName IN (${names.map((n) => `'${String(n).replace(/'/g, "\\\\'")}'`).join(',')}) ORDER BY DeveloperName`;
            const bundles = await client.toolingQueryAll(soql);
            for (const b of bundles || []) {
                if (!b?.Id || !b?.DeveloperName) continue;
                const bundleName = safeSeg(b.DeveloperName);
                const bundlePath = getWorkspaceUri(vscode, `force-app/main/default/aura/${bundleName}`);
                await ensureDir(vscode, bundlePath);
                const defs = await toolingQueryAllWithFallback(
                    `SELECT Id, DefType, Format, Source, LastModifiedDate, SystemModstamp FROM AuraDefinition WHERE AuraDefinitionBundleId='${b.Id}' ORDER BY DefType`,
                    `SELECT Id, DefType, Format, Source FROM AuraDefinition WHERE AuraDefinitionBundleId='${b.Id}' ORDER BY DefType`
                );
                const used = new Set();
                for (const d of defs || []) {
                    if (!d?.Id || !d?.Source) continue;
                    let file = safeSeg(auraFilename(bundleName, d.DefType, d.Format));
                    if (used.has(file)) file = `${file}.${String(d.Id || '').slice(-6)}`;
                    used.add(file);
                    const target = vscode.Uri.joinPath(bundlePath, file);
                    await writeTextFile(vscode, target, d.Source || '');
                    pulledPaths.push(target.path);
                    toolingMap.items[target.path] = { type: 'AuraDefinition', id: d.Id, defType: d.DefType, format: d.Format };
                }
            }
        };

        await vscode.window.withProgress(
            { location: vscode.ProgressLocation.Notification, title: 'Retrieving manifest contents…', cancellable: false },
            async () => {
                if (manifest.has('ApexClass')) await pullApex('ApexClass', 'classes', 'cls', manifest.get('ApexClass'));
                if (manifest.has('ApexTrigger')) await pullApex('ApexTrigger', 'triggers', 'trigger', manifest.get('ApexTrigger'));
                if (manifest.has('LightningComponentBundle')) await pullLwcBundles(manifest.get('LightningComponentBundle'));
                if (manifest.has('AuraDefinitionBundle')) await pullAuraBundles(manifest.get('AuraDefinitionBundle'));
            }
        );

        await saveToolingMapJson(toolingMap);
        await updateSourceTrackingForPaths(pulledPaths);

        await vscode.window.showInformationMessage(`Retrieved ${pulledPaths.length} file(s) from manifest.`);
        try {
            await vscode.commands.executeCommand('salesforceMetadata.refreshProject');
        } catch {
            // ignore
        }
        });
    }));

    async function pickPackageXmlUnderWorkspace() {
        const projectRoot = getWorkspaceRootUri(vscode);
        const { files } = await listFilesAndDirsRecursive(vscode, projectRoot);
        const candidates = (files || [])
            .filter((u) => u?.path && u.path.toLowerCase().endsWith('package.xml'))
            .slice(0, 50);
        if (!candidates.length) return null;
        const pickItems = candidates.map((u) => ({
            label: toWorkspaceRelativeLabel(vscode, u.path),
            description: u.path,
            uri: u,
        }));
        const picked = await vscode.window.showQuickPick(pickItems, {
            title: 'Select package.xml',
            placeHolder: 'Select a package.xml',
            ignoreFocusOut: true,
            matchOnDescription: true,
        });
        return picked?.uri || null;
    }

    disposables.push(vscode.commands.registerCommand('salesforceMetadata.retrieveMetadataApi', async () => {
        const conn = loadStoredConn();
        if (!conn.instanceUrl || !conn.accessToken) {
            await vscode.commands.executeCommand('salesforceMetadata.connect');
            return;
        }
        const uri = await pickPackageXmlUnderWorkspace();
        if (!uri) {
            await vscode.window.showWarningMessage(`No package.xml found under ${getWorkspaceRootPath(vscode)}.`);
            return;
        }
        const xml = new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));
        const manifest = parsePackageXml(xml);
        if (!manifest.size) {
            await vscode.window.showErrorMessage('Manifest parse failed or contains no <types>.');
            return;
        }
        const res = await retrieveViaMetadataApi(conn, manifest, { title: 'Retrieving via Metadata API…' });
        toolingMapCache = null;
        try { await vscode.commands.executeCommand('salesforceMetadata.refreshProject'); } catch {}
        await vscode.window.showInformationMessage(`Retrieved ${res.writtenPaths.length} file(s) via Metadata API.`);
    }));

    function parseDescribeMetadataTypes(doc) {
        const out = new Set();
        try {
            const objs = Array.from(
                doc.getElementsByTagNameNS?.('*', 'metadataObjects') || doc.getElementsByTagName('metadataObjects') || []
            );
            for (const o of objs) {
                const xmlNameEl =
                    o.getElementsByTagNameNS?.('*', 'xmlName')?.[0] || o.getElementsByTagName('xmlName')?.[0];
                const name = xmlNameEl?.textContent ? String(xmlNameEl.textContent).trim() : '';
                if (name) out.add(name);
            }
        } catch {
            // ignore
        }
        return Array.from(out).sort((a, b) => a.localeCompare(b));
    }

    disposables.push(vscode.commands.registerCommand('salesforceMetadata.retrieveMetadataApiPick', async () => {
        const conn = loadStoredConn();
        if (!conn.instanceUrl || !conn.accessToken) {
            await vscode.commands.executeCommand('salesforceMetadata.connect');
            return;
        }

        const types = await vscode.window.withProgress(
            { location: vscode.ProgressLocation.Notification, title: 'Loading Metadata API types…', cancellable: false },
            async () =>
                await withMetadataApiClientAuthed(conn, async (client) => {
                    const doc = await client.describeMetadata(conn.apiVersion || '63.0');
                    return parseDescribeMetadataTypes(doc);
                })
        );

        if (!types?.length) {
            await vscode.window.showErrorMessage('Unable to load Metadata API types (describeMetadata returned none).');
            return;
        }

        const typePick = await vscode.window.showQuickPick(types.map((t) => ({ label: t })), {
            title: 'Retrieve (Metadata API)',
            placeHolder: 'Select a metadata type',
            ignoreFocusOut: true,
        });
        if (!typePick?.label) return;

        let members = [];
        try {
            const listed = await vscode.window.withProgress(
                { location: vscode.ProgressLocation.Notification, title: `Listing ${typePick.label}…`, cancellable: false },
                async () =>
                    await withMetadataApiClientAuthed(conn, async (client) => {
                        return await client.listMetadata({
                            queries: [{ type: typePick.label }],
                            asOfVersion: conn.apiVersion || '63.0',
                        });
                    })
            );
            const items = (listed || [])
                .map((r) => String(r?.fullName || '').trim())
                .filter(Boolean)
                .slice(0, 300)
                .map((n) => ({ label: n }));
            const picked = await vscode.window.showQuickPick(
                [{ label: '*', description: 'All members' }, ...items],
                {
                    title: `Select ${typePick.label} members`,
                    placeHolder: 'Pick members (or * for all)',
                    canPickMany: true,
                    ignoreFocusOut: true,
                }
            );
            if (!picked || !picked.length) return;
            if (picked.some((p) => p.label === '*')) {
                members = ['*'];
            } else {
                members = picked.map((p) => p.label).filter(Boolean);
            }
        } catch {
            const raw = await vscode.window.showInputBox({
                title: `Members for ${typePick.label}`,
                prompt: 'Enter * for all, or comma-separated members',
                value: '*',
                ignoreFocusOut: true,
            });
            if (!raw) return;
            const text = String(raw).trim();
            members = text === '*' ? ['*'] : text.split(',').map((s) => s.trim()).filter(Boolean);
        }

        if (!members.length) return;
        const typesMap = new Map([[typePick.label, new Set(members)]]);
        const res = await retrieveViaMetadataApi(conn, typesMap, { title: `Retrieving ${typePick.label} via Metadata API…` });
        toolingMapCache = null;
        try { await vscode.commands.executeCommand('salesforceMetadata.refreshProject'); } catch {}
        await vscode.window.showInformationMessage(`Retrieved ${res.writtenPaths.length} file(s) via Metadata API.`);
    }));

    disposables.push(vscode.commands.registerCommand('salesforceMetadata.deployMetadataApi', async () => {
        const conn = loadStoredConn();
        if (!conn.instanceUrl || !conn.accessToken) {
            await vscode.commands.executeCommand('salesforceMetadata.connect');
            return;
        }
        const uri = await pickPackageXmlUnderWorkspace();
        if (!uri) {
            await vscode.window.showWarningMessage(`No package.xml found under ${getWorkspaceRootPath(vscode)}.`);
            return;
        }
        const xml = new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));
        await deployViaMetadataApi(conn, { packageXmlText: xml, checkOnly: false });
        await vscode.window.showInformationMessage('Deploy succeeded (Metadata API).');
    }));

    disposables.push(vscode.commands.registerCommand('salesforceMetadata.validateDeployMetadataApi', async () => {
        const conn = loadStoredConn();
        if (!conn.instanceUrl || !conn.accessToken) {
            await vscode.commands.executeCommand('salesforceMetadata.connect');
            return;
        }
        const uri = await pickPackageXmlUnderWorkspace();
        if (!uri) {
            await vscode.window.showWarningMessage(`No package.xml found under ${getWorkspaceRootPath(vscode)}.`);
            return;
        }
        const xml = new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));
        await deployViaMetadataApi(conn, { packageXmlText: xml, checkOnly: true });
        await vscode.window.showInformationMessage('Validation succeeded (Metadata API).');
    }));

    function csvEscape(value) {
        const s = value == null ? '' : String(value);
        if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
        return s;
    }

    function flattenRecord(rec) {
        const out = {};
        for (const [k, v] of Object.entries(rec || {})) {
            if (k === 'attributes') continue;
            if (v == null) out[k] = '';
            else if (typeof v === 'object') out[k] = JSON.stringify(v);
            else out[k] = String(v);
        }
        return out;
    }

    async function runQuery({ tooling, soql }) {
        const conn = loadStoredConn();
        if (!conn.instanceUrl || !conn.accessToken) {
            await vscode.commands.executeCommand('salesforceMetadata.connect');
            return null;
        }

        const query = String(soql || '').trim();
        if (!query) return null;

        const qPath = tooling ? `/tooling/query?q=${encodeURIComponent(query)}` : `/query?q=${encodeURIComponent(query)}`;
        return await withToolingClientAuthed(conn, async (client) => {
            const first = await client.requestJson(qPath);
            const pages = [first];
            let nextUrl = first?.nextRecordsUrl;
            while (nextUrl) {
                // eslint-disable-next-line no-await-in-loop
                const page = await client.requestJson(nextUrl);
                pages.push(page);
                nextUrl = page?.nextRecordsUrl;
            }
            const records = pages.flatMap((p) => p?.records || []);
            const totalSize = Number(first?.totalSize ?? records.length);
            return { query, tooling: Boolean(tooling), totalSize, records };
        });
    }

    async function writeQueryResults({ query, tooling, totalSize, records }) {
        const dir = getWorkspaceUri(vscode, '.salesforce/query-results');
        await ensureDir(vscode, dir);
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        const baseName = `${tooling ? 'tooling' : 'soql'}-${ts}`;
        const mdUri = vscode.Uri.joinPath(dir, `${baseName}.md`);
        const jsonUri = vscode.Uri.joinPath(dir, `${baseName}.json`);
        const csvUri = vscode.Uri.joinPath(dir, `${baseName}.csv`);

        const flat = (records || []).map(flattenRecord);
        const columns = Array.from(
            flat.reduce((set, r) => {
                for (const k of Object.keys(r || {})) set.add(k);
                return set;
            }, new Set())
        ).sort((a, b) => a.localeCompare(b));

        const csvLines = [
            columns.map(csvEscape).join(','),
            ...flat.map((r) => columns.map((c) => csvEscape(r?.[c] ?? '')).join(',')),
        ];

        const previewCount = Math.min(50, flat.length);
        const previewCols = columns.slice(0, 20);
        const mdLines = [
            `# ${tooling ? 'Tooling Query' : 'SOQL Query'} Results`,
            '',
            `- Query: \`${query.replace(/`/g, '\\`')}\``,
            `- Records: ${flat.length}${Number.isFinite(totalSize) ? ` (totalSize: ${totalSize})` : ''}`,
            `- Files: \`${mdUri.path}\`, \`${csvUri.path}\`, \`${jsonUri.path}\``,
            '',
            `## Preview (${previewCount} rows)`,
            '',
            `Columns shown: ${previewCols.length}/${columns.length}`,
            '',
            `| ${previewCols.join(' | ')} |`,
            `| ${previewCols.map(() => '---').join(' | ')} |`,
            ...flat.slice(0, previewCount).map((r) => `| ${previewCols.map((c) => (r?.[c] ?? '')).map((v) => String(v).replace(/\|/g, '\\|')).join(' | ')} |`),
            '',
        ];

        await writeTextFile(vscode, jsonUri, JSON.stringify({ tooling, query, totalSize, records }, null, 2), { skipCache: true });
        await writeTextFile(vscode, csvUri, csvLines.join('\n'), { skipCache: true });
        await writeTextFile(vscode, mdUri, mdLines.join('\n'), { skipCache: true });

        try {
            const doc = await vscode.workspace.openTextDocument(mdUri);
            await vscode.window.showTextDocument(doc, { preview: false });
        } catch {
            // ignore
        }
    }

    disposables.push(vscode.commands.registerCommand('salesforceMetadata.runSoqlQuery', async () => {
        const editor = vscode.window?.activeTextEditor;
        const selected = editor?.document && editor?.selection && !editor.selection.isEmpty
            ? editor.document.getText(editor.selection)
            : '';
        const soql = await vscode.window.showInputBox({
            title: 'Run SOQL Query',
            prompt: 'Example: SELECT Id, Name FROM Account LIMIT 50',
            value: selected?.trim() || '',
            ignoreFocusOut: true,
        });
        if (!soql) return;
        const res = await vscode.window.withProgress(
            { location: vscode.ProgressLocation.Notification, title: 'Running SOQL query…', cancellable: false },
            async () => await runQuery({ tooling: false, soql })
        );
        if (!res) return;
        await writeQueryResults(res);
    }));

    disposables.push(vscode.commands.registerCommand('salesforceMetadata.runToolingQuery', async () => {
        const editor = vscode.window?.activeTextEditor;
        const selected = editor?.document && editor?.selection && !editor.selection.isEmpty
            ? editor.document.getText(editor.selection)
            : '';
        const soql = await vscode.window.showInputBox({
            title: 'Run Tooling Query',
            prompt: 'Example: SELECT Id, Name FROM ApexClass LIMIT 50',
            value: selected?.trim() || '',
            ignoreFocusOut: true,
        });
        if (!soql) return;
        const res = await vscode.window.withProgress(
            { location: vscode.ProgressLocation.Notification, title: 'Running Tooling query…', cancellable: false },
            async () => await runQuery({ tooling: true, soql })
        );
        if (!res) return;
        await writeQueryResults(res);
    }));

    disposables.push(vscode.commands.registerCommand('salesforceMetadata.openSoqlScratch', async () => {
        const sfDir = getSalesforceStateDirUri(vscode);
        const scratchUri = getWorkspaceUri(vscode, '.salesforce/soql-editor.soql');
        await ensureDir(vscode, sfDir);

        try {
            await vscode.workspace.fs.stat(scratchUri);
        } catch {
            try {
                await writeTextFile(
                    vscode,
                    scratchUri,
                    "SELECT Id, Name\nFROM Account\nLIMIT 50\n",
                    { skipCache: true }
                );
            } catch {
                // ignore
            }
        }

        try {
            const doc = await vscode.workspace.openTextDocument(scratchUri);
            await vscode.window.showTextDocument(doc, { preview: false });
        } catch {
            // ignore
        }
    }));

    async function toUri(arg) {
        const v = arg?.uri || arg;
        if (v?.scheme && typeof v?.toString === 'function') return v;
        const path = v?.path || v;
        if (!path) return null;
        return vscode.Uri.file(String(path));
    }

    async function readSelectionOrDocumentText(targetUri) {
        const editor = vscode.window?.activeTextEditor;
        const doc = editor?.document;
        const same = Boolean(doc && targetUri && doc.uri?.toString?.() === targetUri.toString?.());
        if (same && editor?.selection && !editor.selection.isEmpty) {
            return doc.getText(editor.selection) || '';
        }
        if (same && doc) {
            return doc.getText?.() || '';
        }
        if (!targetUri) return '';
        try {
            const d = await vscode.workspace.openTextDocument(targetUri);
            return d.getText?.() || '';
        } catch {
            return '';
        }
    }

    disposables.push(vscode.commands.registerCommand('salesforceMetadata._runSoqlEditorDoc', async (uriArg) => {
        const uri = await toUri(uriArg);
        const soql = await readSelectionOrDocumentText(uri);
        const res = await vscode.window.withProgress(
            { location: vscode.ProgressLocation.Notification, title: 'Running SOQL query…', cancellable: false },
            async () => await runQuery({ tooling: false, soql })
        );
        if (!res) return;
        await writeQueryResults(res);
    }));

    disposables.push(vscode.commands.registerCommand('salesforceMetadata._runToolingEditorDoc', async (uriArg) => {
        const uri = await toUri(uriArg);
        const soql = await readSelectionOrDocumentText(uri);
        const res = await vscode.window.withProgress(
            { location: vscode.ProgressLocation.Notification, title: 'Running Tooling query…', cancellable: false },
            async () => await runQuery({ tooling: true, soql })
        );
        if (!res) return;
        await writeQueryResults(res);
    }));

    // SOQL “Run” UI in editor via CodeLens (selection or full document).
    try {
        if (
            typeof vscode.languages?.registerCodeLensProvider === 'function' &&
            typeof vscode.CodeLens === 'function' &&
            typeof vscode.Range === 'function'
        ) {
            const provider = {
                provideCodeLenses: (doc) => {
                    try {
                        if (!doc || doc.languageId !== 'soql') return [];
                        const top = new vscode.Range(0, 0, 0, 0);
                        return [
                            new vscode.CodeLens(top, {
                                title: 'Run SOQL',
                                command: 'salesforceMetadata._runSoqlEditorDoc',
                                arguments: [doc.uri],
                            }),
                            new vscode.CodeLens(top, {
                                title: 'Run Tooling',
                                command: 'salesforceMetadata._runToolingEditorDoc',
                                arguments: [doc.uri],
                            }),
                        ];
                    } catch {
                        return [];
                    }
                },
            };
            disposables.push(vscode.languages.registerCodeLensProvider('soql', provider));
        }
    } catch {
        // ignore
    }

    disposables.push(vscode.commands.registerCommand('salesforceMetadata.executeAnonymous', async () => {
        const conn = loadStoredConn();
        if (!conn.instanceUrl || !conn.accessToken) {
            await vscode.commands.executeCommand('salesforceMetadata.connect');
            return;
        }

        const editor = vscode.window?.activeTextEditor;
        const doc = editor?.document || null;
        const selected = doc && editor?.selection && !editor.selection.isEmpty ? doc.getText(editor.selection) : '';
        let code = String(selected || '').trim();

        if (!code && doc && (doc.languageId === 'apex' || /\.cls$|\.trigger$/i.test(doc.uri?.path || ''))) {
            code = String(doc.getText?.() || '').trim();
        }

        if (!code) {
            const uri = getWorkspaceUri(vscode, '.salesforce/execute-anonymous.apex');
            try {
                await writeTextFile(
                    vscode,
                    uri,
                    '/* Paste Apex here and rerun Salesforce: Execute Anonymous Apex */\n\nSystem.debug(\'Hello from Execute Anonymous\');\n',
                    { skipCache: true }
                );
            } catch {
                // ignore
            }
            try {
                const d = await vscode.workspace.openTextDocument(uri);
                await vscode.window.showTextDocument(d, { preview: false });
            } catch {
                // ignore
            }
            await vscode.window.showInformationMessage(`Open ${getWorkspacePath(vscode, '.salesforce/execute-anonymous.apex')}, edit it, then rerun this command.`);
            return;
        }

        const targetUri = doc?.uri || getWorkspaceUri(vscode, '.salesforce/execute-anonymous.apex');

        const res = await vscode.window.withProgress(
            { location: vscode.ProgressLocation.Notification, title: 'Executing anonymous Apex…', cancellable: false },
            async () => await withToolingClientAuthed(conn, async (client) => {
                return await client.requestJson(`/tooling/executeAnonymous/?anonymousBody=${encodeURIComponent(code)}`);
            })
        );

        const compiled = Boolean(res?.compiled);
        const success = Boolean(res?.success);
        const line = Number(res?.line);
        const column = Number(res?.column);
        const problem = res?.compileProblem || res?.exceptionMessage || '';
        const stack = res?.exceptionStackTrace || '';

        try {
            if (apexExecDiagnostics && targetUri) {
                if (compiled && success) {
                    apexExecDiagnostics.delete(targetUri);
                } else {
                    const l = Number.isFinite(line) && line > 0 ? line - 1 : 0;
                    const c = Number.isFinite(column) && column > 0 ? column - 1 : 0;
                    const range = new vscode.Range(l, c, l, c + 1);
                    const msg = problem || 'Execute Anonymous failed';
                    const diag = new vscode.Diagnostic(range, msg, vscode.DiagnosticSeverity.Error);
                    diag.source = 'executeAnonymous';
                    apexExecDiagnostics.set(targetUri, [diag]);
                }
            }
        } catch {
            // ignore
        }

        if (compiled && success) {
            await vscode.window.showInformationMessage('Execute Anonymous succeeded.');
            return;
        }
        const details = [problem, stack].filter(Boolean).join('\n\n');
        await vscode.window.showErrorMessage(`Execute Anonymous failed.${details ? `\n\n${details}` : ''}`);
    }));

    disposables.push(vscode.commands.registerCommand('salesforceMetadata.runApexTests', async () => {
        const conn = loadStoredConn();
        if (!conn.instanceUrl || !conn.accessToken) {
            await vscode.commands.executeCommand('salesforceMetadata.connect');
            return;
        }

        const editor = vscode.window?.activeTextEditor;
        const activePath = editor?.document?.uri?.path || '';
        const mapItems = await loadToolingMapItems();
        const activeEntry = activePath ? mapItems?.[activePath] : null;
        const activeClassId = activeEntry?.type === 'ApexClass' ? String(activeEntry.id || '') : '';

        const candidates = await vscode.window.withProgress(
            { location: vscode.ProgressLocation.Notification, title: 'Loading test classes…', cancellable: false },
            async () => await withToolingClientAuthed(conn, async (client) => {
                const rows = await client.toolingQueryAll(
                    "SELECT Id, Name FROM ApexClass WHERE Name LIKE '%Test%' ORDER BY Name LIMIT 200"
                );
                return rows || [];
            })
        );

        const items = (candidates || []).map((r) => ({
            label: String(r?.Name || r?.Id || 'Test'),
            description: String(r?.Id || ''),
            picked: activeClassId && String(r?.Id || '') === activeClassId,
            id: String(r?.Id || ''),
            name: String(r?.Name || ''),
        })).filter((x) => x.id);

        if (!items.length) {
            await vscode.window.showWarningMessage('No Apex test classes found (Name LIKE %Test%).');
            return;
        }

        const picked = await vscode.window.showQuickPick(items, {
            title: 'Run Apex Tests',
            placeHolder: 'Select test classes to run',
            canPickMany: true,
            ignoreFocusOut: true,
            matchOnDescription: true,
        });
        if (!picked || !picked.length) return;

        const classIds = picked.map((p) => p.id).filter(Boolean);
        const classIdToName = new Map(picked.map((p) => [p.id, p.name || p.label]));

        const idToPath = new Map();
        for (const [p, e] of Object.entries(mapItems || {})) {
            if (e?.type === 'ApexClass' && e?.id) idToPath.set(String(e.id), p);
        }

        const jobId = await vscode.window.withProgress(
            { location: vscode.ProgressLocation.Notification, title: 'Starting test run…', cancellable: false },
            async () => await withToolingClientAuthed(conn, async (client) => {
                const resp = await client.requestJson('/tooling/runTestsAsynchronous', { method: 'POST', body: { classIds } });
                return String(resp?.id || resp || '');
            })
        );
        if (!jobId) {
            await vscode.window.showErrorMessage('Failed to start test run.');
            return;
        }

        const startedAt = Date.now();
        const queueItems = await vscode.window.withProgress(
            { location: vscode.ProgressLocation.Notification, title: 'Running tests…', cancellable: false },
            async (progress) => await withToolingClientAuthed(conn, async (client) => {
                for (;;) {
                    // eslint-disable-next-line no-await-in-loop
                    const rows = await client.toolingQueryAll(
                        `SELECT Id, Status, ApexClassId, MethodName, ExtendedStatus FROM ApexTestQueueItem WHERE ParentJobId='${jobId}'`
                    );
                    const total = rows?.length || 0;
                    const doneCount = (rows || []).filter((r) => ['Completed', 'Aborted', 'Failed'].includes(String(r?.Status || ''))).length;
                    progress.report({ message: total ? `${doneCount}/${total} done` : 'Queued…' });
                    if (total && doneCount === total) return rows || [];
                    if (Date.now() - startedAt > 20 * 60 * 1000) throw new Error('Test run timed out (20 minutes).');
                    // eslint-disable-next-line no-await-in-loop
                    await new Promise((r) => setTimeout(r, 2000));
                }
            })
        );

        const queueIds = (queueItems || []).map((r) => String(r?.Id || '')).filter(Boolean);

        const results = await withToolingClientAuthed(conn, async (client) => {
            try {
                return await client.toolingQueryAll(
                    `SELECT Id, Outcome, Message, StackTrace, ApexClassId, MethodName, AsyncApexJobId FROM ApexTestResult WHERE AsyncApexJobId='${jobId}' ORDER BY ApexClassId, MethodName`
                );
            } catch {
                if (!queueIds.length) return [];
                const inList = queueIds.map((id) => `'${id.replace(/'/g, "\\\\'")}'`).join(',');
                return await client.toolingQueryAll(
                    `SELECT Id, Outcome, Message, StackTrace, ApexClassId, MethodName, QueueItemId FROM ApexTestResult WHERE QueueItemId IN (${inList}) ORDER BY ApexClassId, MethodName`
                );
            }
        });

        const failures = (results || []).filter((r) => String(r?.Outcome || '') !== 'Pass');

        // Coverage (best-effort).
        let coverageRows = [];
        try {
            const inList = classIds.map((id) => `'${id.replace(/'/g, "\\\\'")}'`).join(',');
            coverageRows = await withToolingClientAuthed(conn, async (client) => {
                return await client.toolingQueryAll(
                    `SELECT ApexClassOrTriggerId, NumLinesCovered, NumLinesUncovered FROM ApexCodeCoverageAggregate WHERE ApexClassOrTriggerId IN (${inList})`
                );
            });
        } catch {
            // ignore
        }

        const covById = new Map((coverageRows || []).map((r) => [String(r?.ApexClassOrTriggerId || ''), r]));

        // Diagnostics for failures.
        try {
            if (apexTestDiagnostics) {
                apexTestDiagnostics.clear?.();
                const byUri = new Map();
                for (const f of failures) {
                    const cid = String(f?.ApexClassId || '');
                    const p = idToPath.get(cid);
                    if (!p) continue;
                    const uri = vscode.Uri.file(p);
                    const range = new vscode.Range(0, 0, 0, 1);
                    const msg = `${f?.MethodName || 'test'}: ${f?.Message || f?.Outcome || 'Fail'}`;
                    const diag = new vscode.Diagnostic(range, msg, vscode.DiagnosticSeverity.Error);
                    diag.source = 'apexTests';
                    const list = byUri.get(uri) || [];
                    list.push(diag);
                    byUri.set(uri, list);
                }
                for (const [uri, ds] of byUri.entries()) {
                    apexTestDiagnostics.set(uri, ds);
                }
            }
        } catch {
            // ignore
        }

        // Write report.
        const dir = getWorkspaceUri(vscode, '.salesforce/test-results');
        await ensureDir(vscode, dir);
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        const reportUri = vscode.Uri.joinPath(dir, `apex-tests-${ts}.md`);
        const lines = [
            '# Apex Test Results',
            '',
            `- Job: \`${jobId}\``,
            `- Classes: ${classIds.length}`,
            `- Total results: ${(results || []).length}`,
            `- Failures: ${failures.length}`,
            '',
            '## Summary',
            '',
            ...classIds.map((id) => {
                const name = classIdToName.get(id) || id;
                const cov = covById.get(id);
                const covered = Number(cov?.NumLinesCovered || 0);
                const uncovered = Number(cov?.NumLinesUncovered || 0);
                const pct = covered + uncovered ? Math.round((covered / (covered + uncovered)) * 100) : null;
                return `- ${name}${pct == null ? '' : ` • coverage ${pct}%`}`;
            }),
            '',
            '## Failures',
            '',
            ...(failures.length
                ? failures.map((f) => {
                    const cid = String(f?.ApexClassId || '');
                    const name = classIdToName.get(cid) || cid;
                    const method = f?.MethodName || '';
                    const msg = f?.Message || f?.Outcome || 'Fail';
                    return `- **${name}.${method}**: ${msg}`;
                })
                : ['(none)']),
            '',
        ];
        await writeTextFile(vscode, reportUri, lines.join('\n'), { skipCache: true });
        try {
            const d = await vscode.workspace.openTextDocument(reportUri);
            await vscode.window.showTextDocument(d, { preview: false });
        } catch {
            // ignore
        }

        if (failures.length) {
            await vscode.window.showErrorMessage(`Apex tests completed with ${failures.length} failure(s).`);
        } else {
            await vscode.window.showInformationMessage('Apex tests succeeded.');
        }
    }));

    async function ensureCurrentUserId(conn) {
        if (conn?.userId) return conn;
        const me = await withToolingClientAuthed(conn, async (client) => {
            return await client.requestJson('/chatter/users/me');
        });
        const userId = me?.id || me?.userId || '';
        const username = me?.username || me?.name || '';
        if (userId) {
            const next = { ...conn, userId: String(userId), username: conn.username || String(username || '') };
            await saveConn(next);
            setStatus(statusItem, next);
            return next;
        }
        return conn;
    }

    disposables.push(vscode.commands.registerCommand('salesforceMetadata.enableDebugLogs', async () => {
        let conn = loadStoredConn();
        if (!conn.instanceUrl || !conn.accessToken) {
            await vscode.commands.executeCommand('salesforceMetadata.connect');
            conn = loadStoredConn();
        }
        if (!conn.instanceUrl || !conn.accessToken) return;
        conn = await ensureCurrentUserId(conn);
        if (!conn.userId) {
            await vscode.window.showErrorMessage('Unable to determine current user id for TraceFlag.');
            return;
        }

        const minutesPick = await vscode.window.showQuickPick(
            [{ label: '15 minutes', minutes: 15 }, { label: '30 minutes', minutes: 30 }, { label: '60 minutes', minutes: 60 }],
            { title: 'Enable debug logs', placeHolder: 'Select duration', ignoreFocusOut: true }
        );
        if (!minutesPick) return;

        await vscode.window.withProgress(
            { location: vscode.ProgressLocation.Notification, title: 'Enabling debug logs…', cancellable: false },
            async () => await withToolingClientAuthed(conn, async (client) => {
                // DebugLevel
                const dlName = 'WorkbenchDebug';
                const dlRows = await client.toolingQueryAll(
                    `SELECT Id, DeveloperName FROM DebugLevel WHERE DeveloperName='${dlName}' LIMIT 1`
                );
                let debugLevelId = dlRows?.[0]?.Id || '';
                if (!debugLevelId) {
                    const created = await client.requestJson('/tooling/sobjects/DebugLevel', {
                        method: 'POST',
                        body: {
                            DeveloperName: dlName,
                            MasterLabel: dlName,
                            ApexCode: 'DEBUG',
                            ApexProfiling: 'INFO',
                            Callout: 'INFO',
                            Database: 'INFO',
                            System: 'DEBUG',
                            Validation: 'INFO',
                            Visualforce: 'INFO',
                            Workflow: 'INFO',
                        },
                    });
                    debugLevelId = created?.id || '';
                }
                if (!debugLevelId) throw new Error('Failed to create DebugLevel.');

                const start = new Date();
                const exp = new Date(start.getTime() + minutesPick.minutes * 60 * 1000);
                const startIso = start.toISOString();
                const expIso = exp.toISOString();

                const tfRows = await client.toolingQueryAll(
                    `SELECT Id, ExpirationDate FROM TraceFlag WHERE TracedEntityId='${conn.userId}' AND LogType='DEVELOPER_LOG' ORDER BY ExpirationDate DESC LIMIT 1`
                );
                const traceFlagId = tfRows?.[0]?.Id || '';
                const body = {
                    TracedEntityId: conn.userId,
                    LogType: 'DEVELOPER_LOG',
                    DebugLevelId: debugLevelId,
                    StartDate: startIso,
                    ExpirationDate: expIso,
                };
                if (traceFlagId) {
                    await client.requestJson(`/tooling/sobjects/TraceFlag/${traceFlagId}`, { method: 'PATCH', body });
                } else {
                    await client.requestJson('/tooling/sobjects/TraceFlag', { method: 'POST', body });
                }
                return true;
            })
        );

        await vscode.window.showInformationMessage(`Debug logs enabled for ${minutesPick.minutes} minutes.`);
    }));

    disposables.push(vscode.commands.registerCommand('salesforceMetadata.openDebugLogs', async () => {
        let conn = loadStoredConn();
        if (!conn.instanceUrl || !conn.accessToken) {
            await vscode.commands.executeCommand('salesforceMetadata.connect');
            conn = loadStoredConn();
        }
        if (!conn.instanceUrl || !conn.accessToken) return;

        const logs = await vscode.window.withProgress(
            { location: vscode.ProgressLocation.Notification, title: 'Loading debug logs…', cancellable: false },
            async () => await withToolingClientAuthed(conn, async (client) => {
                return await client.toolingQueryAll(
                    'SELECT Id, StartTime, LogLength, Operation, Request, Status, DurationMilliseconds FROM ApexLog ORDER BY StartTime DESC LIMIT 50'
                );
            })
        );

        const items = (logs || []).map((l) => {
            const t = l?.StartTime ? new Date(l.StartTime).toLocaleString() : '';
            const op = l?.Operation || l?.Request || 'Log';
            const len = l?.LogLength ? `${l.LogLength}b` : '';
            return {
                label: `${t} • ${op}`,
                description: len,
                detail: l?.Id || '',
                id: l?.Id,
            };
        }).filter((x) => x.id);

        if (!items.length) {
            await vscode.window.showInformationMessage('No Apex logs found.');
            return;
        }

        const picked = await vscode.window.showQuickPick(items, {
            title: 'Debug Logs',
            placeHolder: 'Select a log to open',
            ignoreFocusOut: true,
            matchOnDescription: true,
            matchOnDetail: true,
        });
        if (!picked?.id) return;

        const body = await vscode.window.withProgress(
            { location: vscode.ProgressLocation.Notification, title: 'Downloading log…', cancellable: false },
            async () => await withToolingClientAuthed(conn, async (client) => {
                return await client.requestText(`/tooling/sobjects/ApexLog/${picked.id}/Body`);
            })
        );

        const dir = getWorkspaceUri(vscode, '.salesforce/logs');
        await ensureDir(vscode, dir);
        const uri = vscode.Uri.joinPath(dir, `${picked.id}.log`);
        await writeTextFile(vscode, uri, body || '', { skipCache: true });
        try {
            const d = await vscode.workspace.openTextDocument(uri);
            await vscode.window.showTextDocument(d, { preview: false });
        } catch {
            // ignore
        }
    }));

    async function listConnectionsForCompare() {
        const current = loadStoredConn();
        const items = [];
        if (current.instanceUrl && current.accessToken) {
            let host = current.instanceUrl;
            try { host = new URL(current.instanceUrl).host; } catch {}
            items.push({
                label: `Current: ${host}${current.username ? ` (${current.username})` : ''}`,
                description: current.authType || 'current',
                detail: current.instanceUrl,
                serverUrl: current.instanceUrl,
                sessionId: current.accessToken,
                apiVersion: current.apiVersion || '63.0',
                authType: current.authType || '',
                sharedAlias: current.sharedAlias || '',
                _current: true,
            });
        }

        const sharedConnections = await listSharedConnectionEntries().catch(() => []);
        for (const item of sharedConnections) {
            const configuration = item?.configuration;
            if (!configuration?.instanceUrl) continue;
            items.push({
                label: `Saved: ${item.label}`,
                description: getConnectionTypeLabel(configuration),
                detail: configuration.alias || configuration.instanceUrl,
                serverUrl: configuration.instanceUrl,
                sessionId: configuration.accessToken || '',
                apiVersion: configuration.version || current.apiVersion || '63.0',
                authType: getConnectionAuthType(configuration),
                sharedAlias: configuration.alias || '',
                _shared: true,
                _sharedConfig: configuration,
            });
        }

        if (isChromeExtensionEnv()) {
            const sessionsRes = await chrome.runtime.sendMessage({ action: 'listOrgSessions' }).catch(() => []);

            if (Array.isArray(sessionsRes)) {
                for (const s of sessionsRes) {
                    items.push({
                        label: `Cookie: ${s?.label || s?.serverUrl || 'Org'}`,
                        description: 'cookie',
                        detail: s?.detail || s?.serverUrl || '',
                        serverUrl: s?.serverUrl,
                        sessionId: s?.sessionId,
                        apiVersion: current.apiVersion || '63.0',
                        authType: 'cookie',
                        _cookie: true,
                    });
                }
            }
        }

        // Dedupe by serverUrl+sessionId (best-effort)
        const seen = new Set();
        return items.filter((x) => {
            const key = `${x.serverUrl}|${x.sessionId || x.detail || x.description || ''}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return Boolean(x.serverUrl && (x.sessionId || x._shared));
        });
    }

    async function resolveConnectionForUse(connItem) {
        if (!connItem) return null;
        if (connItem._current) {
            const current = loadStoredConn();
            const stored = await resolveStoredConnection(current, { persist: false }).catch(() => current);
            return {
                ...connItem,
                serverUrl: stored.instanceUrl,
                sessionId: stored.accessToken,
                apiVersion: stored.apiVersion,
                authType: stored.authType,
                sharedAlias: stored.sharedAlias || '',
            };
        }
        if (connItem.sharedAlias) {
            const stored = await resolveStoredConnection(
                {
                    instanceUrl: connItem.serverUrl,
                    accessToken: connItem.sessionId,
                    apiVersion: connItem.apiVersion,
                    authType: connItem.authType,
                    sharedAlias: connItem.sharedAlias,
                },
                { persist: false }
            ).catch(() => null);
            if (stored?.instanceUrl && stored?.accessToken) {
                return {
                    ...connItem,
                    serverUrl: stored.instanceUrl,
                    sessionId: stored.accessToken,
                    apiVersion: stored.apiVersion,
                    authType: stored.authType,
                    sharedAlias: stored.sharedAlias || connItem.sharedAlias,
                };
            }
        }
        return connItem;
    }

    disposables.push(vscode.commands.registerCommand('salesforceMetadata.compareOrgs', async () => {
        const conns = await listConnectionsForCompare();
        if (conns.length < 2) {
            await vscode.window.showWarningMessage('Need at least 2 org connections (OAuth or cookie tabs) to compare.');
            return;
        }

        const leftPick = await vscode.window.showQuickPick(conns, {
            title: 'Compare Orgs',
            placeHolder: 'Select LEFT org',
            ignoreFocusOut: true,
            matchOnDescription: true,
            matchOnDetail: true,
        });
        if (!leftPick) return;
        const remaining = conns.filter((c) => c !== leftPick);
        const rightPick = await vscode.window.showQuickPick(remaining, {
            title: 'Compare Orgs',
            placeHolder: 'Select RIGHT org',
            ignoreFocusOut: true,
            matchOnDescription: true,
            matchOnDetail: true,
        });
        if (!rightPick) return;

        const left = await resolveConnectionForUse(leftPick);
        const right = await resolveConnectionForUse(rightPick);
        if (!left?.serverUrl || !left?.sessionId || !right?.serverUrl || !right?.sessionId) {
            await vscode.window.showErrorMessage('Missing connection details for comparison.');
            return;
        }

        const typePick = await vscode.window.showQuickPick(
            [
                { label: 'Apex Classes', type: 'ApexClass' },
                { label: 'Apex Triggers', type: 'ApexTrigger' },
            ],
            { title: 'Compare Orgs', placeHolder: 'Select metadata type', ignoreFocusOut: true }
        );
        if (!typePick) return;

        const isChromeExtension = Boolean(globalThis?.chrome?.runtime?.id);
        const proxyUrl = isChromeExtension ? undefined : window.location.origin;

        const leftClient = createToolingClient({
            instanceUrl: left.serverUrl,
            accessToken: left.sessionId,
            apiVersion: left.apiVersion || '63.0',
            proxyUrl,
        });
        const rightClient = createToolingClient({
            instanceUrl: right.serverUrl,
            accessToken: right.sessionId,
            apiVersion: right.apiVersion || '63.0',
            proxyUrl,
        });

        const fetchList = async (client) => {
            if (typePick.type === 'ApexClass') {
                return await client.toolingQueryAll('SELECT Id, Name, LastModifiedDate, SystemModstamp FROM ApexClass ORDER BY Name');
            }
            return await client.toolingQueryAll('SELECT Id, Name, LastModifiedDate, SystemModstamp FROM ApexTrigger ORDER BY Name');
        };

        const [leftRows, rightRows] = await vscode.window.withProgress(
            { location: vscode.ProgressLocation.Notification, title: 'Comparing orgs…', cancellable: false },
            async () => await Promise.all([fetchList(leftClient), fetchList(rightClient)])
        );

        const leftByName = new Map((leftRows || []).map((r) => [String(r?.Name || ''), r]).filter((x) => x[0]));
        const rightByName = new Map((rightRows || []).map((r) => [String(r?.Name || ''), r]).filter((x) => x[0]));
        const names = Array.from(new Set([...leftByName.keys(), ...rightByName.keys()])).sort((a, b) => a.localeCompare(b));

        const onlyLeft = [];
        const onlyRight = [];
        const changed = [];

        for (const n of names) {
            const l = leftByName.get(n);
            const r = rightByName.get(n);
            if (l && !r) onlyLeft.push(n);
            else if (!l && r) onlyRight.push(n);
            else if (l && r) {
                const ls = String(l?.SystemModstamp || l?.LastModifiedDate || '');
                const rs = String(r?.SystemModstamp || r?.LastModifiedDate || '');
                if (ls && rs && ls !== rs) changed.push(n);
            }
        }

        const outDir = getWorkspaceUri(vscode, '.salesforce/org-compare');
        await ensureDir(vscode, outDir);
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        const reportUri = vscode.Uri.joinPath(outDir, `compare-${typePick.type.toLowerCase()}-${ts}.md`);
        const report = [
            '# Org Compare Report',
            '',
            `- Type: ${typePick.type}`,
            `- Left: ${left.label}`,
            `- Right: ${right.label}`,
            '',
            `- Only in left: ${onlyLeft.length}`,
            `- Only in right: ${onlyRight.length}`,
            `- Changed (stamp differs): ${changed.length}`,
            '',
            '## Changed',
            '',
            ...(changed.length ? changed.map((n) => `- ${n}`) : ['(none)']),
            '',
            '## Only in left',
            '',
            ...(onlyLeft.length ? onlyLeft.map((n) => `- ${n}`) : ['(none)']),
            '',
            '## Only in right',
            '',
            ...(onlyRight.length ? onlyRight.map((n) => `- ${n}`) : ['(none)']),
            '',
        ].join('\n');
        await writeTextFile(vscode, reportUri, report, { skipCache: true });
        try {
            const d = await vscode.workspace.openTextDocument(reportUri);
            await vscode.window.showTextDocument(d, { preview: false });
        } catch {
            // ignore
        }

        if (!changed.length) return;
        const action = await vscode.window.showQuickPick(
            [
                { label: 'Open diff for a changed item…', _diff: true },
                { label: 'Done', _done: true },
            ],
            { title: 'Org Compare', ignoreFocusOut: true }
        );
        if (!action?._diff) return;

        const itemPick = await vscode.window.showQuickPick(changed.slice(0, 200).map((n) => ({ label: n })), {
            title: 'Diff remote vs remote',
            placeHolder: 'Select an item to diff',
            ignoreFocusOut: true,
        });
        if (!itemPick?.label) return;

        const name = itemPick.label;
        const lRec = leftByName.get(name);
        const rRec = rightByName.get(name);
        if (!lRec?.Id || !rRec?.Id) return;

        const leftText = await (typePick.type === 'ApexClass'
            ? leftClient.toolingQueryAll(`SELECT Body FROM ApexClass WHERE Id='${lRec.Id}'`).then((rows) => rows?.[0]?.Body ?? '')
            : leftClient.toolingQueryAll(`SELECT Body FROM ApexTrigger WHERE Id='${lRec.Id}'`).then((rows) => rows?.[0]?.Body ?? ''));
        const rightText = await (typePick.type === 'ApexClass'
            ? rightClient.toolingQueryAll(`SELECT Body FROM ApexClass WHERE Id='${rRec.Id}'`).then((rows) => rows?.[0]?.Body ?? '')
            : rightClient.toolingQueryAll(`SELECT Body FROM ApexTrigger WHERE Id='${rRec.Id}'`).then((rows) => rows?.[0]?.Body ?? ''));

        const diffDir = getWorkspaceUri(vscode, '.salesforce/.diff-orgs');
        await ensureDir(vscode, diffDir);
        const leftUri = vscode.Uri.joinPath(diffDir, `left-${name}.${typePick.type === 'ApexClass' ? 'cls' : 'trigger'}`);
        const rightUri = vscode.Uri.joinPath(diffDir, `right-${name}.${typePick.type === 'ApexClass' ? 'cls' : 'trigger'}`);
        await writeTextFile(vscode, leftUri, leftText || '', { skipCache: true });
        await writeTextFile(vscode, rightUri, rightText || '', { skipCache: true });
        try {
            await vscode.commands.executeCommand('vscode.diff', leftUri, rightUri, `Org Diff: ${name}`);
        } catch {
            // ignore
        }
    }));

    disposables.push(vscode.commands.registerCommand('salesforceMetadata.whereUsed', async () => {
        const conn = loadStoredConn();
        if (!conn.instanceUrl || !conn.accessToken) {
            await vscode.commands.executeCommand('salesforceMetadata.connect');
            return;
        }
        const editor = vscode.window?.activeTextEditor;
        const path = editor?.document?.uri?.path;
        if (!path) return;
        const mapItems = await loadToolingMapItems();
        const entry = mapItems?.[path];
        if (!entry?.id) {
            await vscode.window.showWarningMessage('This file is not in tooling-map.json. Fetch metadata first.');
            return;
        }
        const id = String(entry.id);

        const [whereUsed, dependsOn] = await vscode.window.withProgress(
            { location: vscode.ProgressLocation.Notification, title: 'Querying dependencies…', cancellable: false },
            async () => await withToolingClientAuthed(conn, async (client) => {
                const used = await client.toolingQueryAll(
                    `SELECT MetadataComponentName, MetadataComponentType, RefMetadataComponentName, RefMetadataComponentType FROM MetadataComponentDependency WHERE RefMetadataComponentId='${id}' LIMIT 200`
                );
                const deps = await client.toolingQueryAll(
                    `SELECT MetadataComponentName, MetadataComponentType, RefMetadataComponentName, RefMetadataComponentType FROM MetadataComponentDependency WHERE MetadataComponentId='${id}' LIMIT 200`
                );
                return [used || [], deps || []];
            })
        );

        const outDir = getWorkspaceUri(vscode, '.salesforce/where-used');
        await ensureDir(vscode, outDir);
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        const reportUri = vscode.Uri.joinPath(outDir, `where-used-${ts}.md`);
        const lines = [
            '# Where Used / Dependencies',
            '',
            `- File: \`${path}\``,
            `- Component id: \`${id}\``,
            '',
            '## Used by (dependents)',
            '',
            ...(whereUsed.length
                ? whereUsed.map((r) => `- ${r?.MetadataComponentType || ''}: ${r?.MetadataComponentName || ''}`)
                : ['(none)']),
            '',
            '## Depends on (references)',
            '',
            ...(dependsOn.length
                ? dependsOn.map((r) => `- ${r?.RefMetadataComponentType || ''}: ${r?.RefMetadataComponentName || ''}`)
                : ['(none)']),
            '',
        ].join('\n');
        await writeTextFile(vscode, reportUri, lines, { skipCache: true });
        try {
            const d = await vscode.workspace.openTextDocument(reportUri);
            await vscode.window.showTextDocument(d, { preview: false });
        } catch {
            // ignore
        }
    }));

    disposables.push(vscode.commands.registerCommand('salesforceMetadata.toggleAutoDeploy', async () => {
        const next = !loadAutoDeployOnSave();
        saveAutoDeployOnSave(next);
        setAutoDeployStatus();
        await vscode.window.showInformationMessage(`Auto deploy on save: ${next ? 'ON' : 'OFF'}.`);
    }));

    disposables.push(vscode.commands.registerCommand('salesforceMetadata.refreshProject', async () => {
        // Explorer refresh only (sync is handled by fetchMetadata / "Sync Project")
        const candidates = [
            'workbench.files.action.refreshFilesExplorer',
            'workbench.action.files.refreshExplorer',
            'workbench.action.refreshExplorerView',
            'workbench.explorer.fileView.refresh',
        ];
        const cmds = await vscode.commands.getCommands(true);
        const cmd = candidates.find((c) => cmds.includes(c));
        try {
            await vscode.commands.executeCommand('workbench.view.explorer');
        } catch {
            // ignore
        }
        if (cmd) {
            await vscode.commands.executeCommand(cmd);
        }
    }));

    disposables.push(vscode.commands.registerCommand('salesforceMetadata.openNamespaceReport', async () => {
        try {
            const uri = getWorkspaceUri(vscode, '.salesforce/namespaces.json');
            const bytes = await vscode.workspace.fs.readFile(uri);
            if (!bytes || !bytes.length) {
                await vscode.window.showWarningMessage('Namespace report is empty. Fetch metadata first.');
                return;
            }
            if (vscode.window?.showTextDocument) {
                await vscode.window.showTextDocument(uri);
            } else {
                await vscode.window.showInformationMessage(`Namespace report written to ${getWorkspacePath(vscode, '.salesforce/namespaces.json')}`);
            }
        } catch {
            await vscode.window.showWarningMessage('Namespace report not found. Fetch metadata first.');
        }
    }));

    disposables.push(vscode.commands.registerCommand('salesforceMetadata.installExtensions', async () => {
        const extensionIds = [
            'salesforce.salesforcedx-vscode-core',
            'salesforce.salesforcedx-vscode-apex',
            'salesforce.salesforcedx-vscode-lwc',
            'dbaeumer.vscode-eslint',
        ];

        const cmds = await vscode.commands.getCommands(true);
        const hasInstall = cmds.includes('workbench.extensions.installExtension');
        const hasSearch = cmds.includes('workbench.extensions.search');
        const hasOpenView = cmds.includes('workbench.view.extensions');

        if (hasOpenView) {
            await vscode.commands.executeCommand('workbench.view.extensions');
        }
        if (hasSearch) {
            await vscode.commands.executeCommand('workbench.extensions.search', '@recommended');
        }

        if (!hasInstall) {
            await vscode.window.showWarningMessage(
                'This workbench runtime does not expose the extension install command. ' +
                'Use the Extensions view to install from Open VSX manually.'
            );
            return;
        }

        await vscode.window.withProgress(
            { location: vscode.ProgressLocation.Notification, title: 'Installing extensions from Open VSX...', cancellable: false },
            async () => {
                for (const id of extensionIds) {
                    try {
                        await vscode.commands.executeCommand('workbench.extensions.installExtension', id);
                    } catch (e) {
                        // eslint-disable-next-line no-console
                        console.warn('Failed to install extension', id, e);
                    }
                }
            }
        );

        await vscode.window.showInformationMessage(
            'Install triggered. Note: many official Salesforce extensions require desktop VS Code/CLI and may not work fully in a browser workbench.'
        );
    }));

    return {
        dispose() {
            for (const d of disposables) {
                try { d?.dispose?.(); } catch {}
            }
        }
    };
}


