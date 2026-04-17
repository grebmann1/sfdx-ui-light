import {
    connectSessionFromBackgroundResult,
    credentialStrategies,
    fetchCookieForTabIdViaBackground,
    findExistingSessionViaBackground,
    getConfiguration,
    hasChromeBackgroundMessaging,
    listOrgSessionsViaBackground,
    requestTabsPermissionViaBackground,
} from 'core/connector';
import { getIndexedDbFileSystem } from 'core/fs';
import { connectStore, store, APPLICATION } from 'core/store';
import ToolkitElement from 'core/toolkitElement';
import { api, track, wire } from 'lwc';
import { isChromeExtension } from 'shared/utils';

import {
    isSessionAuthErrorMessage,
    resolveBootstrapMode,
    SESSION_BOOTSTRAP_STORAGE_KEYS,
    shouldRemountWorkbenchWorkspace,
    shouldUsePersistedBootstrapSeed,
    shouldUsePersistedSessionBootstrap,
} from './bootstrapState';
import {
    DEFAULT_WORKSPACE_ROOT,
    LIGHT_COLOR_THEME,
    DARK_COLOR_THEME,
    WORKBENCH_IFRAME_URL,
    WORKBENCH_IFRAME_ORIGIN,
    IFRAME_FS_BRIDGE_QUERY_FLAG,
    IFRAME_FS_BRIDGE_QUERY_VERSION_PARAM,
    IFRAME_FS_BRIDGE_QUERY_PARENT_ORIGIN_PARAM,
    IFRAME_JSFORCE_BRIDGE_QUERY_FLAG,
    IFRAME_JSFORCE_BRIDGE_QUERY_VERSION_PARAM,
    IFRAME_AI_BRIDGE_QUERY_FLAG,
    IFRAME_AI_BRIDGE_QUERY_VERSION_PARAM,
} from './constants';
import { getActiveSalesforceWorkbenchHost } from 'vscode/workbench/salesforceWorkbenchHost';
import { IFRAME_JSFORCE_BRIDGE_VERSION } from './bridge/iframeJsforceBridgeContract';
import { createIframeJsforceBridgeHost } from './bridge/iframeJsforceBridgeHost';
import { createIframeJsforceBridgeRuntime } from 'vscode/workbench/iframeJsforceBridgeRuntime';
import {
    buildOrgContext,
    buildWorkbenchConnection,
    deriveConnectionWorkspaceRoot,
    clearSharedCurrentConnectionContext,
    hasUsableConnection,
    normalizeWorkspaceRoot,
    shareCurrentConnectionContext,
} from 'vscode/workbench/workbenchConnection';
import {
    buildWorkspaceBootstrap,
    DEFAULT_SOURCE_API_VERSION,
    normalizeSfApiVersion,
    seedWorkspaceFiles,
} from 'vscode/workbench/workbenchWorkspace';
import { IFRAME_FS_BRIDGE_VERSION } from './bridge/iframeFsBridgeContract';
import { createIframeFsBridgeHost } from './bridge/iframeFsBridgeHost';
import { IFRAME_AI_BRIDGE_VERSION } from './bridge/iframeAiBridgeContract';
import { createIframeAiBridgeHost } from './bridge/iframeAiBridgeHost';
import { createIframeAiBridgeRuntime } from 'vscode/workbench/iframeAiBridgeRuntime';

export default class VscodeWorkbenchApp extends ToolkitElement {
    @api sessionId;
    @api serverUrl;
    @api redirectUrl;
    @api bootstrapAlias;
    @api sourceTabId;
    @api workspaceBasePath;

    @track vscodeInitialized = false;
    @track initializationError = null;
    @track sfApiVersion = DEFAULT_SOURCE_API_VERSION;
    @track isConnectionAvailable = false;
    @track isConnectionBootstrapPending = false;
    @track sessionHasExpired = false;
    @track connectorHasError = false;
    @track connectorErrorMessage = null;
    @track themeMode = 'light';
    @track isReconnectBusy = false;
    @track isDownloadingWorkspace = false;
    @track orgContext = buildOrgContext();

    _started = false;
    _workspaceRoot = DEFAULT_WORKSPACE_ROOT;
    _appFs = null;
    _workspaceBootstrap = null;
    _currentConnectionProvider = null;
    _sharedConnectionContext = null;
    _connectionBootstrapPromise = null;
    _sessionRecoveryPromise = null;
    _workspaceSyncPromise = Promise.resolve();
    _iframeFsBridgeHost = null;
    _iframeJsforceBridgeHost = null;
    _iframeAiBridgeHost = null;
    _iframeBridgeInitializationPromise = null;
    _lastIframeConnectionEventSignature = '';
    _lastIframeThemeEventSignature = '';

    // ── Lifecycle ────────────────────────────────────────────────────────────

    @wire(connectStore, { store })
    handleApplicationStore({ application }) {
        const didSessionExpire = !this.sessionHasExpired && Boolean(application?.sessionHasExpired);
        this.sessionHasExpired = Boolean(application?.sessionHasExpired);
        this._syncConnectionState(application);
        void this._syncWorkbenchConnectionUi({ announceExpired: didSessionExpire });
        if (didSessionExpire) {
            void this.tryRecoverExpiredSession({ silent: true });
        }
    }

    connectedCallback() {
        this._sharedConnectionContext = this._createSharedConnectionContext();
        this._currentConnectionProvider = () => this._sharedConnectionContext;
        shareCurrentConnectionContext(this._currentConnectionProvider);
        this._syncConnectionState(store.getState()?.application);
        void this._ensureInitialConnectionBootstrap();
    }

    renderedCallback() {
        if (this._started) return;
        this._started = true;
        void this._initializeIframeBridge();
    }

    handleWorkbenchIframeLoad() {
        this._disposeIframeAiBridgeHost();
        this._disposeIframeJsforceBridgeHost();
        this._disposeIframeFsBridgeHost();
        void this._initializeIframeBridge();
    }

    disconnectedCallback() {
        clearSharedCurrentConnectionContext(this._currentConnectionProvider);
        this._currentConnectionProvider = null;
        this._disposeIframeAiBridgeHost();
        this._disposeIframeJsforceBridgeHost();
        this._disposeIframeFsBridgeHost();
    }

    // ── Shared connection context ─────────────────────────────────────────────

    _createSharedConnectionContext() {
        if (this._sharedConnectionContext) {
            return this._sharedConnectionContext;
        }
        const getComponent = () => this;
        this._sharedConnectionContext = {
            get connector() {
                return getComponent().connector;
            },
            get connection() {
                return getComponent().connector?.conn || null;
            },
            get workspaceRoot() {
                return getComponent()._workspaceRoot;
            },
            get apiVersion() {
                return getComponent().sfApiVersion;
            },
            get sessionHasExpired() {
                return getComponent().sessionHasExpired;
            },
            get hasError() {
                return getComponent().connectorHasError;
            },
            get errorMessage() {
                return getComponent().connectorErrorMessage;
            },
            getConnectionRecord() {
                return getComponent()._buildCurrentConnection();
            },
        };
        return this._sharedConnectionContext;
    }

    // ── Connection state ──────────────────────────────────────────────────────

    _syncConnectionState(application: any = store.getState()?.application || {}) {
        const connector = application?.connector || this.connector;
        const connectorHasError = Boolean(connector?.configuration?._hasError);
        const connectorErrorMessage =
            connector?.configuration?._errorMessage ||
            (typeof connector?.errorMessage === 'string' ? connector.errorMessage : null);
        const activeConnection = this._buildCurrentConnection(connector, {
            connectorHasError,
            connectorErrorMessage,
            sessionHasExpired: this.sessionHasExpired,
        });

        this.connectorHasError = connectorHasError;
        this.connectorErrorMessage = connectorErrorMessage;

        const bootstrapSessionId = this._getBootstrapSessionId();
        const bootstrapServerUrl = this._getBootstrapServerUrl();
        this.isConnectionAvailable = Boolean(
            (activeConnection?.instanceUrl && !connectorHasError && !this.sessionHasExpired) ||
            this._getBootstrapAlias() ||
            (bootstrapSessionId && bootstrapServerUrl)
        );
        this.sfApiVersion = normalizeSfApiVersion(
            activeConnection?.apiVersion,
            DEFAULT_SOURCE_API_VERSION
        );
        this._workspaceRoot = activeConnection?.instanceUrl
            ? this._normalizeWorkspaceRoot(
                  activeConnection.workspaceRoot ||
                      this._deriveConnectionWorkspaceRoot(activeConnection)
              )
            : this._resolvePreferredWorkspaceRoot(this.workspaceBasePath);
        this.orgContext = buildOrgContext(activeConnection);

        if (activeConnection?.instanceUrl && !connectorHasError && !this.sessionHasExpired) {
            this.initializationError = null;
        }

        this._emitIframeConnectionState('connection.sync');
    }

    _applyActiveConnection(connection) {
        if (!connection?.instanceUrl) {
            return;
        }
        this.sfApiVersion = normalizeSfApiVersion(
            connection.apiVersion,
            DEFAULT_SOURCE_API_VERSION
        );
        this._workspaceRoot = this._normalizeWorkspaceRoot(
            connection.workspaceRoot || this._deriveConnectionWorkspaceRoot(connection)
        );
        // Re-read from the live connector so identity fields (organizationType, isSandbox,
        // organizationName, etc.) reflect whatever the connector has at this moment.
        // The passed `connection` snapshot may predate identity resolution.
        const liveConnection = this._buildCurrentConnection() ?? connection;
        this.orgContext = buildOrgContext(liveConnection);
    }

    _buildCurrentConnection(
        connector = this.connector,
        {
            sessionHasExpired = this.sessionHasExpired,
            connectorHasError = this.connectorHasError,
            connectorErrorMessage = this.connectorErrorMessage,
        } = {}
    ) {
        return buildWorkbenchConnection(connector, {
            sfApiVersion: this.sfApiVersion,
            workspaceRoot: this._workspaceRoot,
            workspaceBasePath: this.workspaceBasePath,
            sessionHasExpired,
            connectorHasError,
            connectorErrorMessage,
        });
    }

    _hasUsableWorkbenchConnection(connection = this._buildCurrentConnection()) {
        return hasUsableConnection(connection);
    }

    async _syncWorkbenchConnectionUi({ announceExpired = false } = {}) {
        const host = getActiveSalesforceWorkbenchHost();
        const connectionRuntime = host?.connectionRuntime;
        if (!connectionRuntime) {
            return;
        }

        const currentConnection = connectionRuntime.loadStoredConn();
        connectionRuntime.setStatus(currentConnection);

        const message =
            currentConnection?.instanceUrl ||
            currentConnection?.sessionHasExpired ||
            currentConnection?.hasError
                ? connectionRuntime.getConnectionProblemMessage(currentConnection)
                : null;
        await host?.setLoginProblem?.(
            currentConnection?.accessToken &&
                !currentConnection?.sessionHasExpired &&
                !currentConnection?.hasError
                ? null
                : message || null
        );

        if (announceExpired && currentConnection?.sessionHasExpired && message) {
            await host?.context?.vscode?.window?.showErrorMessage?.(message);
        }
    }

    // ── Bootstrap / Connector ─────────────────────────────────────────────────

    async _ensureInitialConnectionBootstrap() {
        if (this._connectionBootstrapPromise) {
            return this._connectionBootstrapPromise;
        }

        this._connectionBootstrapPromise = (async () => {
            try {
                const CONNECTOR_BOOTSTRAP_TIMEOUT_MS = 12000;
                const timeoutMarker = Symbol('connector-bootstrap-timeout');
                const connectorBootstrapPromise = this._ensureConnectorBootstrap().catch(
                    () => null
                );

                const bootstrapResult = await Promise.race([
                    connectorBootstrapPromise,
                    new Promise(resolve =>
                        window.setTimeout(
                            () => resolve(timeoutMarker),
                            CONNECTOR_BOOTSTRAP_TIMEOUT_MS
                        )
                    ),
                ]);

                if (bootstrapResult === timeoutMarker) {
                    void connectorBootstrapPromise.then(connector => {
                        if (!connector?.conn) {
                            return;
                        }
                        this._syncConnectionState(store.getState()?.application);
                    });
                }
            } catch {
                // ignore and keep startup non-blocking
            } finally {
                this._syncConnectionState(store.getState()?.application);
                this.isConnectionBootstrapPending = false;
            }
        })();

        return this._connectionBootstrapPromise;
    }

    async _ensureConnectorBootstrap() {
        const handleConnectorFailure = (error: unknown) => {
            const message =
                error instanceof Error
                    ? error.message
                    : typeof error === 'string'
                      ? error
                      : String(error || '');
            if (isSessionAuthErrorMessage(message)) {
                this._clearConnectionBootstrapParams({ clearPersistedSeed: true });
                try {
                    store.dispatch(
                        APPLICATION.reduxSlice.actions.sessionExpired({ sessionHasExpired: true })
                    );
                } catch {
                    // ignore
                }
            }
            return null;
        };
        const toUsableConnector = (value: unknown): { conn: unknown } | null => {
            if (
                value &&
                typeof value === 'object' &&
                'conn' in value &&
                (value as { conn?: unknown }).conn
            ) {
                return value as { conn: unknown };
            }
            return null;
        };

        if (this.connector?.conn) {
            return this.connector;
        }

        const bootstrapAlias = this._getBootstrapAlias();
        const bootstrapSessionId = this._getBootstrapSessionId();
        const bootstrapServerUrl = this._getBootstrapServerUrl();
        const hasSessionBootstrap = Boolean(bootstrapSessionId && bootstrapServerUrl);

        if (hasSessionBootstrap) {
            const CONNECT_TIMEOUT_MS = 10000;
            const timeoutMarker = Symbol('session-connect-timeout');
            const connectPromise = credentialStrategies.SESSION.connect({
                sessionId: bootstrapSessionId,
                serverUrl: bootstrapServerUrl,
            });

            const connectorOrTimeout = await Promise.race([
                connectPromise,
                new Promise(resolve =>
                    window.setTimeout(() => resolve(timeoutMarker), CONNECT_TIMEOUT_MS)
                ),
            ]).catch(error => handleConnectorFailure(error));

            if (connectorOrTimeout === timeoutMarker) {
                void connectPromise
                    .then(async connector => {
                        const usableConnector = toUsableConnector(connector);
                        if (!usableConnector) {
                            return;
                        }
                        await this._applyConnector(usableConnector);
                        this._clearConnectionBootstrapParams();
                    })
                    .catch(error => handleConnectorFailure(error));
                return null;
            }

            const connector = toUsableConnector(connectorOrTimeout);
            if (!connector) {
                return null;
            }
            await this._applyConnector(connector);
            this._clearConnectionBootstrapParams();
            return connector;
        }

        if (bootstrapAlias) {
            // Always attempt OAUTH.connect regardless of whether we have a cached
            // configuration. If a stored config exists, connect() reuses its refreshToken
            // to obtain a fresh access token. If no config is stored (first time with
            // this alias, cleared storage, etc.) connect() falls through to the OAuth
            // popup so the user can authenticate — instead of silently doing nothing.
            const aliasedConnector = await credentialStrategies.OAUTH.connect({
                alias: bootstrapAlias,
            }).catch(error => handleConnectorFailure(error));
            const usableAliasedConnector = toUsableConnector(aliasedConnector);
            if (usableAliasedConnector) {
                await this._applyConnector(usableAliasedConnector);
                this._clearConnectionBootstrapParams();
                return usableAliasedConnector;
            }
        }
        return null;
    }

    async _applyConnector(connector) {
        if (!connector?.conn) {
            return null;
        }
        store.dispatch(APPLICATION.reduxSlice.actions.login({ connector }));
        this._syncConnectionState(store.getState()?.application);
        const activeConnection = this._buildCurrentConnection(connector);
        if (activeConnection?.instanceUrl) {
            await this._queueWorkspaceSync(activeConnection);
            this._applyActiveConnection({
                ...activeConnection,
                workspaceRoot: this._workspaceRoot,
                apiVersion: this.sfApiVersion,
            });
        }
        await this._syncWorkbenchConnectionUi();
        this._emitIframeConnectionState('connection.applied', { force: true });
        return connector;
    }

    async _connectWithSession({ sessionId, serverUrl }: { sessionId: string; serverUrl: string }) {
        const normalizedServerUrl = this._normalizeServerUrl(serverUrl);
        const connector = await credentialStrategies.SESSION.connect({
            sessionId,
            serverUrl: normalizedServerUrl,
            extra: {
                isProxyDisabled: isChromeExtension(),
            },
        });
        return await this._applyConnector(connector);
    }

    _getBootstrapMode() {
        return resolveBootstrapMode({
            alias: this.bootstrapAlias,
            sessionId: this.sessionId,
            serverUrl: this.serverUrl,
        });
    }

    _getBootstrapAlias() {
        const alias = String(this.bootstrapAlias || '').trim();
        return alias || null;
    }

    _shouldUseStoredBootstrapSeed() {
        return shouldUsePersistedBootstrapSeed({
            sourceTabId: this.sourceTabId,
            hasExplicitBootstrap: this._getBootstrapMode() !== 'none',
        });
    }

    _getPersistedBootstrapValue(key) {
        if (!this._shouldUseStoredBootstrapSeed()) {
            return null;
        }
        try {
            return window.sessionStorage?.getItem?.(key) || null;
        } catch {
            return null;
        }
    }

    _getBootstrapSessionId() {
        const sessionId = String(this.sessionId || '').trim();
        if (sessionId) {
            return sessionId;
        }
        if (
            !shouldUsePersistedSessionBootstrap({
                alias: this.bootstrapAlias,
                sessionId: this.sessionId,
                serverUrl: this.serverUrl,
            })
        ) {
            return null;
        }
        return this._getPersistedBootstrapValue(SESSION_BOOTSTRAP_STORAGE_KEYS.sessionId);
    }

    _getBootstrapServerUrl() {
        const serverUrl = String(this.serverUrl || '').trim();
        if (serverUrl) {
            return serverUrl;
        }
        if (
            !shouldUsePersistedSessionBootstrap({
                alias: this.bootstrapAlias,
                sessionId: this.sessionId,
                serverUrl: this.serverUrl,
            })
        ) {
            return null;
        }
        return this._getPersistedBootstrapValue(SESSION_BOOTSTRAP_STORAGE_KEYS.serverUrl);
    }

    _clearConnectionBootstrapParams({ clearPersistedSeed = false } = {}) {
        this.bootstrapAlias = null;
        this.sessionId = null;
        this.serverUrl = null;
        if (clearPersistedSeed) {
            this._clearPersistedBootstrapSeed();
        }
    }

    _clearPersistedBootstrapSeed() {
        try {
            window.sessionStorage?.removeItem?.(SESSION_BOOTSTRAP_STORAGE_KEYS.sessionId);
            window.sessionStorage?.removeItem?.(SESSION_BOOTSTRAP_STORAGE_KEYS.serverUrl);
        } catch {
            // ignore
        }
    }

    // ── Workspace ─────────────────────────────────────────────────────────────

    _normalizeWorkspaceRoot(value) {
        return normalizeWorkspaceRoot(value, DEFAULT_WORKSPACE_ROOT);
    }

    _deriveConnectionWorkspaceRoot(connection) {
        return deriveConnectionWorkspaceRoot(connection, this.workspaceBasePath);
    }

    _getBootstrapWorkspaceRoot() {
        const serverUrl = this._getBootstrapServerUrl();
        if (!serverUrl) {
            return null;
        }
        const normalizedServerUrl = String(serverUrl).startsWith('http')
            ? serverUrl
            : `https://${serverUrl}`;
        return this._deriveConnectionWorkspaceRoot({ instanceUrl: normalizedServerUrl });
    }

    _resolvePreferredWorkspaceRoot(candidate) {
        const normalizedCandidate = this._normalizeWorkspaceRoot(
            candidate || this.workspaceBasePath
        );
        const bootstrapWorkspaceRoot = this._getBootstrapWorkspaceRoot();
        if (bootstrapWorkspaceRoot && normalizedCandidate === DEFAULT_WORKSPACE_ROOT) {
            return this._normalizeWorkspaceRoot(bootstrapWorkspaceRoot);
        }
        return normalizedCandidate;
    }

    async _buildDefaultWorkspaceBootstrap() {
        const workspaceRoot = this._resolvePreferredWorkspaceRoot(
            this._workspaceRoot || this.workspaceBasePath
        );
        const serverUrl = this._getBootstrapServerUrl();
        const normalizedServerUrl = serverUrl
            ? String(serverUrl).startsWith('http')
                ? serverUrl
                : `https://${serverUrl}`
            : null;
        const seededBootstrap = await buildWorkspaceBootstrap(
            normalizedServerUrl ? { instanceUrl: normalizedServerUrl } : null,
            this.workspaceBasePath || DEFAULT_WORKSPACE_ROOT
        );
        const sourceRoot = seededBootstrap.workspaceRoot;
        const remapPath = path =>
            typeof path === 'string' && path.startsWith(sourceRoot)
                ? `${workspaceRoot}${path.slice(sourceRoot.length)}`
                : path;
        const initialFiles = Object.entries(seededBootstrap.initialFiles || {}).reduce(
            (acc, [path, content]) => {
                acc[remapPath(path)] = content;
                return acc;
            },
            {}
        );
        return {
            workspaceRoot,
            ensureDirectories: Array.from(
                new Set(
                    [workspaceRoot, ...(seededBootstrap.ensureDirectories || []).map(remapPath)]
                        .filter(Boolean)
                        .map(path => String(path))
                )
            ),
            initialFiles,
        };
    }

    async _prepareWorkspaceBootstrap(connection) {
        if (!connection?.instanceUrl || !connection?.accessToken) {
            this._workspaceBootstrap = await this._buildDefaultWorkspaceBootstrap();
            this._workspaceRoot = this._workspaceBootstrap.workspaceRoot;
            return this._workspaceBootstrap;
        }

        this._workspaceBootstrap = await buildWorkspaceBootstrap(
            connection,
            this.workspaceBasePath || DEFAULT_WORKSPACE_ROOT
        );
        this._workspaceRoot = this._normalizeWorkspaceRoot(this._workspaceBootstrap.workspaceRoot);
        return this._workspaceBootstrap;
    }

    async _syncWorkspaceBootstrapForConnection(connection = this._buildCurrentConnection()) {
        const previousWorkspaceRoot = this._workspaceRoot;
        await this._prepareWorkspaceBootstrap(connection);
        const nextWorkspaceRoot = this._workspaceBootstrap?.workspaceRoot || this._workspaceRoot;

        if (!this._iframeFsBridgeHost) {
            return nextWorkspaceRoot;
        }

        if (
            shouldRemountWorkbenchWorkspace({
                previousWorkspaceRoot,
                nextWorkspaceRoot,
            })
        ) {
            await this._seedWorkspaceFiles();
        }

        return nextWorkspaceRoot;
    }

    async _queueWorkspaceSync(connection = this._buildCurrentConnection()) {
        this._workspaceSyncPromise = this._workspaceSyncPromise
            .catch(() => {})
            .then(() => this._syncWorkspaceBootstrapForConnection(connection));
        return await this._workspaceSyncPromise;
    }

    async _seedWorkspaceFiles() {
        const workspaceBootstrap =
            this._workspaceBootstrap || (await this._buildDefaultWorkspaceBootstrap());
        await seedWorkspaceFiles(this, {
            getIndexedDbFileSystem,
            ensureDirectories: workspaceBootstrap.ensureDirectories,
            initialFiles: workspaceBootstrap.initialFiles,
            workspaceRoot: workspaceBootstrap.workspaceRoot,
        });
    }

    // ── Bridge ────────────────────────────────────────────────────────────────

    async _initializeIframeBridge() {
        if (this._iframeFsBridgeHost) {
            return;
        }
        if (this._iframeBridgeInitializationPromise) {
            return await this._iframeBridgeInitializationPromise;
        }

        this._iframeBridgeInitializationPromise = (async () => {
            try {
                this._workspaceRoot = this._resolvePreferredWorkspaceRoot(
                    this._workspaceRoot || this.workspaceBasePath
                );

                await this._ensureInitialConnectionBootstrap();
                const activeConnection = this._buildCurrentConnection();
                if (
                    activeConnection &&
                    this._hasUsableWorkbenchConnection(activeConnection)
                ) {
                    this._applyActiveConnection(activeConnection);
                    await this._prepareWorkspaceBootstrap(activeConnection);
                } else {
                    await this._prepareWorkspaceBootstrap(null);
                }

                await this._seedWorkspaceFiles();
                const iframe = this._getWorkbenchIframeElement();
                if (!iframe) {
                    throw new Error('Workbench iframe element not found.');
                }

                this._iframeFsBridgeHost = createIframeFsBridgeHost({
                    iframe,
                    targetOrigin: this._getWorkbenchIframeOrigin(),
                    getWorkspaceRoot: () => this._workspaceRoot,
                    getFileSystem: async () => {
                        if (!this._appFs) {
                            await this._seedWorkspaceFiles();
                        }
                        return (
                            this._appFs ||
                            getIndexedDbFileSystem({
                                ensureDirectories: [this._workspaceRoot],
                            })
                        );
                    },
                    onError: error => {
                        this.initializationError =
                            error?.message || 'Failed to connect the iframe filesystem bridge.';
                    },
                });
                this._iframeFsBridgeHost.start();

                const jsforceBridgeRuntime = createIframeJsforceBridgeRuntime({
                    getConnectionRecord: () => this._buildCurrentConnection(),
                    getConnector: () => this.connector,
                    getWorkspaceBasePath: () => this.workspaceBasePath,
                    getApiVersion: () => this.sfApiVersion,
                    onConnectionResolved: connection => {
                        this._applyActiveConnection(connection);
                    },
                });
                this._iframeJsforceBridgeHost = createIframeJsforceBridgeHost({
                    iframe,
                    targetOrigin: this._getWorkbenchIframeOrigin(),
                    runtime: jsforceBridgeRuntime,
                    onReady: () => {
                        this._emitIframeConnectionState('bridge.ready', { force: true });
                        this._emitIframeThemeState('bridge.ready', { force: true });
                    },
                    onError: error => {
                        this.initializationError =
                            error?.message || 'Failed to connect the iframe JSForce bridge.';
                    },
                    onAppEvent: event => {
                        this._handleWorkbenchAppEvent(event);
                    },
                });
                this._iframeJsforceBridgeHost.start();

                this._iframeAiBridgeHost = createIframeAiBridgeHost({
                    iframe,
                    targetOrigin: this._getWorkbenchIframeOrigin(),
                    runtime: createIframeAiBridgeRuntime(),
                    onError: error => {
                        // Non-fatal: AI bridge failure should not block the workbench.
                        // eslint-disable-next-line no-console
                        console.warn('[fullApp] Iframe AI bridge error:', error?.message);
                    },
                });
                this._iframeAiBridgeHost.start();
                this.initializationError = null;
                this.vscodeInitialized = true;
            } catch (error) {
                // eslint-disable-next-line no-console
                console.error('[fullApp] Failed to initialize iframe bridge:', error);
                this.initializationError =
                    error instanceof Error
                        ? error.message
                        : 'Failed to initialize iframe filesystem bridge.';
            } finally {
                this._iframeBridgeInitializationPromise = null;
            }
        })();

        return await this._iframeBridgeInitializationPromise;
    }

    _getWorkbenchIframeElement() {
        const iframe = this.template.querySelector('.workbench-iframe');
        return iframe instanceof HTMLIFrameElement ? iframe : null;
    }

    _getWorkbenchIframeOrigin() {
        try {
            return new URL(WORKBENCH_IFRAME_URL).origin;
        } catch {
            return WORKBENCH_IFRAME_ORIGIN;
        }
    }

    _disposeIframeFsBridgeHost() {
        try {
            this._iframeFsBridgeHost?.dispose?.();
        } catch {
            // ignore
        } finally {
            this._iframeFsBridgeHost = null;
        }
    }

    _disposeIframeJsforceBridgeHost() {
        try {
            this._iframeJsforceBridgeHost?.dispose?.();
        } catch {
            // ignore
        } finally {
            this._iframeJsforceBridgeHost = null;
        }
    }

    _disposeIframeAiBridgeHost() {
        try {
            this._iframeAiBridgeHost?.dispose?.();
        } catch {
            // ignore
        } finally {
            this._iframeAiBridgeHost = null;
        }
    }

    _emitIframeHostEvent(eventName, payload = null) {
        const normalizedEventName = String(eventName || '').trim();
        if (!normalizedEventName) {
            return false;
        }
        const bridgeHost = this._iframeJsforceBridgeHost;
        if (!bridgeHost?.emitEvent) {
            return false;
        }
        const normalizedPayload = payload && typeof payload === 'object' ? payload : null;
        try {
            return Boolean(
                bridgeHost.emitEvent({
                    eventName: normalizedEventName,
                    payload: normalizedPayload,
                })
            );
        } catch {
            return false;
        }
    }

    _buildIframeConnectionEventPayload() {
        const connection = this._buildCurrentConnection();
        return {
            connected: this._hasUsableWorkbenchConnection(connection),
            instanceUrl: String(connection?.instanceUrl || ''),
            apiVersion: String(this.sfApiVersion || ''),
            workspaceRoot: String(this._workspaceRoot || ''),
            sessionHasExpired: Boolean(this.sessionHasExpired),
            hasError: Boolean(this.connectorHasError),
            errorMessage: this.connectorErrorMessage || connection?.errorMessage || null,
            orgId: String(connection?.orgId || ''),
            userId: String(connection?.userId || ''),
        };
    }

    _emitIframeConnectionState(reason = 'connection.sync', { force = false } = {}) {
        const payload = {
            reason: String(reason || 'connection.sync'),
            ...this._buildIframeConnectionEventPayload(),
        };
        const signature = JSON.stringify(payload);
        if (!force && signature === this._lastIframeConnectionEventSignature) {
            return;
        }
        const emitted = this._emitIframeHostEvent('connection.state', payload);
        if (emitted) {
            this._lastIframeConnectionEventSignature = signature;
        }
    }

    _emitIframeThemeState(reason = 'theme.sync', { force = false } = {}) {
        const payload = {
            reason: String(reason || 'theme.sync'),
            themeMode: this.themeMode === 'light' ? 'light' : 'dark',
        };
        const signature = JSON.stringify(payload);
        if (!force && signature === this._lastIframeThemeEventSignature) {
            return;
        }
        const emitted = this._emitIframeHostEvent('theme.mode', payload);
        if (emitted) {
            this._lastIframeThemeEventSignature = signature;
        }
    }

    _emitIframeBannerAction(action, status, details: Record<string, unknown> = {}) {
        this._emitIframeHostEvent('banner.action', {
            action: String(action || ''),
            status: String(status || ''),
            timestamp: Date.now(),
            ...(details && typeof details === 'object' ? details : {}),
        });
    }

    // ── Workbench UI ──────────────────────────────────────────────────────────

    _applyWorkbenchTheme(themeMode) {
        this.themeMode = themeMode === 'light' ? 'light' : 'dark';
        this._emitIframeHostEvent('theme.apply', {
            colorTheme: this.themeMode === 'light' ? LIGHT_COLOR_THEME : DARK_COLOR_THEME,
        });
        this._emitIframeThemeState('theme.applied');
    }

    _handleWorkbenchAppEvent(event) {
        const eventName = String(event?.eventName || '').toLowerCase();
        const payload = event?.payload && typeof event.payload === 'object' ? event.payload : null;

        if (eventName === 'theme.changed' && payload) {
            const themeMode = String(payload.themeMode || '').toLowerCase();
            if ((themeMode === 'light' || themeMode === 'dark') && themeMode !== this.themeMode) {
                // Only update the banner; do not re-emit to the iframe to avoid a feedback loop.
                this.themeMode = themeMode;
            }
        }
    }

    _getVscodeWindow() {
        return getActiveSalesforceWorkbenchHost()?.context?.vscode?.window || null;
    }

    _normalizeServerUrl(value) {
        const normalized = String(value || '').trim();
        if (!normalized) {
            throw new Error('An instance URL is required.');
        }
        const withProtocol = /^https?:\/\//i.test(normalized)
            ? normalized
            : `https://${normalized}`;
        return new URL(withProtocol).origin;
    }

    async _showInputBox(
        options: { prompt?: string; title?: string; value?: string; [key: string]: unknown } = {}
    ) {
        const vscodeWindow = this._getVscodeWindow();
        if (typeof vscodeWindow?.showInputBox === 'function') {
            return await vscodeWindow.showInputBox({ ignoreFocusOut: true, ...options });
        }
        const fallbackValue = window.prompt(
            options?.prompt || options?.title || '',
            options?.value || ''
        );
        return typeof fallbackValue === 'string' ? fallbackValue : undefined;
    }

    async _showQuickPick(items = [], options = {}) {
        const vscodeWindow = this._getVscodeWindow();
        if (typeof vscodeWindow?.showQuickPick === 'function') {
            return await vscodeWindow.showQuickPick(items, { ignoreFocusOut: true, ...options });
        }
        return items?.[0];
    }

    async _showInformationMessage(message) {
        await this._getVscodeWindow()?.showInformationMessage?.(message);
    }

    async _showErrorMessage(message) {
        await this._getVscodeWindow()?.showErrorMessage?.(message);
    }

    // ── Public actions ────────────────────────────────────────────────────────

    async reconnectManually() {
        if (this.isReconnectBusy) {
            this._emitIframeBannerAction('reconnectManually', 'ignored', {
                reason: 'busy',
            });
            return;
        }
        this.isReconnectBusy = true;
        this._emitIframeBannerAction('reconnectManually', 'started');
        try {
            const instanceUrl = await this._showInputBox({
                title: 'Connect to Salesforce Manually',
                prompt: 'Enter the Salesforce instance URL.',
                placeHolder: 'https://mydomain.my.salesforce.com',
                validateInput: value => {
                    try {
                        this._normalizeServerUrl(value);
                        return undefined;
                    } catch (error) {
                        return error instanceof Error
                            ? error.message
                            : 'Enter a valid instance URL.';
                    }
                },
            });
            if (!instanceUrl) {
                this._emitIframeBannerAction('reconnectManually', 'cancelled', {
                    reason: 'instanceUrl-not-provided',
                });
                return;
            }

            const accessToken = await this._showInputBox({
                title: 'Connect to Salesforce Manually',
                prompt: 'Enter the Salesforce access token.',
                password: true,
                validateInput: value =>
                    String(value || '').trim() ? undefined : 'An access token is required.',
            });
            if (!accessToken) {
                this._emitIframeBannerAction('reconnectManually', 'cancelled', {
                    reason: 'accessToken-not-provided',
                });
                return;
            }

            await this._connectWithSession({
                sessionId: String(accessToken).trim(),
                serverUrl: instanceUrl,
            });
            this._emitIframeBannerAction('reconnectManually', 'completed');
        } catch (error) {
            this._emitIframeBannerAction('reconnectManually', 'failed', {
                message: error instanceof Error ? error.message : String(error),
            });
            await this._showErrorMessage(
                `Failed to connect manually: ${error instanceof Error ? error.message : String(error)}`
            );
        } finally {
            this.isReconnectBusy = false;
        }
    }

    async importBrowserOrg() {
        if (this.isReconnectBusy) {
            this._emitIframeBannerAction('importBrowserOrg', 'ignored', {
                reason: 'busy',
            });
            return;
        }
        this.isReconnectBusy = true;
        this._emitIframeBannerAction('importBrowserOrg', 'started');
        try {
            if (!hasChromeBackgroundMessaging()) {
                this._emitIframeBannerAction('importBrowserOrg', 'cancelled', {
                    reason: 'background-messaging-unavailable',
                });
                await this._showInformationMessage(
                    'Browser-backed org discovery is only available inside the Chrome extension.'
                );
                return;
            }

            let sessionCandidate = null;
            const sourceTabId = Number(this.sourceTabId);
            if (Number.isFinite(sourceTabId)) {
                const fromSourceTab = await fetchCookieForTabIdViaBackground(sourceTabId);
                if (fromSourceTab?.sessionId && fromSourceTab?.serverUrl) {
                    sessionCandidate = fromSourceTab;
                }
            }

            if (!sessionCandidate) {
                const permission = await requestTabsPermissionViaBackground();
                if (permission?.granted === false) {
                    this._emitIframeBannerAction('importBrowserOrg', 'failed', {
                        message:
                            permission.error ||
                            'Tab access is required to discover active Salesforce browser sessions.',
                    });
                    await this._showErrorMessage(
                        permission.error ||
                            'Tab access is required to discover active Salesforce browser sessions.'
                    );
                    return;
                }

                const sessions = await listOrgSessionsViaBackground();
                if (!Array.isArray(sessions)) {
                    this._emitIframeBannerAction('importBrowserOrg', 'failed', {
                        message:
                            sessions?.error || 'No active Salesforce browser sessions were found.',
                    });
                    await this._showErrorMessage(
                        sessions?.error || 'No active Salesforce browser sessions were found.'
                    );
                    return;
                }
                if (!sessions.length) {
                    this._emitIframeBannerAction('importBrowserOrg', 'cancelled', {
                        reason: 'no-browser-sessions-found',
                    });
                    await this._showInformationMessage(
                        'No reusable Salesforce session was found in your open browser tabs.'
                    );
                    return;
                }

                const picked = await this._showQuickPick(
                    sessions.map(session => ({
                        label: session.label || session.serverUrl || 'Salesforce org',
                        description: session.serverUrl || '',
                        detail: session.detail || '',
                        session,
                    })),
                    {
                        title: 'Import Active Browser Org',
                        placeHolder: 'Choose an active Salesforce browser session',
                    }
                );
                if (!picked?.session) {
                    this._emitIframeBannerAction('importBrowserOrg', 'cancelled', {
                        reason: 'session-not-selected',
                    });
                    return;
                }
                sessionCandidate = picked.session;
            }

            const backgroundConnector = await connectSessionFromBackgroundResult({
                sessionId: sessionCandidate.sessionId,
                serverUrl: sessionCandidate.serverUrl,
            });
            if (backgroundConnector?.conn) {
                await this._applyConnector(backgroundConnector);
                this._emitIframeBannerAction('importBrowserOrg', 'completed', {
                    mode: 'background-connector',
                });
                return;
            }

            await this._connectWithSession({
                sessionId: sessionCandidate.sessionId,
                serverUrl: sessionCandidate.serverUrl,
            });
            this._emitIframeBannerAction('importBrowserOrg', 'completed', {
                mode: 'session-connect',
            });
        } catch (error) {
            this._emitIframeBannerAction('importBrowserOrg', 'failed', {
                message: error instanceof Error ? error.message : String(error),
            });
            await this._showErrorMessage(
                `Failed to import browser org: ${error instanceof Error ? error.message : String(error)}`
            );
        } finally {
            this.isReconnectBusy = false;
        }
    }

    async tryRecoverExpiredSession({ silent = false } = {}) {
        if (this._sessionRecoveryPromise) {
            return await this._sessionRecoveryPromise;
        }
        if (!this.sessionHasExpired || !hasChromeBackgroundMessaging()) {
            return null;
        }

        this._sessionRecoveryPromise = (async () => {
            try {
                const configuration = this.connector?.configuration || {};
                const result = await findExistingSessionViaBackground({
                    alias: configuration.alias,
                    instanceUrl: configuration.instanceUrl,
                });
                if (!result?.sessionId || !result?.serverUrl) {
                    if (!silent) {
                        await this._showInformationMessage(
                            'No reusable Salesforce session was found in your open browser tabs.'
                        );
                    }
                    return null;
                }

                const backgroundConnector = await connectSessionFromBackgroundResult({
                    sessionId: result.sessionId,
                    serverUrl: result.serverUrl,
                });
                if (backgroundConnector?.conn) {
                    await this._applyConnector(backgroundConnector);
                    return backgroundConnector;
                }

                return await this._connectWithSession({
                    sessionId: result.sessionId,
                    serverUrl: result.serverUrl,
                });
            } catch (error) {
                if (!silent) {
                    await this._showErrorMessage(
                        `Failed to recover the expired session: ${error instanceof Error ? error.message : String(error)}`
                    );
                }
                return null;
            } finally {
                this._sessionRecoveryPromise = null;
            }
        })();

        return await this._sessionRecoveryPromise;
    }

    toggleWorkbenchTheme() {
        this._applyWorkbenchTheme(this.themeMode === 'light' ? 'dark' : 'light');
    }

    downloadWorkspace() {
        if (this.isDownloadingWorkspace) {
            return;
        }
        const emitted = this._emitIframeHostEvent('workspace.download', {
            workspaceRoot: this._workspaceRoot,
        });
        if (!emitted) {
            return;
        }
        this.isDownloadingWorkspace = true;
        setTimeout(() => {
            this.isDownloadingWorkspace = false;
        }, 5000);
    }

    refreshSalesforceMetadata() {
        this._emitIframeHostEvent('workspace.refreshMetadata', { workspaceRoot: this._workspaceRoot });
    }

    // ── Template getters ──────────────────────────────────────────────────────

    get showOrgBanner() {
        return Boolean(
            this.orgContext?.hasConnection || this.orgContext?.instanceUrl || this.orgContext?.host
        );
    }

    get workbenchIframeSrc() {
        const url = new URL(WORKBENCH_IFRAME_URL);
        url.searchParams.set(IFRAME_FS_BRIDGE_QUERY_FLAG, '1');
        url.searchParams.set(
            IFRAME_FS_BRIDGE_QUERY_VERSION_PARAM,
            String(IFRAME_FS_BRIDGE_VERSION)
        );
        url.searchParams.set(IFRAME_JSFORCE_BRIDGE_QUERY_FLAG, '1');
        url.searchParams.set(
            IFRAME_JSFORCE_BRIDGE_QUERY_VERSION_PARAM,
            String(IFRAME_JSFORCE_BRIDGE_VERSION)
        );
        url.searchParams.set(IFRAME_AI_BRIDGE_QUERY_FLAG, '1');
        url.searchParams.set(
            IFRAME_AI_BRIDGE_QUERY_VERSION_PARAM,
            String(IFRAME_AI_BRIDGE_VERSION)
        );
        if (typeof window !== 'undefined' && window.location?.origin) {
            url.searchParams.set(
                IFRAME_FS_BRIDGE_QUERY_PARENT_ORIGIN_PARAM,
                window.location.origin
            );
        }
        return url.toString();
    }

    get rootClass() {
        return this.themeMode === 'dark' ? 'root rootDark' : 'root';
    }

    get orgBannerClass() {
        const tone = this.orgContext?.tone || 'neutral';
        return `orgBanner orgBanner${tone.charAt(0).toUpperCase()}${tone.slice(1)}`;
    }

    get orgBannerTitle() {
        return this.showOrgBanner
            ? this.orgContext?.bannerTitle || 'Welcome to Salesforce.'
            : 'Salesforce disconnected.';
    }

    get orgBannerMessage() {
        return this.showOrgBanner
            ? this.orgContext?.bannerMessage || ''
            : 'Use the banner actions to reconnect and enable org features in this workbench.';
    }

    get orgBannerEnvironmentLabel() {
        return this.showOrgBanner ? this.orgContext?.environmentLabel || '' : 'Disconnected';
    }

    get orgBannerHost() {
        return this.orgContext?.host || '';
    }

    get downloadWorkspaceIcon() {
        return this.isDownloadingWorkspace ? 'loader-circle' : 'download';
    }

    get themeToggleTitle() {
        return this.themeMode === 'light' ? 'Switch to dark mode' : 'Switch to light mode';
    }

    get showLightModeIcon() {
        return this.themeMode === 'dark';
    }

    get showDarkModeIcon() {
        return this.themeMode === 'light';
    }

    get showSessionExpiredBanner() {
        return this.sessionHasExpired || this.isSessionExpiredInitializationError;
    }

    get authBoundaryTitle() {
        if (this.showSessionExpiredBanner) {
            return 'Session Expired';
        }
        if (this.connectorHasError) {
            return 'Salesforce connection issue';
        }
        return 'Salesforce disconnected';
    }

    get authBoundarySubtitle() {
        if (this.showSessionExpiredBanner) {
            return 'Your Salesforce session has expired. Use the banner actions to reconnect and continue using this workbench.';
        }
        if (this.connectorHasError) {
            return (
                this.connectorErrorMessage ||
                'This workbench detected an issue with the toolkit connection. Use the banner actions to reconnect.'
            );
        }
        return 'The editor loads without a Salesforce connection. Use the banner actions to connect an org.';
    }

    get isSessionExpiredInitializationError() {
        const message = String(this.initializationError || '').toLowerCase();
        return message.includes('session expired');
    }

    get showInitializationErrorOverlay() {
        return Boolean(this.initializationError) && !this.showSessionExpiredBanner;
    }

    get showLoadingOverlay() {
        return !this.vscodeInitialized && !this.initializationError;
    }

    get isAuthBoundaryLoading() {
        return false;
    }

    get showReconnectActions() {
        return (
            this.showSessionExpiredBanner || !this.isConnectionAvailable || this.connectorHasError
        );
    }

    get canImportBrowserSession() {
        return hasChromeBackgroundMessaging();
    }

    get isBrowserReconnectDisabled() {
        return this.isReconnectBusy || !this.canImportBrowserSession;
    }
}
