import { hasUsableConnection } from '../../connection/connectionFactory';
import { registerCommand } from '../core/extensionRegistration';
import { type SchemaToolsApi } from './soqlCompletionMiddleware';

export function registerSoqlSchemaExplorer({ connectionRuntime, context, schemaApi }: {
    connectionRuntime;
    context;
    schemaApi: SchemaToolsApi;
}) {
    const { vscode } = context;
    const { loadSchemaCache, ensureGlobalDescribe, ensureSObjectDescribe } = schemaApi;
    let schemaTreeView = null;

    function updateSchemaTreeMessage(conn = connectionRuntime.loadStoredConn()) {
        if (!schemaTreeView) return;
        schemaTreeView.message = hasUsableConnection(conn)
            ? ''
            : 'Connect to Salesforce to browse schema.';
    }

    registerCommand(context, vscode, 'salesforceMetadata.insertTextAtCursor', async text => {
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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const emitter: any = new (
                vscode.EventEmitter ||
                class {
                    constructor() {
                        (this as Record<string, unknown>).event = () => {};
                    }
                    fire() {}
                    dispose() {}
                }
            )();

            class SchemaProvider {
                onDidChangeTreeData = emitter.event;

                refresh() {
                    try { emitter.fire(); } catch { /* ignore */ }
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
                    if (!hasUsableConnection(conn)) return [];

                    if (!element) {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const global: any = await loadSchemaCache()
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
                                        .join(' \u2022 '),
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
                    try { emitter.dispose?.(); } catch { /* ignore */ }
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

            registerCommand(context, vscode, 'salesforceMetadata.refreshSchemaCache', async () => {
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
        }
    } catch {
        // ignore
    }
}
