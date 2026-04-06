/* eslint-disable import/no-unresolved */
import { getConnectionAuthType, OAUTH_TYPES } from 'core/connector';
import { createToolingClient } from 'vscode/toolingApi';

import {
    getInjectedConnectionContext,
    isAuthError,
    refreshConnectionRecord,
    resolveConnectionRecord,
} from '../../../workbench/connectorRecord.js';
import {
    DEFAULT_SOURCE_API_VERSION,
    normalizeSfApiVersion,
    resolveWorkspaceApiVersionFromVscode,
    writeWorkspaceApiVersionFromVscode,
} from '../../../workbench/sfdxProject.js';
import { getWorkspaceRootPath, getWorkspaceUri } from '../core/workspacePaths.js';

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

function getCurrentContext() {
    const context = getInjectedConnectionContext();
    return context && typeof context === 'object' ? context : null;
}

function requireCurrentContext() {
    const context = getCurrentContext();
    if (
        !context?.connector?.conn ||
        !context?.connection?.instanceUrl ||
        !context?.connection?.accessToken
    ) {
        throw new Error(INJECTED_CONNECTOR_REQUIRED_MESSAGE);
    }
    return context;
}

function hasExpiredConnection(conn) {
    return Boolean(conn?.sessionHasExpired);
}

function getConnectionProblemMessage(conn) {
    return hasExpiredConnection(conn) ? EXPIRED_CONNECTOR_MESSAGE : INJECTED_CONNECTOR_REQUIRED_MESSAGE;
}

function setStatus(statusItem, conn) {
    if (!statusItem) return;
    if (!conn?.instanceUrl || !conn?.accessToken) {
        statusItem.text = hasExpiredConnection(conn)
            ? '$(cloud-off) SF: Disconnected'
            : '$(cloud-off) SF: Missing connection';
        statusItem.tooltip = getConnectionProblemMessage(conn);
        statusItem.command = undefined;
        return;
    }

    try {
        const host = new URL(conn.instanceUrl).host;
        const who = conn.username ? ` (${conn.username})` : '';
        statusItem.text = `$(cloud) SF: ${host}${who}`;
        const auth = conn.authType ? `Auth: ${conn.authType}` : 'Auth: injected';
        const ids = [
            conn.orgId ? `Org: ${conn.orgId}` : '',
            conn.userId ? `User: ${conn.userId}` : '',
        ]
            .filter(Boolean)
            .join('\n');
        statusItem.tooltip = `${auth}${ids ? `\n${ids}` : ''}\n\nConnection is provided by the parent toolkit session.`;
        statusItem.command = 'salesforceMetadata.fetchMetadata';
    } catch {
        statusItem.text = '$(cloud) SF: Connected';
        statusItem.tooltip = 'Connection is provided by the parent toolkit session.';
        statusItem.command = 'salesforceMetadata.fetchMetadata';
    }
}

function isChromeExtensionEnv() {
    return Boolean(
        globalThis?.chrome?.runtime?.id &&
        typeof globalThis.chrome?.runtime?.sendMessage === 'function'
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

function getConnectionResolutionOptions(vscode) {
    return {
        workspaceBasePath: getWorkspaceRootPath(vscode),
    };
}

function loadStoredConn() {
    return getCurrentContext()?.connection || buildEmptyConnection();
}

async function saveConn(conn) {
    return await applyWorkspaceApiVersion(conn);
}

async function clearConn() {
    return undefined;
}

async function withToolingClientAuthed(conn, fn) {
    const context = requireCurrentContext();
    const baseConnection = await applyWorkspaceApiVersion(
        conn || context.connection,
        context.connection.apiVersion
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
    return {
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
        setStatus: conn => setStatus(statusItem, conn),
        withToolingClientAuthed,
    };
}

export function registerConnectionCommands({ connectionRuntime, context, setLoginProblem }) {
    const { vscode } = context;
    const register = (command, handler) =>
        context.addDisposable(vscode.commands.registerCommand(command, handler));

    register('salesforceMetadata.setWorkspaceApiVersion', async () => {
        const current = connectionRuntime.loadStoredConn();
        const currentApiVersion = await connectionRuntime.getWorkspaceApiVersion(
            current.apiVersion
        );
        const apiVersion = await vscode.window.showInputBox({
            title: 'Set Workspace API Version',
            prompt: 'Updates sourceApiVersion in sfdx-project.json for this workspace',
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
        });
        if (!apiVersion) return;

        const normalizedApiVersion = normalizeSfApiVersion(apiVersion, DEFAULT_SOURCE_API_VERSION);

        try {
            const result = await writeWorkspaceApiVersionFromVscode(vscode, normalizedApiVersion, {
                fallback: currentApiVersion,
            });
            if (current.instanceUrl && current.accessToken) {
                const nextConn = {
                    ...current,
                    apiVersion: result.apiVersion,
                };
                await connectionRuntime.saveConn(nextConn);
                connectionRuntime.setStatus(nextConn);
            }
            await vscode.window.showInformationMessage(
                `Workspace API version set to ${result.apiVersion}.`
            );
        } catch (error) {
            const message = error?.message || String(error);
            await vscode.window.showErrorMessage(
                `Failed to update workspace API version: ${message}`
            );
        }
    });

    void setLoginProblem;
}

export async function tryRestoreStartupConnection({ connectionRuntime, setLoginProblem }) {
    const current = connectionRuntime.loadStoredConn();
    connectionRuntime.setStatus(current);
    if (current?.instanceUrl && current?.accessToken) {
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
