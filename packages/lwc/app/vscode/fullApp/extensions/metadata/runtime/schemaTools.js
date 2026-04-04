import { restoreCachedFilesToWorkspace, writeTextFile } from '../core/workspaceCache.js';
import { getWorkspaceUri } from '../core/workspacePaths.js';

export async function registerSchemaTools({ connectionRuntime, context }) {
    const { diagnostics, vscode, vscodeBundle } = context;
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

    async function ensureGlobalDescribe(conn, { force } = {}) {
        const cache = await loadSchemaCache();
        const ttlMs = Number(cache.ttlMs || schemaTtlMs);
        if (
            !force &&
            cache.global &&
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

    async function ensureSObjectDescribe(conn, sobjectName, { force } = {}) {
        const name = String(sobjectName || '').trim();
        if (!name) return null;
        const cache = await loadSchemaCache();
        const ttlMs = Number(cache.ttlMs || schemaTtlMs);
        const existing = cache.objects?.[name];
        if (
            !force &&
            existing &&
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
        if (!path.includes('/force-app/main/') || !path.includes('/lwc/')) {
            return false;
        }
        return (
            path.endsWith('.js') ||
            path.endsWith('.ts') ||
            path.endsWith('.html') ||
            path.endsWith('.css')
        );
    }

    async function lintLwcDocument(doc) {
        if (!diagnostics.lwc || !doc || !isLwcDoc(doc)) return;
        const text = doc.getText?.() ?? '';
        const body = JSON.stringify({
            uri: doc.uri?.path || doc.uri?.toString?.() || '',
            text,
        });
        const response = await fetch('/lint/lwc', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(payload?.error || 'Lint request failed');
        }
        const diagnosticsList = (payload?.diagnostics || []).map(diagnostic => {
            const start = diagnostic?.range?.start || { line: 0, character: 0 };
            const end = diagnostic?.range?.end || start;
            const range = new vscode.Range(start.line, start.character, end.line, end.character);
            const severity =
                diagnostic?.severity === 2
                    ? vscode.DiagnosticSeverity.Warning
                    : vscode.DiagnosticSeverity.Error;
            const nextDiagnostic = new vscode.Diagnostic(
                range,
                diagnostic?.message || 'Lint issue',
                severity
            );
            nextDiagnostic.source = diagnostic?.source || 'eslint';
            if (diagnostic?.code) nextDiagnostic.code = diagnostic.code;
            return nextDiagnostic;
        });
        diagnostics.lwc.set(doc.uri, diagnosticsList);
    }

    const register = (command, handler) =>
        context.addDisposable(vscode.commands.registerCommand(command, handler));

    register('salesforceMetadata.insertTextAtCursor', async text => {
        const editor = vscode.window?.activeTextEditor;
        if (!editor) return;
        const nextText = String(text || '');
        if (!nextText) return;
        await editor.edit(builder => builder.insert(editor.selection.active, nextText));
    });

    try {
        if (
            typeof vscode.window?.registerTreeDataProvider === 'function' &&
            typeof vscode.TreeItem === 'function'
        ) {
            const emitter = new (
                vscode.EventEmitter ||
                class {
                    constructor() {
                        this.event = () => {};
                    }
                    fire() {}
                    dispose() {}
                }
            )();

            class SchemaProvider {
                onDidChangeTreeData = emitter.event;

                refresh() {
                    try {
                        emitter.fire();
                    } catch {
                        // ignore
                    }
                }

                getTreeItem(element) {
                    if (element?.kind === 'action') {
                        const item = new vscode.TreeItem(
                            element.label,
                            vscode.TreeItemCollapsibleState.None
                        );
                        if (vscode.ThemeIcon && element.icon) {
                            item.iconPath = new vscode.ThemeIcon(element.icon);
                        }
                        if (element.tooltip) item.tooltip = element.tooltip;
                        if (element.command) item.command = element.command;
                        return item;
                    }
                    if (element?.kind === 'object') {
                        const item = new vscode.TreeItem(
                            `${element.name}`,
                            vscode.TreeItemCollapsibleState.Collapsed
                        );
                        item.description =
                            element.label && element.label !== element.name ? element.label : '';
                        if (vscode.ThemeIcon) item.iconPath = new vscode.ThemeIcon('database');
                        return item;
                    }
                    if (element?.kind === 'group') {
                        const item = new vscode.TreeItem(
                            element.label,
                            vscode.TreeItemCollapsibleState.Collapsed
                        );
                        if (vscode.ThemeIcon) {
                            item.iconPath = new vscode.ThemeIcon(element.icon || 'list-unordered');
                        }
                        return item;
                    }
                    if (element?.kind === 'field') {
                        const item = new vscode.TreeItem(
                            element.name,
                            vscode.TreeItemCollapsibleState.None
                        );
                        item.description = element.type || '';
                        if (vscode.ThemeIcon) item.iconPath = new vscode.ThemeIcon('symbol-field');
                        item.command = {
                            command: 'salesforceMetadata.insertTextAtCursor',
                            title: 'Insert',
                            arguments: [element.name],
                        };
                        return item;
                    }
                    if (element?.kind === 'relationship') {
                        const item = new vscode.TreeItem(
                            element.label,
                            vscode.TreeItemCollapsibleState.None
                        );
                        item.description = element.detail || '';
                        if (vscode.ThemeIcon) item.iconPath = new vscode.ThemeIcon('link');
                        return item;
                    }
                    return new vscode.TreeItem(
                        String(element?.label || 'Item'),
                        vscode.TreeItemCollapsibleState.None
                    );
                }

                async getChildren(element) {
                    const conn = connectionRuntime.loadStoredConn();
                    if (!conn.instanceUrl || !conn.accessToken) {
                        return [
                            {
                                kind: 'action',
                                label: 'Not connected (click to connect)',
                                icon: 'cloud',
                                command: {
                                    command: 'salesforceMetadata.connect',
                                    title: 'Connect',
                                },
                            },
                        ];
                    }

                    if (!element) {
                        const global = await loadSchemaCache()
                            .then(cache => cache.global)
                            .catch(() => null);
                        if (!global || global.instanceUrl !== conn.instanceUrl) {
                            return [
                                {
                                    kind: 'action',
                                    label: 'Load schema cache…',
                                    icon: 'refresh',
                                    command: {
                                        command: 'salesforceMetadata.refreshSchemaCache',
                                        title: 'Refresh schema',
                                    },
                                },
                            ];
                        }
                        return (Array.isArray(global.sobjects) ? global.sobjects : [])
                            .slice(0, 500)
                            .map(item => ({
                                kind: 'object',
                                name: item.name,
                                label: item.label || item.name,
                            }));
                    }

                    if (element.kind === 'object') {
                        return [
                            {
                                kind: 'group',
                                group: 'fields',
                                objectName: element.name,
                                label: 'Fields',
                                icon: 'symbol-field',
                            },
                            {
                                kind: 'group',
                                group: 'relationships',
                                objectName: element.name,
                                label: 'Child relationships',
                                icon: 'link',
                            },
                        ];
                    }

                    if (element.kind === 'group') {
                        const describe = await ensureSObjectDescribe(conn, element.objectName);
                        if (!describe) return [];
                        if (element.group === 'fields') {
                            return (describe.fields || []).slice(0, 500).map(field => ({
                                kind: 'field',
                                objectName: describe.name,
                                name: field.name,
                                type: field.type,
                            }));
                        }
                        if (element.group === 'relationships') {
                            return (describe.childRelationships || [])
                                .slice(0, 200)
                                .map(relationship => ({
                                    kind: 'relationship',
                                    label:
                                        relationship.relationshipName ||
                                        relationship.childSObject ||
                                        'relationship',
                                    detail: [relationship.childSObject, relationship.field]
                                        .filter(Boolean)
                                        .join(' • '),
                                }));
                        }
                    }

                    return [];
                }
            }

            const schemaProvider = new SchemaProvider();
            context.addDisposable({
                dispose: () => {
                    try {
                        emitter.dispose?.();
                    } catch {
                        // ignore
                    }
                },
            });
            context.addDisposable(
                vscode.window.registerTreeDataProvider(
                    'salesforceMetadata.schemaExplorer',
                    schemaProvider
                )
            );

            register('salesforceMetadata.refreshSchemaCache', async () => {
                const conn = connectionRuntime.loadStoredConn();
                if (!conn.instanceUrl || !conn.accessToken) {
                    await vscode.commands.executeCommand('salesforceMetadata.connect');
                    return;
                }
                await vscode.window.withProgress(
                    {
                        location: vscode.ProgressLocation.Notification,
                        title: 'Refreshing schema cache…',
                        cancellable: false,
                    },
                    async () => {
                        await ensureGlobalDescribe(conn, { force: true });
                    }
                );
                schemaProvider.refresh();
                await vscode.window.showInformationMessage('Schema cache refreshed.');
            });

            if (typeof vscode.languages?.registerCompletionItemProvider === 'function') {
                const provider = {
                    provideCompletionItems: async (doc, position) => {
                        const conn = connectionRuntime.loadStoredConn();
                        if (!conn.instanceUrl || !conn.accessToken) return [];

                        const text = doc.getText?.() ?? '';
                        const before = text.slice(0, doc.offsetAt(position));
                        const fromMatch = before.match(/\bFROM\s+([A-Za-z0-9_$.]+)\b/i);
                        const fromObject = fromMatch ? fromMatch[1] : '';
                        const inFrom = /\bFROM\s+[A-Za-z0-9_$.]*$/i.test(before);

                        const cache = await loadSchemaCache();
                        const global =
                            cache.global?.instanceUrl === conn.instanceUrl
                                ? cache.global
                                : await ensureGlobalDescribe(conn);
                        const sobjects = Array.isArray(global?.sobjects) ? global.sobjects : [];

                        if (inFrom || !fromObject) {
                            return sobjects.slice(0, 500).map(item => {
                                const completion = new vscode.CompletionItem(
                                    item.name,
                                    vscode.CompletionItemKind.Class
                                );
                                completion.detail = item.label || item.name;
                                return completion;
                            });
                        }

                        const describe = await ensureSObjectDescribe(conn, fromObject);
                        const fields = Array.isArray(describe?.fields) ? describe.fields : [];
                        return fields.slice(0, 500).map(field => {
                            const completion = new vscode.CompletionItem(
                                field.name,
                                vscode.CompletionItemKind.Field
                            );
                            completion.detail = field.type || '';
                            completion.documentation = field.label || field.name;
                            return completion;
                        });
                    },
                };
                context.addDisposable(
                    vscode.languages.registerCompletionItemProvider('soql', provider, '.', ' ')
                );
            }
        }
    } catch {
        // ignore
    }

    const monaco = vscodeBundle?.monaco;
    if (monaco?.languages?.register) {
        const registrations = [
            { id: 'apex', aliases: ['Apex'], extensions: ['.cls', '.trigger'] },
            { id: 'javascript', aliases: ['JavaScript'], extensions: ['.js', '.mjs', '.cjs'] },
            { id: 'javascriptreact', aliases: ['JavaScript React'], extensions: ['.jsx'] },
            { id: 'typescript', aliases: ['TypeScript'], extensions: ['.ts'] },
            { id: 'typescriptreact', aliases: ['TypeScript React'], extensions: ['.tsx'] },
            { id: 'html', aliases: ['HTML'], extensions: ['.html', '.htm'] },
            { id: 'css', aliases: ['CSS'], extensions: ['.css'] },
        ];
        for (const registration of registrations) {
            try {
                monaco.languages.register(registration);
            } catch {
                // ignore
            }
        }
    }

    try {
        void restoreCachedFilesToWorkspace(vscode);
    } catch {
        // ignore
    }

    try {
        if (vscode.workspace?.onDidOpenTextDocument && vscode.languages?.setTextDocumentLanguage) {
            context.addDisposable(
                vscode.workspace.onDidOpenTextDocument(async doc => {
                    try {
                        const path = doc?.uri?.path || '';
                        if (
                            (path.endsWith('.cls') || path.endsWith('.trigger')) &&
                            doc.languageId !== 'apex'
                        ) {
                            await vscode.languages.setTextDocumentLanguage(doc, 'apex');
                        }
                        if (path.includes('/force-app/main/') && path.includes('/lwc/')) {
                            if (path.endsWith('.html') && doc.languageId !== 'html') {
                                await vscode.languages.setTextDocumentLanguage(doc, 'html');
                            } else if (path.endsWith('.css') && doc.languageId !== 'css') {
                                await vscode.languages.setTextDocumentLanguage(doc, 'css');
                            } else if (path.endsWith('.js') && doc.languageId !== 'javascript') {
                                await vscode.languages.setTextDocumentLanguage(doc, 'javascript');
                            } else if (path.endsWith('.ts') && doc.languageId !== 'typescript') {
                                await vscode.languages.setTextDocumentLanguage(doc, 'typescript');
                            }
                        }
                    } catch {
                        // ignore
                    }
                })
            );
        }
    } catch {
        // ignore
    }

    try {
        const LanguageClientWrapper =
            vscodeBundle?.monacoLanguageClient?.LanguageClient?.LanguageClientWrapper;
        if (LanguageClientWrapper) {
            const worker = new Worker('/libs/extensions/salesforce-apex/server/server.browser.js', {
                type: 'module',
                name: 'Apex LS',
            });
            const languageClientConfig = {
                languageId: 'apex',
                clientOptions: {
                    documentSelector: [
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
            const wrapper = new LanguageClientWrapper(languageClientConfig);
            await wrapper.start();
            context.addDisposable({ dispose: () => wrapper?.dispose?.() });
        }
    } catch (error) {
        // eslint-disable-next-line no-console
        console.warn('Apex language client failed to start:', error);
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
