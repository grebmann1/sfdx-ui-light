import { writeTextFile } from '../core/workspaceCache.js';
import { getWorkspaceUri } from '../core/workspacePaths.js';
const OPEN_TOOLKIT_CONNECTIONS_COMMAND = 'salesforceMetadata.openToolkitConnections';

export async function registerSchemaTools({ connectionRuntime, context }) {
    const { vscode, vscodeBundle } = context;
    const schemaCacheUri = getWorkspaceUri(vscode, '.salesforce/schema-cache.json');
    const schemaTtlMs = 24 * 60 * 60 * 1000;
    let schemaCacheMem = null;
    let schemaTreeView = null;

    function hasUsableConnection(conn) {
        return Boolean(
            conn?.instanceUrl &&
                conn?.accessToken &&
                !conn?.sessionHasExpired &&
                !conn?.hasError
        );
    }

    function updateSchemaTreeMessage(conn = connectionRuntime.loadStoredConn()) {
        if (!schemaTreeView) {
            return;
        }
        schemaTreeView.message = hasUsableConnection(conn)
            ? ''
            : 'Connect to Salesforce to browse schema.';
    }

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

    async function ensureSObjectDescribe(conn, sobjectName, { force } = {}) {
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
                                    .map(value => value?.value)
                                    .filter(Boolean)
                                    .slice(0, 200)
                              : [],
                          filterable: field?.filterable !== false,
                          sortable: field?.sortable !== false,
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

    function buildObjectCompletion(item) {
        const completion = new vscode.CompletionItem(item.name, vscode.CompletionItemKind.Class);
        completion.detail = item.label || item.name;
        return completion;
    }

    function buildFieldCompletion(field) {
        const completion = new vscode.CompletionItem(field.name, vscode.CompletionItemKind.Field);
        completion.detail = field.type || '';
        completion.documentation = field.label || field.name;
        return completion;
    }

    function buildValueCompletion(label, { detail, kind } = {}) {
        const completion = new vscode.CompletionItem(
            label,
            kind || vscode.CompletionItemKind.Value
        );
        completion.detail = detail || '';
        return completion;
    }

    async function resolveDescribeForRelationshipPath(conn, rootObjectName, relationshipPath) {
        const segments = String(relationshipPath || '')
            .split('.')
            .map(segment => String(segment || '').trim())
            .filter(Boolean);
        if (!rootObjectName || !segments.length) return null;

        let currentDescribe = await ensureSObjectDescribe(conn, rootObjectName);
        for (const segment of segments) {
            const relationshipField = (currentDescribe?.fields || []).find(
                field =>
                    field?.relationshipName &&
                    String(field.relationshipName).toLowerCase() === segment.toLowerCase()
            );
            const nextObject = relationshipField?.referenceTo?.[0];
            if (!nextObject) return null;
            currentDescribe = await ensureSObjectDescribe(conn, nextObject);
        }
        return currentDescribe;
    }

    function getValueSuggestionsForField(field) {
        if (!field) return [];
        if (field.type === 'boolean') {
            return ['TRUE', 'FALSE'].map(value =>
                buildValueCompletion(value, {
                    detail: 'boolean literal',
                    kind: vscode.CompletionItemKind.Keyword,
                })
            );
        }
        if (field.type === 'date' || field.type === 'datetime') {
            return ['TODAY', 'YESTERDAY', 'TOMORROW', 'LAST_N_DAYS:30', 'NEXT_N_DAYS:30'].map(
                value =>
                    buildValueCompletion(value, {
                        detail: field.type,
                        kind: vscode.CompletionItemKind.Constant,
                    })
            );
        }
        if (Array.isArray(field.picklistValues) && field.picklistValues.length) {
            return field.picklistValues.slice(0, 100).map(value =>
                buildValueCompletion(String(value), {
                    detail: 'picklist value',
                    kind: vscode.CompletionItemKind.EnumMember,
                })
            );
        }
        return [];
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

    async function lintLwcDocument() {
        /*
        Disabled for now. The web workbench runtime does not currently have a
        reliable LWC lint execution path, so keep the exported hook as a no-op
        to avoid breaking deploy/source-tracking integrations that call it.

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
        */
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
                    updateSchemaTreeMessage(conn);
                    if (!hasUsableConnection(conn)) {
                        return [
                            {
                                kind: 'action',
                                label: 'Connect to Salesforce',
                                icon: 'account',
                                tooltip: connectionRuntime.getConnectionProblemMessage(conn),
                                command: {
                                    command: OPEN_TOOLKIT_CONNECTIONS_COMMAND,
                                    title: 'Connect to Salesforce',
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
            const removeStatusListener = connectionRuntime.addStatusChangeListener(conn => {
                updateSchemaTreeMessage(conn);
                schemaProvider.refresh();
            });
            context.addDisposable({
                dispose: () => {
                    try {
                        emitter.dispose?.();
                    } catch {
                        // ignore
                    }
                    removeStatusListener();
                },
            });
            if (typeof vscode.window?.createTreeView === 'function') {
                schemaTreeView = vscode.window.createTreeView('salesforceMetadata.schemaExplorer', {
                    treeDataProvider: schemaProvider,
                });
                updateSchemaTreeMessage();
                context.addDisposable(schemaTreeView);
            } else {
                context.addDisposable(
                    vscode.window.registerTreeDataProvider(
                        'salesforceMetadata.schemaExplorer',
                        schemaProvider
                    )
                );
            }

            register('salesforceMetadata.refreshSchemaCache', async () => {
                const conn = connectionRuntime.loadStoredConn();
                if (!hasUsableConnection(conn)) {
                    await vscode.window.showErrorMessage(
                        connectionRuntime.getConnectionProblemMessage(conn)
                    );
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
                        if (!hasUsableConnection(conn)) return [];

                        const text = doc.getText?.() ?? '';
                        const before = text.slice(0, doc.offsetAt(position));
                        const fromMatches = Array.from(
                            before.matchAll(/\bFROM\s+([A-Za-z0-9_$.]+)\b/gi)
                        );
                        const outerFromObject = fromMatches[0]?.[1] || '';
                        const fromObject = fromMatches[fromMatches.length - 1]?.[1] || '';
                        const inFrom = /\bFROM\s+[A-Za-z0-9_$.]*$/i.test(before);
                        const relationshipPathMatch = before.match(
                            /([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*)\.$/
                        );
                        const relationshipPath = relationshipPathMatch?.[1] || '';
                        const valueContextMatch = before.match(
                            /(?:WHERE|AND|OR)\s+([A-Za-z0-9_.]+)\s*(?:=|!=|<|>|<=|>=|LIKE|IN|NOT IN)\s*[A-Za-z0-9_'":-]*$/i
                        );
                        const valueFieldPath = valueContextMatch?.[1] || '';
                        const inSubqueryFrom = Boolean(
                            inFrom &&
                                /\(\s*SELECT[\s\S]*$/i.test(before) &&
                                before.lastIndexOf('(') > before.lastIndexOf(')')
                        );

                        const cache = await loadSchemaCache();
                        const global =
                            cache.global?.instanceUrl === conn.instanceUrl
                                ? cache.global
                                : await ensureGlobalDescribe(conn);
                        const sobjects = Array.isArray(global?.sobjects)
                            ? global.sobjects.filter(item => item?.queryable !== false)
                            : [];

                        if (inSubqueryFrom && outerFromObject) {
                            const describe = await ensureSObjectDescribe(conn, outerFromObject);
                            return (describe?.childRelationships || [])
                                .slice(0, 200)
                                .filter(relationship => relationship?.relationshipName)
                                .map(relationship =>
                                    buildValueCompletion(relationship.relationshipName, {
                                        detail:
                                            relationship.childSObject || relationship.field || '',
                                        kind: vscode.CompletionItemKind.Reference,
                                    })
                                );
                        }

                        if (inFrom || !fromObject) {
                            return sobjects.slice(0, 500).map(buildObjectCompletion);
                        }

                        if (relationshipPath) {
                            const relationDescribe = await resolveDescribeForRelationshipPath(
                                conn,
                                fromObject,
                                relationshipPath
                            );
                            const relationFields = Array.isArray(relationDescribe?.fields)
                                ? relationDescribe.fields
                                : [];
                            return relationFields.slice(0, 500).map(buildFieldCompletion);
                        }

                        const describe = await ensureSObjectDescribe(conn, fromObject);
                        if (valueFieldPath) {
                            const [rootFieldName, ...relationSegments] = valueFieldPath.split('.');
                            const valueDescribe = relationSegments.length
                                ? await resolveDescribeForRelationshipPath(
                                      conn,
                                      fromObject,
                                      relationSegments.slice(0, -1).join('.')
                                  )
                                : describe;
                            const lookupDescribe =
                                relationSegments.length > 1
                                    ? await resolveDescribeForRelationshipPath(
                                          conn,
                                          fromObject,
                                          relationSegments.join('.')
                                      )
                                    : null;
                            const candidateDescribe = lookupDescribe || valueDescribe;
                            const targetFieldName = relationSegments.length
                                ? relationSegments[relationSegments.length - 1]
                                : rootFieldName;
                            const valueField = (candidateDescribe?.fields || []).find(
                                field =>
                                    String(field?.name || '').toLowerCase() ===
                                    String(targetFieldName || '').toLowerCase()
                            );
                            const valueSuggestions = getValueSuggestionsForField(valueField);
                            if (valueSuggestions.length) {
                                return valueSuggestions;
                            }
                        }
                        const fields = Array.isArray(describe?.fields) ? describe.fields : [];
                        return fields.slice(0, 500).map(buildFieldCompletion);
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
        if (vscode.workspace?.onDidOpenTextDocument && vscode.languages?.setTextDocumentLanguage) {
            context.addDisposable(
                vscode.workspace.onDidOpenTextDocument(async doc => {
                    try {
                        const path = doc?.uri?.path || '';
                        if (
                            (path.endsWith('.cls') ||
                                path.endsWith('.trigger') ||
                                path.endsWith('.apex')) &&
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
