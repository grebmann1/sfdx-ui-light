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
import { initializeVscodeApiWithDefaults, LogLevel } from 'vscode/baseEditor';
import { zipUnpackagedFiles } from 'vscode/metadataApi';
import { getVscodeBundle } from 'vscode/vscodeBundle';

import {
    isSessionAuthErrorMessage,
    resolveBootstrapMode,
    shouldAwaitWorkbenchStartupBootstrap,
    SESSION_BOOTSTRAP_STORAGE_KEYS,
    shouldRefreshWorkbenchStartupConnection,
    shouldRemountWorkbenchWorkspace,
    shouldUsePersistedBootstrapSeed,
    shouldUsePersistedSessionBootstrap,
} from './bootstrapState';
import {
    CHAT_MODEL_STORAGE_PREFIX,
    WORKBENCH_CHAT_MODEL_FAMILY,
    WORKBENCH_CHAT_MODEL_ID,
    WORKBENCH_CHAT_MODEL_VENDOR,
    LIGHT_COLOR_THEME,
    DARK_COLOR_THEME,
} from './constants';
import { getActiveSalesforceWorkbenchHost } from './extensions/salesforce/salesforceWorkbenchHost';
import { createWorkbenchAiServiceOverrides } from './workbench/configuration/workbenchAiOverrides';
import {
    buildUserConfiguration,
    buildWorkspaceConfig,
    DEFAULT_WORKSPACE_ROOT,
    preloadWorkbenchConfiguration,
} from './workbench/workbenchConfiguration';
import {
    buildOrgContext,
    buildWorkbenchConnection,
    deriveConnectionWorkspaceRoot,
    clearSharedCurrentConnectionContext,
    hasUsableConnection,
    normalizeWorkspaceRoot,
    refreshSalesforceMetadataForApp,
    shareCurrentConnectionContext,
} from './workbench/workbenchConnection';
import {
    createChromeExtensionWorkerFactory,
    registerAllExtensions,
    runDemoFeatures,
} from './workbench/workbenchOrchestration';
import { createCoreServices } from './extensions/core/coreServices';
import {
    buildWorkspaceBootstrap,
    createWorkbenchFilesService,
    DEFAULT_SOURCE_API_VERSION,
    normalizeSfApiVersion,
    resolveWorkspaceApiVersion,
    seedWorkspaceFiles,
} from './workbench/workbenchWorkspace';

export default class VscodeWorkbenchApp extends ToolkitElement {
    // static renderMode = 'light';

    @api sessionId;
    @api serverUrl;
    @api redirectUrl;
    @api bootstrapAlias;
    @api sourceTabId;
    @api workspaceBasePath;

    @track vscodeInitialized = false;
    @track initializationError = null;
    @track sfApiVersion = DEFAULT_SOURCE_API_VERSION;
    @track orgContext = buildOrgContext();
    @track isConnectionAvailable = false;
    @track isConnectionBootstrapPending = false;
    @track sessionHasExpired = false;
    @track connectorHasError = false;
    @track connectorErrorMessage = null;
    @track themeMode = 'light';
    @track isDownloadingWorkspace = false;

    _started = false;
    _isChromeExtension = false;
    _workbenchContainerEl = null;
    _vscodeBundle = null;
    _vscode = null;
    _globalKeydownDisposer = null;
    _quickInputKeydownDisposer = null;
    _workspaceRoot = DEFAULT_WORKSPACE_ROOT;
    _forwardedKeyboardEvents = new WeakSet();

    _workbenchFilesService = null;
    _fsProvider = null;
    _fsOverlayDisposable = null;
    _appFs = null;
    _demoDisposables = [];
    _workspaceBootstrap = null;
    _currentConnectionProvider = null;
    _sharedConnectionContext = null;
    _connectionBootstrapPromise = null;
    _sessionRecoveryPromise = null;
    _workspaceSyncPromise = Promise.resolve();
    @track isReconnectBusy = false;

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

    disconnectedCallback() {
        clearSharedCurrentConnectionContext(this._currentConnectionProvider);
        this._currentConnectionProvider = null;
        this._disposeGlobalKeydownDisposer();
        this._disposeDemoRegistrationsSafely();
        this._disposeFsOverlayDisposable();
        this._disposeFsProvider();
        this._workbenchFilesService = null;
    }

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

    renderedCallback() {
        if (this._started) return;
        this._started = true;
        void this._startWorkbench();
    }

    _disposeGlobalKeydownDisposer() {
        try {
            this._globalKeydownDisposer?.dispose?.();
        } catch {
            // ignore
        } finally {
            this._globalKeydownDisposer = null;
        }
    }

    _disposeDemoRegistrationsSafely() {
        try {
            this._disposeDemoRegistrations();
        } catch {
            // ignore
        }
    }

    _disposeFsOverlayDisposable() {
        try {
            this._fsOverlayDisposable?.dispose?.();
        } catch {
            // ignore
        } finally {
            this._fsOverlayDisposable = null;
        }
    }

    _disposeFsProvider() {
        try {
            this._fsProvider?.dispose?.();
        } catch {
            // ignore
        } finally {
            this._fsProvider = null;
        }
    }

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
    }

    _normalizeWorkspaceRoot(value) {
        return normalizeWorkspaceRoot(value, DEFAULT_WORKSPACE_ROOT);
    }

    _deriveConnectionWorkspaceRoot(connection) {
        return deriveConnectionWorkspaceRoot(connection, this.workspaceBasePath);
    }

    _getBootstrapAlias() {
        const alias = String(this.bootstrapAlias || '').trim();
        return alias || null;
    }

    _getBootstrapMode() {
        return resolveBootstrapMode({
            alias: this.bootstrapAlias,
            sessionId: this.sessionId,
            serverUrl: this.serverUrl,
        });
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

    _getBootstrapOrgId() {
        const persistedOrgId = this._getPersistedBootstrapValue(
            SESSION_BOOTSTRAP_STORAGE_KEYS.orgId
        );
        if (!persistedOrgId) {
            return null;
        }

        const explicitAlias = String(this.bootstrapAlias || '').trim();
        if (explicitAlias) {
            return null;
        }

        const explicitSessionId = String(this.sessionId || '').trim();
        const explicitServerUrl = String(this.serverUrl || '').trim();
        if (!explicitSessionId || !explicitServerUrl) {
            return persistedOrgId;
        }

        const persistedSessionId = this._getPersistedBootstrapValue(
            SESSION_BOOTSTRAP_STORAGE_KEYS.sessionId
        );
        const persistedServerUrl = this._getPersistedBootstrapValue(
            SESSION_BOOTSTRAP_STORAGE_KEYS.serverUrl
        );
        if (persistedSessionId !== explicitSessionId || persistedServerUrl !== explicitServerUrl) {
            return null;
        }

        return persistedOrgId;
    }

    _getBootstrapWorkspaceRoot() {
        const orgId = this._getBootstrapOrgId();
        const serverUrl = this._getBootstrapServerUrl();
        if (!orgId && !serverUrl) {
            return null;
        }
        const normalizedServerUrl = serverUrl
            ? String(serverUrl).startsWith('http')
                ? serverUrl
                : `https://${serverUrl}`
            : null;
        return this._deriveConnectionWorkspaceRoot({
            orgId,
            instanceUrl: normalizedServerUrl,
        });
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
        const orgId = this._getBootstrapOrgId();
        const serverUrl = this._getBootstrapServerUrl();
        const normalizedServerUrl = serverUrl
            ? String(serverUrl).startsWith('http')
                ? serverUrl
                : `https://${serverUrl}`
            : null;
        const seededBootstrap = await buildWorkspaceBootstrap(
            orgId || normalizedServerUrl ? { orgId, instanceUrl: normalizedServerUrl } : null,
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

    _clearPersistedChatModels(
        storage,
        { currentVendor = '', allowedModelTokens = [], obsoleteVendors = [] } = {}
    ) {
        if (!storage) {
            return;
        }
        let keys = [];
        try {
            keys = Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter(
                Boolean
            );
        } catch {
            return;
        }

        for (const key of keys) {
            if (
                typeof key !== 'string' ||
                !key.startsWith(CHAT_MODEL_STORAGE_PREFIX) ||
                key.endsWith('.isDefault')
            ) {
                continue;
            }
            try {
                const value = String(storage.getItem(key) || '');
                const normalizedValue = value.toLowerCase();
                const shouldRemoveForVendor = obsoleteVendors.some(vendor =>
                    vendor ? value.toLowerCase().includes(String(vendor).toLowerCase()) : false
                );
                const tracksCurrentVendor =
                    !!currentVendor &&
                    normalizedValue.includes(String(currentVendor).toLowerCase());
                const referencesWorkbenchModel = allowedModelTokens.some(token =>
                    token ? normalizedValue.includes(String(token).toLowerCase()) : false
                );
                const shouldRemove =
                    shouldRemoveForVendor || (tracksCurrentVendor && !referencesWorkbenchModel);
                if (!shouldRemove) {
                    continue;
                }
                storage.removeItem(key);
                storage.removeItem(`${key}.isDefault`);
            } catch {
                // ignore
            }
        }
    }

    _sanitizePersistedChatModelSelection() {
        const obsoleteVendors = ['salesforce-workbench'].filter(
            vendor => vendor !== WORKBENCH_CHAT_MODEL_VENDOR
        );
        const allowedModelTokens = [WORKBENCH_CHAT_MODEL_ID, WORKBENCH_CHAT_MODEL_FAMILY];
        try {
            this._clearPersistedChatModels(window.localStorage, {
                currentVendor: WORKBENCH_CHAT_MODEL_VENDOR,
                allowedModelTokens,
                obsoleteVendors,
            });
        } catch {
            // ignore
        }
        try {
            this._clearPersistedChatModels(window.sessionStorage, {
                currentVendor: WORKBENCH_CHAT_MODEL_VENDOR,
                allowedModelTokens,
                obsoleteVendors,
            });
        } catch {
            // ignore
        }
    }

    _resolveThemeMode(colorTheme) {
        return String(colorTheme || '')
            .toLowerCase()
            .includes('light')
            ? 'light'
            : 'dark';
    }

    async _syncThemeModeFromWorkbench() {
        try {
            const colorTheme = this._vscode?.workspace
                ?.getConfiguration?.('workbench')
                ?.get?.('colorTheme');
            this.themeMode = this._resolveThemeMode(colorTheme);
        } catch {
            this.themeMode = 'dark';
        }
    }

    async _applyWorkbenchTheme(themeMode) {
        const nextThemeMode = themeMode === 'light' ? 'light' : 'dark';
        const colorTheme = nextThemeMode === 'light' ? LIGHT_COLOR_THEME : DARK_COLOR_THEME;

        this.themeMode = nextThemeMode;

        try {
            const workbenchConfig = this._vscode?.workspace?.getConfiguration?.('workbench');
            if (typeof workbenchConfig?.update === 'function') {
                try {
                    await workbenchConfig.update('colorTheme', colorTheme, true);
                } catch {
                    await workbenchConfig.update('colorTheme', colorTheme);
                }
            }
        } catch {
            // ignore
        }
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

    async _resolveWorkspaceApiVersion(
        workspaceRoot = this._workspaceRoot,
        fallback = this.sfApiVersion
    ) {
        const normalizedRoot = this._normalizeWorkspaceRoot(
            workspaceRoot || this.workspaceBasePath
        );
        const fs =
            this._appFs ||
            getIndexedDbFileSystem({
                ensureDirectories: [normalizedRoot],
            });
        await fs?.ready;
        return await resolveWorkspaceApiVersion({
            workspaceRoot: normalizedRoot,
            fallback: normalizeSfApiVersion(fallback, DEFAULT_SOURCE_API_VERSION),
            readFile: path => fs.readFile(path, 'utf8'),
        });
    }

    async _applyWorkspaceApiVersion(connection) {
        if (!connection) {
            return null;
        }
        const workspaceRoot = this._normalizeWorkspaceRoot(
            connection.workspaceRoot || this._deriveConnectionWorkspaceRoot(connection)
        );
        const apiVersion = await this._resolveWorkspaceApiVersion(
            workspaceRoot,
            connection.apiVersion || this.sfApiVersion
        );
        return {
            ...connection,
            workspaceRoot,
            apiVersion,
        };
    }

    async _syncAppApiVersionFromWorkspace(
        workspaceRoot = this._workspaceRoot,
        fallback = this.sfApiVersion
    ) {
        this.sfApiVersion = await this._resolveWorkspaceApiVersion(workspaceRoot, fallback);
        return this.sfApiVersion;
    }

    _clearPersistedBootstrapSeed() {
        try {
            window.sessionStorage?.removeItem?.(SESSION_BOOTSTRAP_STORAGE_KEYS.sessionId);
            window.sessionStorage?.removeItem?.(SESSION_BOOTSTRAP_STORAGE_KEYS.serverUrl);
            window.sessionStorage?.removeItem?.(SESSION_BOOTSTRAP_STORAGE_KEYS.orgId);
        } catch {
            // ignore
        }
    }

    _clearConnectionBootstrapParams({ clearPersistedSeed = false } = {}) {
        this.bootstrapAlias = null;
        this.sessionId = null;
        this.serverUrl = null;
        if (clearPersistedSeed) {
            this._clearPersistedBootstrapSeed();
        }
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
            const storedAliasConfiguration = await getConfiguration(bootstrapAlias).catch(
                () => null
            );
            if (storedAliasConfiguration) {
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
        }
        return null;
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

    _buildCurrentConnectionContext() {
        return this._createSharedConnectionContext();
    }

    _requireCurrentConnection() {
        const activeConnection = this._buildCurrentConnection();
        if (
            !activeConnection?.instanceUrl ||
            !activeConnection?.accessToken ||
            activeConnection?.sessionHasExpired ||
            activeConnection?.hasError
        ) {
            throw new Error(
                activeConnection?.errorMessage ||
                    'Salesforce connection is required to open this workbench. Launch it from a connected toolkit session.'
            );
        }
        return activeConnection;
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
        this.orgContext = buildOrgContext(connection);
    }

    async _syncWorkbenchWorkspaceFolder(nextWorkspaceRoot) {
        const workspace = this._vscode?.workspace;
        const uriFactory = this._vscode?.Uri;
        if (!workspace || !uriFactory || typeof workspace.updateWorkspaceFolders !== 'function') {
            return;
        }

        const currentFolder = Array.isArray(workspace.workspaceFolders)
            ? workspace.workspaceFolders[0]
            : null;
        const currentWorkspaceRoot = this._normalizeWorkspaceRoot(
            currentFolder?.uri?.path || currentFolder?.uri?.fsPath
        );
        const normalizedWorkspaceRoot = this._normalizeWorkspaceRoot(nextWorkspaceRoot);
        if (currentWorkspaceRoot === normalizedWorkspaceRoot) {
            return;
        }

        workspace.updateWorkspaceFolders(
            0,
            Array.isArray(workspace.workspaceFolders) ? workspace.workspaceFolders.length : 0,
            {
                uri: uriFactory.file(normalizedWorkspaceRoot),
                name: 'Org Workspace',
            }
        );
    }

    async _syncWorkspaceBootstrapForConnection(connection = this._buildCurrentConnection()) {
        const previousWorkspaceRoot =
            this._workbenchFilesService?.workspaceRoot || this._workspaceRoot;
        await this._prepareWorkspaceBootstrap(connection);
        const nextWorkspaceRoot = this._workspaceBootstrap?.workspaceRoot || this._workspaceRoot;

        if (!this._workbenchContainerEl) {
            return nextWorkspaceRoot;
        }

        if (
            !this._fsProvider ||
            shouldRemountWorkbenchWorkspace({
                previousWorkspaceRoot,
                nextWorkspaceRoot,
            })
        ) {
            await this._seedWorkspaceFiles();
            await this._syncWorkbenchWorkspaceFolder(nextWorkspaceRoot);
        }

        await this._syncAppApiVersionFromWorkspace(
            nextWorkspaceRoot,
            connection?.apiVersion || this.sfApiVersion
        );
        return nextWorkspaceRoot;
    }

    async _queueWorkspaceSync(connection = this._buildCurrentConnection()) {
        this._workspaceSyncPromise = this._workspaceSyncPromise
            .catch(() => {})
            .then(() => this._syncWorkspaceBootstrapForConnection(connection));
        return await this._workspaceSyncPromise;
    }

    _getVscodeWindow() {
        return (
            this._vscode?.window ||
            getActiveSalesforceWorkbenchHost()?.context?.vscode?.window ||
            null
        );
    }

    async _showInputBox(
        options: { prompt?: string; title?: string; value?: string; [key: string]: unknown } = {}
    ) {
        const vscodeWindow = this._getVscodeWindow();
        if (typeof vscodeWindow?.showInputBox === 'function') {
            return await vscodeWindow.showInputBox({
                ignoreFocusOut: true,
                ...options,
            });
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
            return await vscodeWindow.showQuickPick(items, {
                ignoreFocusOut: true,
                ...options,
            });
        }
        return items?.[0];
    }

    async _showInformationMessage(message) {
        await this._getVscodeWindow()?.showInformationMessage?.(message);
    }

    async _showErrorMessage(message) {
        await this._getVscodeWindow()?.showErrorMessage?.(message);
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
            this._persistResolvedWorkspaceIdentity(activeConnection);
        }
        await this._syncWorkbenchConnectionUi();
        return connector;
    }

    _persistResolvedWorkspaceIdentity(connection = this._buildCurrentConnection()) {
        const orgId = String(connection?.orgId || '').trim();
        if (!orgId) {
            return;
        }
        try {
            window.sessionStorage?.setItem?.(SESSION_BOOTSTRAP_STORAGE_KEYS.orgId, orgId);
        } catch {
            // ignore
        }
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

    async reconnectManually() {
        if (this.isReconnectBusy) {
            return;
        }
        this.isReconnectBusy = true;
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
                return;
            }

            await this._connectWithSession({
                sessionId: String(accessToken).trim(),
                serverUrl: instanceUrl,
            });
        } catch (error) {
            await this._showErrorMessage(
                `Failed to connect manually: ${error instanceof Error ? error.message : String(error)}`
            );
        } finally {
            this.isReconnectBusy = false;
        }
    }

    async importBrowserOrg() {
        if (this.isReconnectBusy) {
            return;
        }
        this.isReconnectBusy = true;
        try {
            if (!hasChromeBackgroundMessaging()) {
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
                    await this._showErrorMessage(
                        permission.error ||
                            'Tab access is required to discover active Salesforce browser sessions.'
                    );
                    return;
                }

                const sessions = await listOrgSessionsViaBackground();
                if (!Array.isArray(sessions)) {
                    await this._showErrorMessage(
                        sessions?.error || 'No active Salesforce browser sessions were found.'
                    );
                    return;
                }
                if (!sessions.length) {
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
                return;
            }

            await this._connectWithSession({
                sessionId: sessionCandidate.sessionId,
                serverUrl: sessionCandidate.serverUrl,
            });
        } catch (error) {
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

    _installSaveKeybindingWorkaround() {
        if (!this._isChromeExtension) return;
        if (this._globalKeydownDisposer) return;

        const handler = e => {
            try {
                if (!e) return;
                const key = String(e.key || '').toLowerCase();
                if (key !== 's') return;
                if (!(e.metaKey || e.ctrlKey)) return;
                if (e.altKey) return;

                // Prevent the browser "Save page" dialog in extension tabs.
                e.preventDefault();
                e.stopPropagation();

                void this._vscode?.commands?.executeCommand?.('workbench.action.files.save');
            } catch {
                // ignore
            }
        };

        window.addEventListener('keydown', handler, true);
        this._globalKeydownDisposer = {
            dispose: () => {
                try {
                    window.removeEventListener('keydown', handler, true);
                } catch {
                    // ignore
                }
            },
        };
    }

    _installQuickInputKeyboardWorkaround() {
        if (this._globalKeydownDisposer || typeof window === 'undefined') {
            return;
        }

        const handler = event => {
            try {
                if (this._forwardedKeyboardEvents.has(event)) {
                    return;
                }

                const command = this._getQuickInputWorkaroundCommand(event);
                if (command) {
                    event.preventDefault();
                    event.stopPropagation();
                    event.stopImmediatePropagation?.();
                    void this._vscode?.commands?.executeCommand?.(command);
                    return;
                }

                if (!this._shouldForwardWorkbenchShortcut(event)) {
                    return;
                }

                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation?.();
                this._forwardKeyboardEventToWorkbench(event);
            } catch {
                // ignore
            }
        };

        window.addEventListener('keydown', handler, true);
        this._globalKeydownDisposer = {
            dispose: () => {
                try {
                    window.removeEventListener('keydown', handler, true);
                } catch {
                    // ignore
                }
            },
        };
    }

    _getQuickInputWorkaroundCommand(event) {
        if (!event || event.defaultPrevented || event.isComposing) {
            return null;
        }

        if (!this._isQuickInputVisible() || !this._isWorkbenchKeyboardTarget(event)) {
            return null;
        }

        if (event.ctrlKey || event.metaKey || event.altKey) {
            return null;
        }

        switch (event.key) {
            case 'Enter':
                return event.shiftKey ? 'quickInput.acceptInBackground' : 'quickInput.accept';
            case 'ArrowDown':
                return event.shiftKey ? null : 'workbench.action.quickOpenSelectNext';
            case 'ArrowUp':
                return event.shiftKey ? null : 'workbench.action.quickOpenSelectPrevious';
            case 'Escape':
                return event.shiftKey ? null : 'workbench.action.closeQuickOpen';
            default:
                return null;
        }
    }

    _shouldForwardWorkbenchShortcut(event) {
        if (!event || event.defaultPrevented || event.isComposing) {
            return false;
        }

        if (event.altKey || !(event.ctrlKey || event.metaKey)) {
            return false;
        }

        const key = String(event.key || '').toLowerCase();
        return key === 'p';
    }

    _forwardKeyboardEventToWorkbench(event) {
        const target = this._getWorkbenchShortcutForwardTarget();
        if (!target) {
            return;
        }

        if (target instanceof HTMLElement) {
            target.focus?.({ preventScroll: true });
        }

        const forwardedEvent = new KeyboardEvent(event.type, {
            key: event.key,
            code: event.code,
            location: event.location,
            repeat: event.repeat,
            shiftKey: event.shiftKey,
            ctrlKey: event.ctrlKey,
            altKey: event.altKey,
            metaKey: event.metaKey,
            bubbles: true,
            cancelable: true,
            composed: true,
        });
        this._forwardedKeyboardEvents.add(forwardedEvent);
        target.dispatchEvent(forwardedEvent);
    }

    _getWorkbenchShortcutForwardTarget() {
        const activeElement = this._getDeepActiveElement();
        if (this._isWorkbenchEditorKeyboardSink(activeElement)) {
            return activeElement;
        }

        const selectors = [
            '.monaco-editor textarea.inputarea',
            '.monaco-editor textarea',
            '.editor-instance textarea.inputarea',
            '.monaco-workbench textarea.inputarea',
            '.monaco-workbench',
        ];

        for (const selector of selectors) {
            const target = this._workbenchContainerEl?.querySelector?.(selector);
            if (target instanceof EventTarget) {
                return target;
            }
        }

        return this._workbenchContainerEl instanceof EventTarget
            ? this._workbenchContainerEl
            : null;
    }

    _isWorkbenchEditorKeyboardSink(element) {
        return (
            element instanceof HTMLElement &&
            Boolean(
                element.matches?.(
                    '.monaco-editor textarea.inputarea, .monaco-editor textarea, .editor-instance textarea.inputarea, .monaco-workbench textarea.inputarea'
                )
            )
        );
    }

    _isQuickInputVisible() {
        const widget = this._workbenchContainerEl?.querySelector?.('.quick-input-widget');
        if (!widget) {
            return false;
        }

        if (widget.getAttribute('aria-hidden') === 'true') {
            return false;
        }

        const styles = window.getComputedStyle(widget);
        if (styles.display === 'none' || styles.visibility === 'hidden') {
            return false;
        }

        return widget.getClientRects().length > 0;
    }

    _isWorkbenchKeyboardTarget(event) {
        const eventPath = typeof event.composedPath === 'function' ? event.composedPath() : [];
        if (eventPath.includes(this._workbenchContainerEl)) {
            return true;
        }

        for (const node of eventPath) {
            if (node instanceof Node && this._workbenchContainerEl?.contains(node)) {
                return true;
            }
        }

        const target = event.target;
        const activeElement = this._getDeepActiveElement();

        if (target instanceof Node && this._workbenchContainerEl?.contains(target)) {
            return true;
        }

        return activeElement instanceof Node && this._workbenchContainerEl?.contains(activeElement);
    }

    _getDeepActiveElement() {
        const workbenchRoot = this._workbenchContainerEl?.getRootNode?.();
        let activeElement =
            workbenchRoot?.activeElement instanceof Node
                ? workbenchRoot.activeElement
                : document.activeElement;

        while (activeElement?.shadowRoot?.activeElement instanceof Node) {
            activeElement = activeElement.shadowRoot.activeElement;
        }

        return activeElement;
    }

    async _startWorkbench() {
        try {
            this._workspaceRoot = this._resolvePreferredWorkspaceRoot(
                this._workspaceRoot || this.workspaceBasePath
            );
            const isChromeExtension = Boolean(
                (
                    globalThis as typeof globalThis & {
                        chrome?: {
                            runtime?: {
                                id?: string;
                            };
                        };
                    }
                )?.chrome?.runtime?.id
            );
            this._isChromeExtension = isChromeExtension;

            const initialBootstrapPromise = this._ensureInitialConnectionBootstrap();

            let activeConnection = this._buildCurrentConnection();
            if (
                shouldAwaitWorkbenchStartupBootstrap({
                    bootstrapMode: this._getBootstrapMode(),
                    hasUsableConnection: this._hasUsableWorkbenchConnection(activeConnection),
                })
            ) {
                await initialBootstrapPromise;
                activeConnection = this._buildCurrentConnection();
            }

            if (this._hasUsableWorkbenchConnection(activeConnection)) {
                this._applyActiveConnection(activeConnection);
                await this._syncAppApiVersionFromWorkspace(
                    this._workspaceRoot,
                    activeConnection.apiVersion || this.sfApiVersion
                );
                activeConnection = {
                    ...activeConnection,
                    apiVersion: this.sfApiVersion,
                };
                this._applyActiveConnection(activeConnection);
                await this._prepareWorkspaceBootstrap(activeConnection);
            } else {
                activeConnection = null;
                await this._prepareWorkspaceBootstrap(null);
            }

            const latestConnection = this._buildCurrentConnection();
            if (
                shouldRefreshWorkbenchStartupConnection({
                    initialConnection: activeConnection,
                    latestConnection,
                })
            ) {
                activeConnection = latestConnection;
                this._applyActiveConnection(activeConnection);
                await this._syncAppApiVersionFromWorkspace(
                    this._workspaceRoot,
                    activeConnection.apiVersion || this.sfApiVersion
                );
                activeConnection = {
                    ...activeConnection,
                    apiVersion: this.sfApiVersion,
                };
                this._applyActiveConnection(activeConnection);
                await this._prepareWorkspaceBootstrap(activeConnection);
            }

            const host = this.template.querySelector('.workbench-host');
            if (!host) {
                throw new Error('Workbench host element not found.');
            }

            const shadowRoot = host.attachShadow({ mode: 'open' });
            // Mount VSCode workbench directly into the host element (no ShadowRoot).
            // host.innerHTML = '';
            const workbenchEl = document.createElement('div');
            workbenchEl.style.position = 'relative';
            workbenchEl.style.height = '100%';
            workbenchEl.style.width = '100%';
            workbenchEl.style.minHeight = '0';
            workbenchEl.style.overflow = 'hidden';
            shadowRoot.appendChild(workbenchEl);
            this._workbenchContainerEl = workbenchEl;

            await this._seedWorkspaceFiles();
            await this._syncAppApiVersionFromWorkspace(
                this._workspaceRoot,
                activeConnection?.apiVersion || this.sfApiVersion
            );
            if (this._hasUsableWorkbenchConnection(activeConnection)) {
                const syncedConnection = {
                    ...activeConnection,
                    workspaceRoot: this._workspaceRoot,
                    apiVersion: this.sfApiVersion,
                };
                this._applyActiveConnection(syncedConnection);
                activeConnection = syncedConnection;
            }

            const userConfiguration = buildUserConfiguration(isChromeExtension);
            const vscodeBundle = await getVscodeBundle();
            this._vscodeBundle = vscodeBundle;
            this._vscode = vscodeBundle?.vscode ?? null;

            const workbenchFilesService = this._ensureWorkbenchFilesService(vscodeBundle);
            this._sanitizePersistedChatModelSelection();

            await preloadWorkbenchConfiguration(vscodeBundle, userConfiguration);
            await initializeVscodeApiWithDefaults({
                vscodeApiConfig: {
                    $type: 'extended',
                    viewsConfig: {
                        $type: 'WorkbenchService',
                        htmlContainer: this._workbenchContainerEl,
                    },
                    ...(isChromeExtension
                        ? { monacoWorkerFactory: createChromeExtensionWorkerFactory(vscodeBundle) }
                        : {}),
                    advanced: {
                        loadThemes: true,
                        enableExtHostWorker: false,
                        terminal: null,
                        enforceSemanticHighlighting: true,
                        ...(isChromeExtension
                            ? {
                                  workbenchFeatures: {
                                      terminal: false,
                                      scm: true,
                                      extensions: true,
                                      extensionGallery: true,
                                      testing: true,
                                      debug: true,
                                      ai: true,
                                      chat: true,
                                      notebook: true,
                                      welcome: true,
                                      walkthrough: true,
                                      task: true,
                                      comments: true,
                                      editSessions: true,
                                      emmet: true,
                                      interactive: true,
                                      issue: true,
                                      multiDiffEditor: true,
                                      performance: true,
                                      relauncher: true,
                                      share: true,
                                      speech: true,
                                      survey: true,
                                      update: true,
                                      outline: true,
                                      timeline: true,
                                      viewBanner: true,
                                      snippets: true,
                                      keybindings: true,
                                      remoteAgent: true,
                                      localization: true,
                                      telemetry: true,
                                      mcp: true,
                                      processExplorer: true,
                                      imageResize: true,
                                      assignment: true,
                                      treeSitter: true,
                                  },
                              }
                            : {}),
                    },
                    workspaceConfig: await buildWorkspaceConfig(
                        vscodeBundle,
                        isChromeExtension,
                        this._workspaceRoot
                    ),
                    userConfiguration: {
                        json: JSON.stringify(userConfiguration),
                    },
                    serviceOverrides: createWorkbenchAiServiceOverrides(
                        workbenchFilesService?.getServiceOverrides()
                    ),
                },
                logLevel: LogLevel.Info,
                caller: 'VscodeWorkbenchApp._startWorkbench',
            });

            this.vscodeInitialized = true;
            const coreServices = await createCoreServices(vscodeBundle);
            const extensionDisposables = await registerAllExtensions(vscodeBundle, {
                coreServices,
                orgContext: this.orgContext,
            });
            this._demoDisposables.push(...extensionDisposables);
            await this._runDemoFeatures();
            await this._syncThemeModeFromWorkbench();
            await new Promise(resolve =>
                window.requestAnimationFrame(() => window.requestAnimationFrame(resolve))
            );
            //await this._openInitialWalkthrough();
            this._installQuickInputKeyboardWorkaround();
            /* if (isChromeExtension) {
                this._installSaveKeybindingWorkaround();
            } */
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Failed to initialize VSCode workbench:', error);
            this.initializationError =
                error?.message ||
                (typeof error === 'string' ? error : 'Failed to initialize VSCode workbench');
        }
    }

    _disposeDemoRegistrations() {
        const disposables = this._demoDisposables;
        this._demoDisposables = [];
        for (const d of disposables) {
            try {
                d?.dispose?.();
            } catch {
                // ignore
            }
        }
    }

    async _seedWorkspaceFiles() {
        const workspaceBootstrap =
            this._workspaceBootstrap || (await this._buildDefaultWorkspaceBootstrap());
        await seedWorkspaceFiles(this, {
            getVscodeBundle,
            getIndexedDbFileSystem,
            ensureDirectories: workspaceBootstrap.ensureDirectories,
            initialFiles: workspaceBootstrap.initialFiles,
            workspaceRoot: workspaceBootstrap.workspaceRoot,
        });
    }

    _ensureWorkbenchFilesService(vscodeBundle = this._vscodeBundle) {
        if (
            this._workbenchFilesService &&
            this._workbenchFilesService.workspaceRoot === this._workspaceRoot
        ) {
            return this._workbenchFilesService;
        }

        const bundle = vscodeBundle || this._vscodeBundle;
        const vscode = bundle?.vscode ?? this._vscode;
        if (!bundle || !vscode) {
            return null;
        }

        this._workbenchFilesService = createWorkbenchFilesService({
            vscodeBundle: bundle,
            vscode,
            workspaceRoot: this._workspaceRoot,
        });
        return this._workbenchFilesService;
    }

    get showOrgBanner() {
        return Boolean(
            this.orgContext?.hasConnection || this.orgContext?.instanceUrl || this.orgContext?.host
        );
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

    async toggleWorkbenchTheme() {
        await this._applyWorkbenchTheme(this.themeMode === 'light' ? 'dark' : 'light');
    }

    get downloadWorkspaceIcon() {
        return this.isDownloadingWorkspace ? 'loader' : 'download';
    }

    async downloadWorkspace() {
        if (this.isDownloadingWorkspace || !this._vscode) return;
        this.isDownloadingWorkspace = true;
        try {
            const vscode = this._vscode;
            const root = vscode.Uri.file(this._workspaceRoot);
            const pathToBytes = {};

            const walk = async uri => {
                let entries;
                try {
                    entries = await vscode.workspace.fs.readDirectory(uri);
                } catch {
                    return;
                }
                for (const [name, type] of entries) {
                    const child = vscode.Uri.joinPath(uri, name);
                    const isDir = vscode.FileType?.Directory
                        ? (Number(type) & vscode.FileType.Directory) === vscode.FileType.Directory
                        : Number(type) === 2;
                    if (isDir) {
                        // eslint-disable-next-line no-await-in-loop
                        await walk(child);
                    } else {
                        // eslint-disable-next-line no-await-in-loop
                        const bytes = await vscode.workspace.fs.readFile(child).catch(() => null);
                        if (bytes) {
                            const relative = child.path
                                .slice(this._workspaceRoot.length)
                                .replace(/^\//, '');
                            pathToBytes[relative] =
                                bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
                        }
                    }
                }
            };

            await walk(root);

            const zipBytes = zipUnpackagedFiles(pathToBytes);
            const blob = new Blob([zipBytes], { type: 'application/zip' });
            const url = URL.createObjectURL(blob);
            const orgSlug = this.orgContext?.host
                ? this.orgContext.host.replace(/[^a-zA-Z0-9_-]/g, '_')
                : 'workspace';
            const ts = new Date().toISOString().slice(0, 10);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${orgSlug}-${ts}.zip`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error('[fullApp] workspace download failed:', error);
        } finally {
            this.isDownloadingWorkspace = false;
        }
    }

    async refreshSalesforceMetadata() {
        await refreshSalesforceMetadataForApp(this);
    }

    async _runDemoFeatures() {
        await runDemoFeatures(this, getVscodeBundle);
    }
}
