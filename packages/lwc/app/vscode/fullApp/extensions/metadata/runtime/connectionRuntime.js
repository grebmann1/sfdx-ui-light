/* eslint-disable import/no-unresolved */
import { getConfigurations, OAUTH_TYPES, removeSession } from 'core/connector';
import { createToolingClient } from 'vscode/toolingApi';

import {
    deriveWorkspaceRootFromConnection,
    loadStoredConnection,
} from '../../../workbench/activeConnection.js';
import {
    getCurrentConnection,
    hasCurrentConnectionProvider,
} from '../../../workbench/currentConnection.js';
import {
    DEFAULT_SOURCE_API_VERSION,
    normalizeSfApiVersion,
    resolveWorkspaceApiVersionFromVscode,
    writeWorkspaceApiVersionFromVscode,
} from '../../../workbench/sfdxProject.js';
import {
    clearActiveConnection,
    connectUsingSharedConfiguration,
    getConnectionAuthType,
    isAuthError,
    normalizeActiveConnection,
    persistActiveConnection,
    refreshStoredConnection,
    resolveStoredConnection,
    toStoredConnectionFromConnector,
} from '../../../workbench/sharedConnection.js';
import { getWorkspaceRootPath, getWorkspaceUri } from '../core/workspacePaths.js';

import { pickStartupConnectionCandidate } from './startupConnection.js';

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
            return 'Saved';
    }
}

async function listSharedConnectionEntries() {
    const configurations = await getConfigurations().catch(() => []);
    return (Array.isArray(configurations) ? configurations : [])
        .filter(item => item?.alias && item?.instanceUrl)
        .map(item => {
            let host = item.instanceUrl;
            try {
                host = new URL(item.instanceUrl).host;
            } catch {
                // ignore
            }
            return {
                label: item.username ? `${item.username} (${host})` : `${item.alias} (${host})`,
                description: getConnectionTypeLabel(item),
                detail: item.alias,
                host,
                configuration: item,
                _shared: true,
            };
        })
        .sort((left, right) => String(left.label || '').localeCompare(String(right.label || '')));
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
        const ids = [
            conn.orgId ? `Org: ${conn.orgId}` : '',
            conn.userId ? `User: ${conn.userId}` : '',
        ]
            .filter(Boolean)
            .join('\n');
        statusItem.tooltip = `${auth}${ids ? `\n${ids}` : ''}\n\nClick to fetch metadata into Explorer`;
        statusItem.command = 'salesforceMetadata.fetchMetadata';
    } catch {
        statusItem.text = '$(cloud) SF: Connected';
        statusItem.tooltip = 'Click to fetch metadata into Explorer';
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

async function withToolingClientAuthed(conn, fn) {
    const baseConnection = await applyWorkspaceApiVersion(conn);
    const current = await resolveStoredConnection(baseConnection).catch(() => baseConnection);
    const effectiveCurrent = await applyWorkspaceApiVersion(current, baseConnection?.apiVersion);
    const proxyUrl = isChromeExtensionEnv() ? undefined : window.location.origin;
    const client = createToolingClient({
        instanceUrl: effectiveCurrent.instanceUrl,
        apiVersion: effectiveCurrent.apiVersion,
        accessToken: effectiveCurrent.accessToken,
        proxyUrl,
    });
    try {
        return await fn(client, effectiveCurrent);
    } catch (error) {
        if (!isAuthError(error)) throw error;
        const refreshedRaw = await refreshStoredConnection(effectiveCurrent).catch(() => null);
        const refreshed = await applyWorkspaceApiVersion(
            refreshedRaw,
            effectiveCurrent?.apiVersion
        );
        if (!refreshed) throw error;
        const retryClient = createToolingClient({
            instanceUrl: refreshed.instanceUrl,
            apiVersion: refreshed.apiVersion,
            accessToken: refreshed.accessToken,
            proxyUrl,
        });
        return await fn(retryClient, refreshed);
    }
}

async function normalizeAndSaveConnection(connectionRuntime, vscode, connection) {
    const isChromeExtension = connectionRuntime.isChromeExtensionEnv();
    const normalized = await normalizeActiveConnection(connection, {
        proxyUrl: isChromeExtension ? undefined : window.location.origin,
        workspaceBasePath: getWorkspaceRootPath(vscode),
    });
    if (!normalized?.instanceUrl || !normalized?.accessToken) {
        throw new Error('Selected connection did not produce a usable access token.');
    }
    await connectionRuntime.saveConn(normalized);
    connectionRuntime.setStatus(normalized);
    return normalized;
}

async function connectSharedConfiguration(connectionRuntime, vscode, configuration) {
    const workspaceApiVersion = await connectionRuntime.getWorkspaceApiVersion();
    const connector = await connectUsingSharedConfiguration(configuration);
    return await normalizeAndSaveConnection(
        connectionRuntime,
        vscode,
        toStoredConnectionFromConnector(connector, {
            instanceUrl: configuration.instanceUrl,
            apiVersion: workspaceApiVersion,
            orgId: connector?.configuration?.orgId || configuration.orgId || '',
        })
    );
}

function loadStoredConn() {
    if (hasCurrentConnectionProvider()) {
        return (
            getCurrentConnection() || {
                instanceUrl: '',
                apiVersion: DEFAULT_SOURCE_API_VERSION,
                accessToken: '',
                authType: '',
                sharedAlias: '',
                oauthConnectionId: '',
                username: '',
                userId: '',
                orgId: '',
                organizationName: '',
                organizationType: '',
                isSandbox: null,
                workspaceRoot: '',
            }
        );
    }
    return loadStoredConnection();
}

async function saveConn(conn) {
    const nextConn = await applyWorkspaceApiVersion(conn);
    await persistActiveConnection({
        instanceUrl: nextConn.instanceUrl,
        apiVersion: nextConn.apiVersion,
        accessToken: nextConn.accessToken,
        authType: nextConn.authType,
        sharedAlias: nextConn.sharedAlias,
        oauthConnectionId: nextConn.oauthConnectionId,
        username: nextConn.username,
        userId: nextConn.userId,
        orgId: nextConn.orgId,
        organizationName: nextConn.organizationName,
        organizationType: nextConn.organizationType,
        isSandbox: nextConn.isSandbox,
        workspaceRoot: nextConn.workspaceRoot,
    });
}

async function clearConn() {
    await clearActiveConnection();
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
        getConnectionAuthType,
        getConnectionTypeLabel,
        getWorkspaceApiVersion,
        isChromeExtensionEnv,
        listSharedConnectionEntries,
        loadStoredConn,
        reloadForConnectionWorkspaceIfNeeded: conn =>
            reloadForConnectionWorkspaceIfNeeded(vscode, conn),
        saveConn,
        setStatus: conn => setStatus(statusItem, conn),
        withToolingClientAuthed,
    };
}

export function registerConnectionCommands({
    connectionRuntime,
    context,
    fetchAndPopulateWorkspace,
    invalidateToolingMap,
    setLoginProblem,
}) {
    const { vscode } = context;
    const register = (command, handler) =>
        context.addDisposable(vscode.commands.registerCommand(command, handler));

    register('salesforceMetadata.connect', async () => {
        await setLoginProblem(null);
        const current = connectionRuntime.loadStoredConn();
        const isChromeExtension = connectionRuntime.isChromeExtensionEnv();
        const workspaceApiVersion = await connectionRuntime.getWorkspaceApiVersion(
            current.apiVersion
        );

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
            const sharedConnections = await connectionRuntime
                .listSharedConnectionEntries()
                .catch(() => []);
            if (!sharedConnections.length) {
                await vscode.window.showWarningMessage(
                    'No saved orgs were found in the shared connection list.'
                );
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
                const stored = await connectSharedConfiguration(
                    connectionRuntime,
                    vscode,
                    selectedSharedConfiguration
                );
                await setLoginProblem(null);
                if (connectionRuntime.reloadForConnectionWorkspaceIfNeeded(stored)) {
                    return;
                }
                await vscode.window.showInformationMessage(
                    `Salesforce connected: ${selectedSharedConfiguration.alias}`
                );
                return;
            } catch (error) {
                const message = error?.message || String(error);
                await setLoginProblem(message);
                await vscode.window.showErrorMessage(`Salesforce connect failed: ${message}`);
                return;
            }
        }

        instanceUrl = await vscode.window.showInputBox({
            title: 'Salesforce instance URL',
            prompt: 'Example: https://mydomain.my.salesforce.com',
            value: current.instanceUrl || '',
            ignoreFocusOut: true,
        });
        if (!instanceUrl) return;

        accessToken = await vscode.window.showInputBox({
            title: 'Salesforce access token',
            prompt: 'Paste an OAuth access token (stored in sessionStorage)',
            value: '',
            password: true,
            ignoreFocusOut: true,
        });
        if (!accessToken) return;
        authType = authType || 'manual';

        try {
            const stored = await normalizeActiveConnection(
                {
                    instanceUrl,
                    apiVersion: workspaceApiVersion,
                    accessToken,
                    authType,
                    sharedAlias: '',
                    oauthConnectionId: '',
                    username,
                    userId,
                    orgId,
                },
                {
                    proxyUrl: isChromeExtension ? undefined : window.location.origin,
                    workspaceBasePath: getWorkspaceRootPath(vscode),
                }
            );
            await connectionRuntime.saveConn(stored);
            connectionRuntime.setStatus(stored);
            await setLoginProblem(null);
            if (connectionRuntime.reloadForConnectionWorkspaceIfNeeded(stored)) {
                return;
            }
            await vscode.window.showInformationMessage('Salesforce connected.');
        } catch (error) {
            const message = error?.message || String(error);
            await setLoginProblem(message);
            await vscode.window.showErrorMessage(`Salesforce connect failed: ${message}`);
        }
    });

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

    register('salesforceMetadata.disconnect', async () => {
        await connectionRuntime.clearConn();
        await removeSession().catch(() => {});
        await setLoginProblem(null);
        connectionRuntime.setStatus(connectionRuntime.loadStoredConn());
        await vscode.window.showInformationMessage('Salesforce disconnected.');
    });

    register('salesforceMetadata.fetchMetadata', async () => {
        const conn = connectionRuntime.loadStoredConn();
        if (!conn.instanceUrl || !conn.accessToken) {
            await vscode.commands.executeCommand('salesforceMetadata.connect');
            return;
        }
        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'Syncing project from Salesforce...',
                cancellable: false,
            },
            async () => {
                await connectionRuntime.withToolingClientAuthed(conn, async client => {
                    await fetchAndPopulateWorkspace(vscode, client);
                });
            }
        );
        invalidateToolingMap?.();
        try {
            await vscode.commands.executeCommand('salesforceMetadata.refreshProject');
        } catch {
            // ignore
        }
        await vscode.window.showInformationMessage('Project synced from Salesforce.');
    });
}

export async function tryRestoreStartupConnection({ connectionRuntime, vscode, setLoginProblem }) {
    const current = connectionRuntime.loadStoredConn();

    let startupCandidate = pickStartupConnectionCandidate({
        currentConnection: current,
        oauthCredentialType: OAUTH_TYPES.OAUTH,
    });

    if (!startupCandidate) {
        const sharedConnectionEntries = await connectionRuntime
            .listSharedConnectionEntries()
            .catch(() => []);
        startupCandidate = pickStartupConnectionCandidate({
            currentConnection: current,
            sharedConnectionEntries,
            oauthCredentialType: OAUTH_TYPES.OAUTH,
        });
    }

    if (!startupCandidate) {
        return null;
    }

    try {
        let restoredConnection = null;
        if (startupCandidate.type === 'stored-alias') {
            const resolved = await resolveStoredConnection(startupCandidate.connection);
            restoredConnection = await normalizeAndSaveConnection(
                connectionRuntime,
                vscode,
                resolved
            );
        } else if (startupCandidate.type === 'shared-oauth') {
            restoredConnection = await connectSharedConfiguration(
                connectionRuntime,
                vscode,
                startupCandidate.configuration
            );
        }

        await setLoginProblem?.(null);
        if (restoredConnection) {
            connectionRuntime.reloadForConnectionWorkspaceIfNeeded(restoredConnection);
        }
        return restoredConnection;
    } catch (error) {
        await setLoginProblem?.(error?.message || String(error));
        connectionRuntime.setStatus(connectionRuntime.loadStoredConn());
        return null;
    }
}

export const __testables = {
    getConnectionTypeLabel,
    isChromeExtensionEnv,
};
