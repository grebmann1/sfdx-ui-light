import { fetchTextAsset } from '../core/extensionAssets';

import { executeSoqlQuery } from './soqlQueryRunner';

const BUILDER_SOURCE_HTML =
    '/libs/extensions/salesforcedx-vscode-soql/dist/soql-builder-ui/index.html';
const BUILDER_TARGET_ROOT = '/workspace/vscode/dist/soql-builder-ui';
const OPEN_WITH_COMMAND = 'vscode.openWith';
const SOQL_TEXT_EDITOR_VIEW_TYPE = 'default';

export const SOQL_BUILDER_VIEW_TYPE = 'soqlCustom.soql';

type VscodeLike = {
    Uri: {
        file: (path: string) => unknown;
        joinPath: (base: unknown, ...segments: string[]) => unknown;
    };
    WorkspaceEdit: new () => {
        replace: (uri: unknown, range: unknown, text: string) => void;
    };
    Range: new (
        startLine: number,
        startCharacter: number,
        endLine: number,
        endCharacter: number
    ) => unknown;
    window: {
        registerCustomEditorProvider?: (
            viewType: string,
            provider: unknown
        ) => { dispose?: () => void };
        showInputBox?: (options?: Record<string, unknown>) => Promise<string | undefined>;
        showInformationMessage?: (message: string) => Promise<unknown> | unknown;
        showErrorMessage?: (message: string) => Promise<unknown> | unknown;
        withProgress?: (
            options: Record<string, unknown>,
            task: () => Promise<unknown>
        ) => Promise<unknown>;
        activeTextEditor?: {
            document?: {
                uri?: unknown;
                languageId?: string;
            };
        };
        createWebviewPanel?: (
            viewType: string,
            title: string,
            showOptions: unknown,
            options?: Record<string, unknown>
        ) => unknown;
    };
    workspace: {
        workspaceFolders?: Array<{ uri?: unknown }>;
        onDidChangeTextDocument?: (
            callback: (event: { document?: { uri?: unknown; lineCount?: number } }) => void
        ) => { dispose?: () => void };
        applyEdit?: (edit: unknown) => Promise<boolean>;
        fs: {
            createDirectory?: (uri: unknown) => Promise<void>;
            writeFile: (uri: unknown, data: Uint8Array) => Promise<void>;
        };
    };
    commands: {
        executeCommand: (command: string, ...args: unknown[]) => Promise<unknown>;
        registerCommand: (
            command: string,
            callback: (...args: unknown[]) => unknown
        ) => { dispose?: () => void };
    };
    ProgressLocation?: {
        Notification?: unknown;
    };
};

type ActivationContextLike = {
    addDisposable: (value: unknown) => unknown;
};

type SchemaToolsApiLike = {
    ensureGlobalDescribe?: (
        conn: Record<string, unknown>,
        options?: { force?: boolean }
    ) => Promise<{ sobjects?: Array<{ name?: string; queryable?: boolean }> }>;
    ensureSObjectDescribe?: (
        conn: Record<string, unknown>,
        name: string,
        options?: { force?: boolean }
    ) => Promise<unknown>;
};

type ConnectionRuntimeLike = {
    loadStoredConn: () => Record<string, unknown>;
    withToolingClientAuthed: <T>(
        conn: Record<string, unknown>,
        callback: (client: {
            requestJson: (path: string) => Promise<Record<string, unknown>>;
        }) => Promise<T>
    ) => Promise<T>;
    addStatusChangeListener?: (callback: (conn: unknown) => void) => (() => void) | void;
    getInjectedConnectionRequiredMessage: () => string;
};

type SoqlQueryResultsPresenter = (payload: {
    query: string;
    tooling: boolean;
    totalSize: number;
    records: Record<string, unknown>[];
    documentName?: string;
}) => Promise<boolean>;

type SoqlBuilderMessage = {
    type?: string;
    payload?: unknown;
};

function buildCspTag(webview: { cspSource?: string }): string {
    const source = String(webview?.cspSource || '');
    return `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${source}; script-src ${source}; style-src 'unsafe-inline' ${source};" />`;
}

function transformBuilderHtml({
    html,
    webview,
    vscode,
}: {
    html: string;
    webview: { asWebviewUri: (uri: unknown) => unknown; cspSource?: string };
    vscode: VscodeLike;
}) {
    const appScriptUri = String(
        webview.asWebviewUri(vscode.Uri.file(`${BUILDER_TARGET_ROOT}/app.js`))
    );
    let nextHtml = html.replace('<!-- CSP TAG -->', buildCspTag(webview));
    nextHtml = nextHtml.replace('./app.js', appScriptUri);
    return nextHtml;
}

function normalizeFileName(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) {
        return '';
    }
    return trimmed.replace(/[^A-Za-z0-9_]/g, '_');
}

function getDocumentName(document: { uri?: { path?: string; fsPath?: string } }): string {
    const path = String(document?.uri?.path || document?.uri?.fsPath || '');
    if (!path) {
        return 'SOQL Query';
    }
    const parts = path.split('/');
    return parts[parts.length - 1] || 'SOQL Query';
}

async function promptForSoqlFileName(vscode: VscodeLike) {
    const raw = await vscode.window.showInputBox?.({
        title: 'Create SOQL File',
        prompt: 'Enter a file name (without .soql extension)',
        value: 'query',
        validateInput: (value: string) => {
            const normalized = normalizeFileName(value);
            if (!normalized) {
                return 'File name is required.';
            }
            if (!/^[A-Za-z]/.test(normalized)) {
                return 'File name must start with a letter.';
            }
            return undefined;
        },
    });
    if (!raw) {
        return null;
    }
    return normalizeFileName(raw);
}

async function openNewSoqlFile({ vscode, viewType }: { vscode: VscodeLike; viewType: string }) {
    const fileName = await promptForSoqlFileName(vscode);
    if (!fileName) {
        return;
    }
    const workspaceUri =
        vscode.workspace.workspaceFolders?.[0]?.uri ?? vscode.Uri.file('/workspace');
    const directoryUri = vscode.Uri.joinPath(workspaceUri, '.salesforce', 'soql');
    await vscode.workspace.fs.createDirectory?.(directoryUri);
    const fileUri = vscode.Uri.joinPath(directoryUri, `${fileName}.soql`);
    await vscode.workspace.fs.writeFile(
        fileUri,
        new TextEncoder().encode('SELECT Id\nFROM Account\nLIMIT 50\n')
    );
    await vscode.commands.executeCommand(OPEN_WITH_COMMAND, fileUri, viewType);
}

async function resolveDocumentUriFromArgument({
    vscode,
    arg,
}: {
    vscode: VscodeLike;
    arg: unknown;
}) {
    const fromArgument = (arg as { uri?: unknown })?.uri || arg;
    if (fromArgument && typeof fromArgument === 'object') {
        return fromArgument;
    }
    const activeUri = vscode.window.activeTextEditor?.document?.uri;
    return activeUri || null;
}

async function toggleSoqlBuilder({ vscode, arg }: { vscode: VscodeLike; arg: unknown }) {
    const targetUri = await resolveDocumentUriFromArgument({ vscode, arg });
    if (!targetUri) {
        await vscode.window.showInformationMessage?.('Open a .soql file to toggle SOQL Builder.');
        return;
    }
    const activeDoc = vscode.window.activeTextEditor?.document;
    const nextViewType =
        activeDoc?.languageId === 'soql' ? SOQL_BUILDER_VIEW_TYPE : SOQL_TEXT_EDITOR_VIEW_TYPE;
    await vscode.commands.executeCommand(OPEN_WITH_COMMAND, targetUri, nextViewType);
}

class SoqlBuilderEditorInstance {
    private pendingWebviewUpdate = false;
    private readonly disposables: Array<{ dispose?: () => void }> = [];

    public constructor(
        private readonly vscode: VscodeLike,
        private readonly document: { uri?: unknown; lineCount?: number; getText?: () => string },
        private readonly webviewPanel: {
            webview: {
                postMessage: (message: unknown) => Promise<boolean> | boolean;
                onDidReceiveMessage: (
                    callback: (message: SoqlBuilderMessage) => void
                ) => { dispose?: () => void } | void;
            };
            onDidDispose?: (callback: () => void) => { dispose?: () => void } | void;
        },
        private readonly connectionRuntime: ConnectionRuntimeLike,
        private readonly getSchemaTools: () => SchemaToolsApiLike | null,
        private readonly openQueryResults: SoqlQueryResultsPresenter,
        private readonly runQueryPlan: (soql: string) => Promise<void>
    ) {
        const workspaceListener = this.vscode.workspace.onDidChangeTextDocument?.(event => {
            if (event.document?.uri !== this.document.uri) {
                return;
            }
            if (this.pendingWebviewUpdate) {
                this.pendingWebviewUpdate = false;
                return;
            }
            void this.sendMessage('text_soql_changed', this.document.getText?.() || '');
        });
        if (workspaceListener) {
            this.disposables.push(workspaceListener);
        }

        const messageListener = this.webviewPanel.webview.onDidReceiveMessage(message => {
            void this.handleMessage(message);
        });
        if (messageListener) {
            this.disposables.push(messageListener);
        }

        const removeConnectionListener = this.connectionRuntime.addStatusChangeListener?.(() => {
            void this.sendMessage('connection_changed');
        });
        if (typeof removeConnectionListener === 'function') {
            this.disposables.push({ dispose: removeConnectionListener });
        }

        const panelDispose = this.webviewPanel.onDidDispose?.(() => {
            this.dispose();
        });
        if (panelDispose) {
            this.disposables.push(panelDispose);
        }
    }

    private async sendMessage(type: string, payload?: unknown) {
        await Promise.resolve(this.webviewPanel.webview.postMessage({ type, payload }));
    }

    private async syncSObjects() {
        const schemaTools = this.getSchemaTools();
        const conn = this.connectionRuntime.loadStoredConn();
        if (!schemaTools?.ensureGlobalDescribe || !conn?.instanceUrl || !conn?.accessToken) {
            await this.sendMessage('sobjects_response', []);
            return;
        }
        const global = await schemaTools.ensureGlobalDescribe(conn);
        const names = Array.isArray(global?.sobjects)
            ? global.sobjects
                  .filter(sobject => sobject?.queryable !== false)
                  .map(sobject => String(sobject?.name || ''))
                  .filter(Boolean)
                  .sort((left, right) => left.localeCompare(right))
            : [];
        await this.sendMessage('sobjects_response', names);
    }

    private async syncSObjectMetadata(sobjectName: string) {
        const schemaTools = this.getSchemaTools();
        const conn = this.connectionRuntime.loadStoredConn();
        if (!schemaTools?.ensureSObjectDescribe || !conn?.instanceUrl || !conn?.accessToken) {
            await this.sendMessage('sobject_metadata_response', { fields: [] });
            return;
        }
        const metadata = await schemaTools.ensureSObjectDescribe(conn, sobjectName);
        await this.sendMessage('sobject_metadata_response', metadata || { fields: [] });
    }

    private async applySoqlFromUi(soqlText: string) {
        this.pendingWebviewUpdate = true;
        const edit = new this.vscode.WorkspaceEdit();
        edit.replace(
            this.document.uri,
            new this.vscode.Range(0, 0, Number(this.document.lineCount || 0), 0),
            soqlText
        );
        await this.vscode.workspace.applyEdit?.(edit);
    }

    private async handleRunQuery() {
        try {
            const conn = this.connectionRuntime.loadStoredConn();
            if (!conn?.instanceUrl || !conn?.accessToken) {
                await this.vscode.window.showErrorMessage?.(
                    this.connectionRuntime.getInjectedConnectionRequiredMessage()
                );
                return;
            }
            const result = (await this.vscode.window.withProgress?.(
                {
                    location: this.vscode.ProgressLocation?.Notification,
                    title: 'Running SOQL query...',
                    cancellable: false,
                },
                async () =>
                    await executeSoqlQuery({
                        connectionRuntime: this.connectionRuntime,
                        conn,
                        soql: this.document.getText?.() || '',
                        tooling: false,
                    })
            )) as Awaited<ReturnType<typeof executeSoqlQuery>> | undefined;
            if (result) {
                await this.openQueryResults({
                    ...result,
                    documentName: getDocumentName(this.document as { uri?: { path?: string } }),
                });
            }
        } finally {
            await this.sendMessage('run_query_done');
        }
    }

    private async handleGetQueryPlan() {
        try {
            await this.runQueryPlan(this.document.getText?.() || '');
        } finally {
            await this.sendMessage('get_query_plan_done');
        }
    }

    private async handleMessage(message: SoqlBuilderMessage) {
        switch (message?.type) {
            case 'ui_activated':
                await this.sendMessage('text_soql_changed', this.document.getText?.() || '');
                return;
            case 'ui_soql_changed':
                await this.applySoqlFromUi(String(message.payload || ''));
                return;
            case 'sobjects_request':
                await this.syncSObjects();
                return;
            case 'sobject_metadata_request':
                await this.syncSObjectMetadata(String(message.payload || ''));
                return;
            case 'run_query':
                await this.handleRunQuery();
                return;
            case 'get_query_plan':
                await this.handleGetQueryPlan();
                return;
            default:
                return;
        }
    }

    private dispose() {
        for (const disposable of this.disposables.splice(0)) {
            try {
                disposable?.dispose?.();
            } catch {
                // ignore
            }
        }
    }
}

class SoqlBuilderEditorProvider {
    public constructor(
        private readonly vscode: VscodeLike,
        private readonly connectionRuntime: ConnectionRuntimeLike,
        private readonly getSchemaTools: () => SchemaToolsApiLike | null,
        private readonly openQueryResults: SoqlQueryResultsPresenter,
        private readonly runQueryPlan: (soql: string) => Promise<void>
    ) {}

    public async resolveCustomTextEditor(
        document: { uri?: unknown; lineCount?: number; getText?: () => string },
        webviewPanel: {
            webview: {
                html: string;
                options?: Record<string, unknown>;
                asWebviewUri: (uri: unknown) => unknown;
                postMessage: (message: unknown) => Promise<boolean> | boolean;
                onDidReceiveMessage: (
                    callback: (message: SoqlBuilderMessage) => void
                ) => { dispose?: () => void } | void;
            };
            onDidDispose?: (callback: () => void) => { dispose?: () => void } | void;
        }
    ) {
        webviewPanel.webview.options = {
            ...(webviewPanel.webview.options || {}),
            enableScripts: true,
            localResourceRoots: [this.vscode.Uri.file(BUILDER_TARGET_ROOT)],
        };
        const htmlTemplate = await fetchTextAsset(BUILDER_SOURCE_HTML);
        webviewPanel.webview.html = transformBuilderHtml({
            html: htmlTemplate,
            webview: webviewPanel.webview,
            vscode: this.vscode,
        });
        new SoqlBuilderEditorInstance(
            this.vscode,
            document,
            webviewPanel,
            this.connectionRuntime,
            this.getSchemaTools,
            this.openQueryResults,
            this.runQueryPlan
        );
    }
}

export function registerSoqlBuilderRuntime({
    vscode,
    context,
    connectionRuntime,
    getSchemaTools,
    openQueryResults,
    runQueryPlan,
}: {
    vscode: VscodeLike;
    context: ActivationContextLike;
    connectionRuntime: ConnectionRuntimeLike;
    getSchemaTools: () => SchemaToolsApiLike | null;
    openQueryResults: SoqlQueryResultsPresenter;
    runQueryPlan: (soql: string) => Promise<void>;
}) {
    const disposables: Array<{ dispose?: () => void }> = [];
    const pushDisposable = (value: unknown) => {
        if (value && typeof (value as { dispose?: () => void }).dispose === 'function') {
            disposables.push(value as { dispose?: () => void });
        }
        context.addDisposable(value);
    };

    if (typeof vscode.window.registerCustomEditorProvider === 'function') {
        pushDisposable(
            vscode.window.registerCustomEditorProvider(
                SOQL_BUILDER_VIEW_TYPE,
                new SoqlBuilderEditorProvider(
                    vscode,
                    connectionRuntime,
                    getSchemaTools,
                    openQueryResults,
                    runQueryPlan
                )
            )
        );
    }

    pushDisposable(
        vscode.commands.registerCommand('soql.open.new.builder', async () => {
            await openNewSoqlFile({ vscode, viewType: SOQL_BUILDER_VIEW_TYPE });
        })
    );
    pushDisposable(
        vscode.commands.registerCommand('soql.open.new.text.editor', async () => {
            await openNewSoqlFile({ vscode, viewType: SOQL_TEXT_EDITOR_VIEW_TYPE });
        })
    );
    pushDisposable(
        vscode.commands.registerCommand('soql.builder.toggle', async (arg: unknown) => {
            await toggleSoqlBuilder({ vscode, arg });
        })
    );
    pushDisposable(
        vscode.commands.registerCommand('soql.walkthrough.open', async () => {
            try {
                await vscode.commands.executeCommand(
                    'workbench.action.openWalkthrough',
                    'salesforce.salesforcedx-vscode-soql#soqlWalkthrough',
                    false
                );
            } catch {
                await vscode.window.showInformationMessage?.(
                    'SOQL walkthrough content is not available in this runtime yet.'
                );
            }
        })
    );

    return {
        dispose() {
            for (const disposable of [...disposables].reverse()) {
                try {
                    disposable?.dispose?.();
                } catch {
                    // ignore
                }
            }
        },
    };
}
