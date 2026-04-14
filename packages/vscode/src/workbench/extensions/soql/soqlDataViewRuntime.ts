import { fetchTextAsset } from '../core/extensionAssets';

type VscodeLike = {
    Uri: {
        file: (path: string) => unknown;
        joinPath: (base: unknown, ...segments: string[]) => unknown;
    };
    ViewColumn?: {
        Two?: unknown;
        Active?: unknown;
    };
    window: {
        createWebviewPanel: (
            viewType: string,
            title: string,
            column: unknown,
            options?: Record<string, unknown>
        ) => {
            webview: {
                html: string;
                options?: Record<string, unknown>;
                asWebviewUri: (uri: unknown) => unknown;
                postMessage: (message: unknown) => Promise<boolean> | boolean;
                onDidReceiveMessage: (
                    callback: (message: unknown) => void
                ) => { dispose?: () => void } | void;
            };
            reveal?: (column?: unknown) => void;
            onDidDispose?: (callback: () => void) => { dispose?: () => void } | void;
        };
        showSaveDialog?: (options?: { defaultUri?: unknown }) => Promise<unknown>;
        showErrorMessage?: (message: string) => Promise<unknown> | unknown;
        showInformationMessage?: (message: string) => Promise<unknown> | unknown;
    };
    workspace: {
        workspaceFolders?: Array<{ uri?: unknown }>;
        fs: {
            writeFile: (uri: unknown, data: Uint8Array) => Promise<void>;
        };
    };
};

type ActivationContextLike = {
    addDisposable: (value: unknown) => unknown;
};

type SoqlQueryResultPayload = {
    query: string;
    tooling: boolean;
    totalSize: number;
    records: Record<string, unknown>[];
    documentName?: string;
};

type FlattenedGrid = {
    fields: string[];
    rowData: Record<string, string>[];
};

type SaveMessage = {
    type?: string;
    format?: string;
};

const DATA_VIEW_SOURCE_ROOT = '/libs/extensions/salesforcedx-vscode-soql/dist/soql-data-view';
const DATA_VIEW_TARGET_ROOT = '/workspace/vscode/dist/soql-data-view';
const DATA_VIEW_TYPE = 'queryDataView';

function csvEscape(value: unknown): string {
    const stringValue = value == null ? '' : String(value);
    if (/[",\n\r]/.test(stringValue)) {
        return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
}

function flattenRecord(record: Record<string, unknown>): Record<string, string> {
    const output: Record<string, string> = {};
    for (const [key, value] of Object.entries(record || {})) {
        if (key === 'attributes') {
            continue;
        }
        if (value == null) {
            output[key] = '';
            continue;
        }
        if (typeof value === 'object') {
            output[key] = JSON.stringify(value);
            continue;
        }
        output[key] = String(value);
    }
    return output;
}

function buildFlattenedGrid(records: Record<string, unknown>[]): FlattenedGrid {
    const flattenedRows = (records || []).map(flattenRecord);
    const fields = Array.from(
        flattenedRows.reduce((keys, row) => {
            for (const key of Object.keys(row)) {
                keys.add(key);
            }
            return keys;
        }, new Set<string>())
    ).sort((left, right) => left.localeCompare(right));
    const rowData = flattenedRows.map(row =>
        Object.fromEntries(fields.map(field => [field, row[field] ?? '']))
    );
    return { fields, rowData };
}

function buildCsv(grid: FlattenedGrid): string {
    const header = grid.fields.map(csvEscape).join(',');
    const rows = grid.rowData.map(row =>
        grid.fields.map(field => csvEscape(row[field] ?? '')).join(',')
    );
    return [header, ...rows].join('\n');
}

function buildCspTag(webview: { cspSource?: string }): string {
    const source = String(webview?.cspSource || '');
    return `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${source}; script-src ${source}; style-src 'unsafe-inline' ${source};" />`;
}

function replaceDataViewTemplateAssets({
    html,
    webview,
    vscode,
}: {
    html: string;
    webview: { asWebviewUri: (uri: unknown) => unknown; cspSource?: string };
    vscode: VscodeLike;
}) {
    const baseStyleUri = `${DATA_VIEW_SOURCE_ROOT}/queryDataView.css`
    const tabulatorStyleUri = `${DATA_VIEW_SOURCE_ROOT}/tabulator.min.css`
    const viewControllerUri = `${DATA_VIEW_SOURCE_ROOT}/queryDataViewController.js`
    const tabulatorUri = `${DATA_VIEW_SOURCE_ROOT}/tabulator.min.js`
    const saveIconUri = `${DATA_VIEW_SOURCE_ROOT}/icons/icon__save.svg`

    let nextHtml = html;
    nextHtml = nextHtml.replace('<!-- CSP TAG -->', buildCspTag(webview));
    nextHtml = nextHtml.replaceAll('${tabulatorStyleUri}', tabulatorStyleUri);
    nextHtml = nextHtml.replaceAll('${baseStyleUri}', baseStyleUri);
    nextHtml = nextHtml.replaceAll('${tabulatorUri}', tabulatorUri);
    nextHtml = nextHtml.replaceAll('${viewControllerUri}', viewControllerUri);
    nextHtml = nextHtml.replaceAll('${iconSave}', saveIconUri);
    return nextHtml;
}

function createDefaultSaveUri({ vscode, extension }: { vscode: VscodeLike; extension: string }) {
    const workspaceUri = vscode.workspace.workspaceFolders?.[0]?.uri;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `soql-query-${timestamp}.${extension}`;
    if (!workspaceUri) {
        return vscode.Uri.file(fileName);
    }
    return vscode.Uri.joinPath(workspaceUri, '.salesforce', 'query-results', fileName);
}

export function createSoqlDataViewRuntime({
    vscode,
    context,
}: {
    vscode: VscodeLike;
    context: ActivationContextLike;
}) {
    let panel: ReturnType<VscodeLike['window']['createWebviewPanel']> | null = null;
    let latestPayload:
        | (SoqlQueryResultPayload & {
              flattenedGrid: FlattenedGrid;
              columnData: { columns: unknown[]; subTables: unknown[]; objectName: string };
          })
        | null = null;

    const postUpdate = async () => {
        if (!panel || !latestPayload) {
            return false;
        }
        return await Promise.resolve(
            panel.webview.postMessage({
                type: 'update',
                data: latestPayload,
                documentName: latestPayload.documentName || 'SOQL Query',
            })
        );
    };

    const ensurePanel = async () => {
        if (panel) {
            panel.reveal?.(vscode.ViewColumn?.Two ?? vscode.ViewColumn?.Active);
            return panel;
        }
        panel = vscode.window.createWebviewPanel(
            DATA_VIEW_TYPE,
            'SOQL Query Results',
            vscode.ViewColumn?.Two ?? vscode.ViewColumn?.Active,
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.file(DATA_VIEW_TARGET_ROOT)],
                retainContextWhenHidden: true,
            }
        );

        const htmlTemplate = await fetchTextAsset(`${DATA_VIEW_SOURCE_ROOT}/index.html`);
        panel.webview.html = replaceDataViewTemplateAssets({
            html: htmlTemplate,
            webview: panel.webview,
            vscode,
        });

        const panelRef = panel;
        const messageDisposable = panel.webview.onDidReceiveMessage(
            async (message: SaveMessage) => {
                if (!message || typeof message !== 'object') {
                    return;
                }
                if (message.type === 'activate') {
                    await postUpdate();
                    return;
                }
                if (message.type !== 'save_records' || !latestPayload) {
                    return;
                }
                const extension = message.format === 'json' ? 'json' : 'csv';
                const defaultUri = createDefaultSaveUri({ vscode, extension });
                const pickedUri = await vscode.window.showSaveDialog?.({ defaultUri });
                if (!pickedUri) {
                    return;
                }
                const content =
                    extension === 'json'
                        ? JSON.stringify(
                              {
                                  query: latestPayload.query,
                                  tooling: latestPayload.tooling,
                                  totalSize: latestPayload.totalSize,
                                  records: latestPayload.records,
                              },
                              null,
                              2
                          )
                        : buildCsv(latestPayload.flattenedGrid);
                await vscode.workspace.fs.writeFile(pickedUri, new TextEncoder().encode(content));
                await vscode.window.showInformationMessage?.(`Saved SOQL results as ${extension}.`);
            }
        );
        if (messageDisposable) {
            context.addDisposable(messageDisposable);
        }
        const disposeListener = panel.onDidDispose?.(() => {
            panel = null;
        });
        if (disposeListener) {
            context.addDisposable(disposeListener);
        }
        context.addDisposable({
            dispose() {
                panelRef?.dispose?.();
            },
        });
        return panel;
    };

    return {
        async showQueryResults(payload: SoqlQueryResultPayload) {
            try {
                latestPayload = {
                    ...payload,
                    flattenedGrid: buildFlattenedGrid(payload.records || []),
                    // Fallback shape for upstream controller, unused when flattenedGrid exists.
                    columnData: { columns: [], subTables: [], objectName: '' },
                };
                await ensurePanel();
                await postUpdate();
                return true;
            } catch (error) {
                await vscode.window.showErrorMessage?.(
                    `Unable to show SOQL results view: ${error instanceof Error ? error.message : String(error)}`
                );
                return false;
            }
        },
    };
}
