/* eslint-disable import/no-unresolved */
import { buildConnectionFromConnector, getConnectionAuthType, OAUTH_TYPES } from '../../../connection/connector';
import { createToolingClient } from 'vscode/toolingApi';

import {
    getInjectedConnectionContext,
    isAuthError,
    refreshConnectionRecord,
    resolveConnectionRecord,
} from '../../../connection/connectorRecord';
import {
    hasConnectionIssue,
    hasExpiredConnection,
    hasUsableConnection,
} from '../../../connection/connectionFactory';
import {
    DEFAULT_SOURCE_API_VERSION,
    normalizeSfApiVersion,
    resolveWorkspaceApiVersionFromVscode,
    writeWorkspaceApiVersionFromVscode,
} from '../../../workspace/sfdxProject';
import { registerCommand } from '../../core/extensionRegistration';
const OPEN_SALESFORCE_PANEL_COMMAND = 'salesforceMetadata.openSalesforcePanel';
import { getWorkspaceUri } from '../core/workspacePaths';

const INJECTED_CONNECTOR_REQUIRED_MESSAGE =
    'Salesforce connection is required to open this workbench. Launch it from a connected toolkit session.';
const EXPIRED_CONNECTOR_MESSAGE =
    'Salesforce connection expired. Reconnect from the toolkit to continue using org features.';

let workspaceVscode = null;

function getConnectionTypeLabel(configuration) {
    switch (configuration?.credentialType) {
        case OAUTH_TYPES.OAUTH:
            return 'OAuth';
        case OAUTH_TYPES.SESSION:
            return 'Session';
        case OAUTH_TYPES.USERNAME:
            return 'Username';
        default:
            return 'Injected';
    }
}

function buildEmptyConnection() {
    return {
        instanceUrl: '',
        apiVersion: DEFAULT_SOURCE_API_VERSION,
        accessToken: '',
        authType: '',
        oauthConnectionId: '',
        username: '',
        userId: '',
        orgId: '',
        organizationName: '',
        organizationType: '',
        isSandbox: null,
        workspaceRoot: '',
    };
}

function buildConnectionFromContext(context) {
    if (!context || typeof context !== 'object') {
        return buildEmptyConnection();
    }

    const getConnectionRecord = context?.getConnectionRecord;
    if (typeof getConnectionRecord === 'function') {
        try {
            const record = getConnectionRecord();
            if (record && typeof record === 'object') {
                return {
                    ...buildEmptyConnection(),
                    ...record,
                };
            }
        } catch {
            // ignore
        }
    }

    const connector = context?.connector;
    const fallbackApiVersion =
        typeof context?.apiVersion === 'string'
            ? context.apiVersion
            : context?.connection?.version || DEFAULT_SOURCE_API_VERSION;
    const connection = buildConnectionFromConnector(connector, fallbackApiVersion);
    if (!connection) {
        return {
            ...buildEmptyConnection(),
            sessionHasExpired: Boolean(context?.sessionHasExpired),
            hasError: Boolean(context?.hasError),
            errorMessage: typeof context?.errorMessage === 'string' ? context.errorMessage : null,
        };
    }
    return {
        ...buildEmptyConnection(),
        ...connection,
        apiVersion: fallbackApiVersion,
        workspaceRoot: typeof context?.workspaceRoot === 'string' ? context.workspaceRoot : '',
        sessionHasExpired: Boolean(context?.sessionHasExpired),
        hasError: Boolean(context?.hasError),
        errorMessage: typeof context?.errorMessage === 'string' ? context.errorMessage : null,
    };
}

function getCurrentContext() {
    const context = getInjectedConnectionContext() as any;
    return context && typeof context === 'object' ? context : null;
}

function loadLiveConnection() {
    const context = getCurrentContext();
    const liveConnection = context?.connection || context?.connector?.conn || null;
    return liveConnection && typeof liveConnection === 'object' ? liveConnection : null;
}

function requireCurrentContext() {
    const context = getCurrentContext() as any;
    const liveConnection = loadLiveConnection();
    if (!context?.connector?.conn || !liveConnection?.instanceUrl || !liveConnection?.accessToken) {
        throw new Error(INJECTED_CONNECTOR_REQUIRED_MESSAGE);
    }
    return context;
}

function getConnectionProblemMessage(conn) {
    if (conn?.errorMessage) {
        return String(conn.errorMessage);
    }
    return hasExpiredConnection(conn)
        ? EXPIRED_CONNECTOR_MESSAGE
        : INJECTED_CONNECTOR_REQUIRED_MESSAGE;
}

function setStatus(statusItem, conn) {
    if (!statusItem) return;
    if (!hasUsableConnection(conn)) {
        statusItem.text = hasConnectionIssue(conn)
            ? '$(cloud-off) SF: Disconnected'
            : '$(cloud-off) SF: Missing connection';
        statusItem.tooltip = getConnectionProblemMessage(conn);
        statusItem.command = OPEN_SALESFORCE_PANEL_COMMAND;
        return;
    }

    try {
        const who = conn.username || new URL(conn.instanceUrl).host;
        statusItem.text = `$(cloud) SF: ${who} · Connected`;
        const auth = conn.authType ? `Auth: ${conn.authType}` : 'Auth: injected';
        const ids = [
            conn.orgId ? `Org: ${conn.orgId}` : '',
            conn.userId ? `User: ${conn.userId}` : '',
        ]
            .filter(Boolean)
            .join('\n');
        statusItem.tooltip = `${auth}${ids ? `\n${ids}` : ''}\n\nStatus: Connected\nClick to open the Salesforce panel.`;
        statusItem.command = OPEN_SALESFORCE_PANEL_COMMAND;
    } catch {
        statusItem.text = '$(cloud) SF: Connected';
        statusItem.tooltip =
            'Connection is provided by the parent toolkit session.\n\nStatus: Connected\nClick to open the Salesforce panel.';
        statusItem.command = OPEN_SALESFORCE_PANEL_COMMAND;
    }
}

function isChromeExtensionEnv() {
    const chromeGlobal = globalThis as typeof globalThis & {
        chrome?: {
            runtime?: {
                id?: string;
                sendMessage?: unknown;
            };
        };
    };
    return Boolean(
        chromeGlobal?.chrome?.runtime?.id &&
        typeof chromeGlobal.chrome?.runtime?.sendMessage === 'function'
    );
}

async function getWorkspaceApiVersion(fallback = DEFAULT_SOURCE_API_VERSION) {
    return await resolveWorkspaceApiVersionFromVscode(workspaceVscode, {
        fallback: normalizeSfApiVersion(fallback, DEFAULT_SOURCE_API_VERSION),
    });
}

async function applyWorkspaceApiVersion(conn, fallback = conn?.apiVersion) {
    const apiVersion = await getWorkspaceApiVersion(fallback);
    if (!conn) {
        return { apiVersion };
    }
    return {
        ...conn,
        apiVersion,
    };
}

function getConnectionResolutionOptions(_vscode) {
    return {};
}

function loadStoredConn() {
    return buildConnectionFromContext(getCurrentContext());
}

async function saveConn(conn) {
    return await applyWorkspaceApiVersion(conn);
}

async function clearConn() {
    return undefined;
}

async function withToolingClientAuthed(conn, fn) {
    const context = requireCurrentContext();
    const currentConnection = buildConnectionFromContext(context);
    const baseConnection = await applyWorkspaceApiVersion(
        conn || currentConnection,
        currentConnection.apiVersion
    );
    const current = await resolveConnectionRecord(
        baseConnection,
        getConnectionResolutionOptions(workspaceVscode)
    ).catch(() => baseConnection);
    const effectiveCurrent = await applyWorkspaceApiVersion(current, baseConnection?.apiVersion);
    const client = createToolingClient({
        connection: context.connector.conn,
        apiVersion: effectiveCurrent.apiVersion,
    });
    try {
        return await fn(client, effectiveCurrent);
    } catch (error) {
        if (!isAuthError(error)) throw error;
        const refreshedRaw = await refreshConnectionRecord(
            effectiveCurrent,
            getConnectionResolutionOptions(workspaceVscode)
        ).catch(() => null);
        const refreshed = await applyWorkspaceApiVersion(
            refreshedRaw,
            effectiveCurrent?.apiVersion
        );
        const nextContext = requireCurrentContext();
        if (!refreshed) throw error;
        const retryClient = createToolingClient({
            connection: nextContext.connector.conn,
            apiVersion: refreshed.apiVersion,
        });
        return await fn(retryClient, refreshed);
    }
}

export function createLoginProblemSetter({ loginDiagnostics, vscode }) {
    const loginDiagUri = getWorkspaceUri(vscode, '.salesforce/login');
    return async function setLoginProblem(message) {
        if (!loginDiagnostics) return;
        try {
            if (!message) {
                loginDiagnostics.delete(loginDiagUri);
                return;
            }
            const range = new vscode.Range(0, 0, 0, 1);
            const diagnostic = new vscode.Diagnostic(
                range,
                String(message),
                vscode.DiagnosticSeverity.Error
            );
            diagnostic.source = 'salesforce login';
            loginDiagnostics.set(loginDiagUri, [diagnostic]);
        } catch {
            // ignore
        }
    };
}

export function createConnectionRuntime({ statusItem, vscode }) {
    workspaceVscode = vscode;

    const statusListeners = new Set<(conn: any) => void>();

    const runtime = {
        applyWorkspaceApiVersion,
        clearConn,
        getCurrentContext,
        getConnectionProblemMessage,
        getExpiredConnectionMessage: () => EXPIRED_CONNECTOR_MESSAGE,
        getInjectedConnectionRequiredMessage: () => INJECTED_CONNECTOR_REQUIRED_MESSAGE,
        getConnectionAuthType,
        getWorkspaceApiVersion,
        isAuthError,
        isChromeExtensionEnv,
        loadLiveConnection,
        loadStoredConn,
        normalizeConnectionRecord: conn =>
            resolveConnectionRecord(conn, getConnectionResolutionOptions(vscode)),
        requireCurrentContext,
        refreshConnectionRecord: conn =>
            refreshConnectionRecord(conn, getConnectionResolutionOptions(vscode)),
        reloadForConnectionWorkspaceIfNeeded: () => false,
        resolveConnectionRecord: conn =>
            resolveConnectionRecord(conn, getConnectionResolutionOptions(vscode)),
        saveConn,
        setStatus(conn) {
            setStatus(statusItem, conn);
            for (const listener of statusListeners) {
                try {
                    listener(conn);
                } catch {
                    // ignore listener errors
                }
            }
        },
        addStatusChangeListener(listener) {
            if (typeof listener === 'function') {
                statusListeners.add(listener);
            }
            return () => statusListeners.delete(listener);
        },
        withToolingClientAuthed,
        async resolveBridgeClient() {
            const context = getCurrentContext() as any;
            if (typeof context?.resolveBridgeClient === 'function') {
                return await context.resolveBridgeClient();
            }
            return null;
        },
    };

    return runtime;
}

export function registerConnectionCommands({ connectionRuntime, context, setLoginProblem }) {
    const { vscode } = context;

    registerCommand(
        context,
        vscode,
        'salesforceMetadata.setWorkspaceApiVersion',
        async (requestedApiVersion?: unknown) => {
            const current = connectionRuntime.loadStoredConn();
            const currentApiVersion = await connectionRuntime.getWorkspaceApiVersion(
                current.apiVersion
            );
            const normalizedRequestedApiVersion = String(requestedApiVersion || '').trim();
            const apiVersion =
                normalizedRequestedApiVersion ||
                (await vscode.window.showInputBox({
                    title: 'Set Workspace API Version',
                    prompt: 'Updates this workspace API version in sfdx-project.json and manifest/package.xml',
                    value: currentApiVersion,
                    ignoreFocusOut: true,
                    validateInput(value) {
                        const normalized = String(value || '').trim();
                        if (!normalized) {
                            return 'An API version is required.';
                        }
                        if (!/^\d+\.\d+$/.test(normalized)) {
                            return 'Use the Salesforce format, for example 66.0.';
                        }
                        return undefined;
                    },
                }));
            if (!apiVersion) return;

            const normalizedApiVersion = normalizeSfApiVersion(
                apiVersion,
                DEFAULT_SOURCE_API_VERSION
            );

            try {
                const result = await writeWorkspaceApiVersionFromVscode(
                    vscode,
                    normalizedApiVersion,
                    {
                        fallback: currentApiVersion,
                    }
                );
                if (current.instanceUrl && current.accessToken) {
                    const nextConn = {
                        ...current,
                        apiVersion: result.apiVersion,
                    };
                    await connectionRuntime.saveConn(nextConn);
                    connectionRuntime.setStatus(nextConn);
                }
                await vscode.window.showInformationMessage(
                    `Workspace API version set to ${result.apiVersion} in sfdx-project.json and manifest/package.xml.`
                );
            } catch (error) {
                const message = error?.message || String(error);
                await vscode.window.showErrorMessage(
                    `Failed to update workspace API version: ${message}`
                );
            }
        }
    );

    void setLoginProblem;
}

export async function tryRestoreStartupConnection({ connectionRuntime, setLoginProblem }) {
    const current = connectionRuntime.loadStoredConn();
    connectionRuntime.setStatus(current);
    if (hasUsableConnection(current)) {
        await setLoginProblem?.(null);
        return current;
    }
    const message = connectionRuntime.getConnectionProblemMessage(current);
    await setLoginProblem?.(message);
    if (current?.sessionHasExpired) {
        await workspaceVscode?.window?.showErrorMessage?.(message);
    }
    return null;
}

export const __testables = {
    getConnectionTypeLabel,
    isChromeExtensionEnv,
};
