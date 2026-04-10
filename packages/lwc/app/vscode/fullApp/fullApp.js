import { api, track, wire } from 'lwc';
import ToolkitElement from 'core/toolkitElement';
import { initializeVscodeApiWithDefaults, LogLevel } from 'vscode/baseEditor';
import { getVscodeBundle } from 'vscode/vscodeBundle';
import { registerAllExtensions } from './workbench/extensionRegistry.js';
import { getActiveSalesforceWorkbenchHost } from './extensions/salesforce/salesforceWorkbenchHost.js';
import { getIndexedDbFileSystem } from 'core/fs';
import { DEFAULT_WORKSPACE_ROOT } from './workbench/constants.js';
import {
    buildUserConfiguration,
    buildWorkspaceConfig,
    preloadWorkbenchConfiguration,
} from './workbench/config.js';
import { createChromeExtensionWorkerFactory } from './workbench/workers.js';
import { buildWorkspaceBootstrap } from './workbench/workspaceBootstrap.js';
import { createWorkbenchFilesService } from './workbench/workbenchFileService.js';
import { runDemoFeatures } from './workbench/demoFeatures.js';
import { refreshSalesforceMetadataForApp } from './workbench/salesforceSync.js';
import {
    DEFAULT_SOURCE_API_VERSION,
    normalizeSfApiVersion,
    resolveWorkspaceApiVersion,
} from './workbench/sfdxProject.js';
import {
    clearCurrentConnectionProvider,
    setCurrentConnectionProvider,
} from './workbench/currentConnection.js';
import { seedWorkspaceFiles } from './workbench/fsBridge.js';
import { buildOrgContext } from './workbench/orgContext.js';
import {
    normalizeWorkspaceRoot,
    deriveConnectionWorkspaceRoot,
    buildWorkbenchConnection,
    hasUsableConnection,
} from './workbench/workbenchRuntime.js';
import { buildConnectionFromConnector, credentialStrategies } from 'core/connector';
import { connectStore, store, APPLICATION } from 'core/store';
import { zipUnpackagedFiles } from 'vscode/metadataApi';

import { CHAT_MODEL_STORAGE_PREFIX, WORKBENCH_CHAT_MODEL_VENDOR, LIGHT_COLOR_THEME, DARK_COLOR_THEME } from './constants.js';

export default class VscodeWorkbenchApp extends ToolkitElement {
    // static renderMode = 'light';

    @api alias;
    @api sessionId;
    @api serverUrl;
    @api redirectUrl;
    @api sourceTabId;
    @api workspaceBasePath;

    @track vscodeInitialized = false;
    @track initializationError = null;
    @track sfApiVersion = DEFAULT_SOURCE_API_VERSION;
    @track orgContext = buildOrgContext();
    @track isConnectionAvailable = false;
    @track isConnectionBootstrapPending = true;
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
    _connectionBootstrapPromise = null;

    @wire(connectStore, { store })
    handleApplicationStore({ application }) {
        const didSessionExpire = !this.sessionHasExpired && Boolean(application?.sessionHasExpired);
        this.sessionHasExpired = Boolean(application?.sessionHasExpired);
        this._syncConnectionState(application);
        void this._syncWorkbenchConnectionUi({ announceExpired: didSessionExpire });
    }

    connectedCallback() {
        this._currentConnectionProvider = () => this._buildCurrentConnectionContext();
        setCurrentConnectionProvider(this._currentConnectionProvider);
        this._syncConnectionState(store.getState()?.application);
        void this._ensureInitialConnectionBootstrap();
    }

    disconnectedCallback() {
        clearCurrentConnectionProvider(this._currentConnectionProvider);
        this._currentConnectionProvider = null;
        this._disposeGlobalKeydownDisposer();
        this._disposeDemoRegistrationsSafely();
        this._disposeFsOverlayDisposable();
        this._disposeFsProvider();
        this._workbenchFilesService = null;
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
                await this._ensureConnectorBootstrap();
            } catch {
                // ignore and fall back to the standard connection-required UI
            } finally {
                this._syncConnectionState(store.getState()?.application);
                this.isConnectionBootstrapPending = false;
            }
        })();

        return this._connectionBootstrapPromise;
    }

    _syncConnectionState(application = store.getState()?.application || {}) {
        const connector = application?.connector || this.connector;
        const activeConnection = buildConnectionFromConnector(connector, this.sfApiVersion);
        const connectorHasError = Boolean(connector?.configuration?._hasError);
        const connectorErrorMessage =
            connector?.configuration?._errorMessage ||
            (typeof connector?.errorMessage === 'string' ? connector.errorMessage : null);

        this.connectorHasError = connectorHasError;
        this.connectorErrorMessage = connectorErrorMessage;

        this.isConnectionAvailable = Boolean(
            (activeConnection?.instanceUrl && !connectorHasError && !this.sessionHasExpired) ||
                (this.sessionId && this.serverUrl)
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
            : this._normalizeWorkspaceRoot(this.workspaceBasePath);
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

    _buildDefaultWorkspaceBootstrap() {
        const workspaceRoot = this._normalizeWorkspaceRoot(
            this._workspaceRoot || this.workspaceBasePath
        );
        return {
            workspaceRoot,
            ensureDirectories: [
                workspaceRoot,
                `${workspaceRoot}/.vscode`,
                `${workspaceRoot}/force-app/main/default`,
                `${workspaceRoot}/.salesforce`,
            ],
            initialFiles: {},
        };
    }

    _isUnsupportedPersistedChatModel(modelId) {
        if (typeof modelId !== 'string') {
            return false;
        }
        const normalized = modelId.trim();
        if (!normalized || !normalized.includes('/')) {
            return false;
        }
        const [vendor] = normalized.split('/');
        return vendor && vendor !== WORKBENCH_CHAT_MODEL_VENDOR;
    }

    _clearUnsupportedPersistedChatModels(storage, storageName) {
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
                const value = storage.getItem(key);
                if (!this._isUnsupportedPersistedChatModel(value)) {
                    continue;
                }
                storage.removeItem(key);
                storage.removeItem(`${key}.isDefault`);
                // eslint-disable-next-line no-console
                console.warn(
                    `[full-vscode][chat] cleared unsupported persisted model from ${storageName}`,
                    key,
                    value
                );
            } catch {
                // ignore
            }
        }
    }

    _sanitizePersistedChatModelSelection() {
        try {
            this._clearUnsupportedPersistedChatModels(window.localStorage, 'localStorage');
        } catch {
            // ignore
        }
        try {
            this._clearUnsupportedPersistedChatModels(window.sessionStorage, 'sessionStorage');
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
            this._workspaceBootstrap = this._buildDefaultWorkspaceBootstrap();
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

    _clearSessionBootstrapParams() {
        this.sessionId = null;
        this.serverUrl = null;
        try {
            window.sessionStorage?.removeItem?.('sfSessionId');
            window.sessionStorage?.removeItem?.('sfServerUrl');
        } catch {
            // ignore
        }
    }

    async _ensureConnectorBootstrap() {
        if (this.connector?.conn) {
            return this.connector;
        }
        if (!this.sessionId || !this.serverUrl) {
            return null;
        }

        const connector = await credentialStrategies.SESSION.connect({
            sessionId: this.sessionId,
            serverUrl: this.serverUrl,
        });
        store.dispatch(APPLICATION.reduxSlice.actions.login({ connector }));
        this._clearSessionBootstrapParams();
        return connector;
    }

    _buildCurrentConnection() {
        return buildWorkbenchConnection(this.connector, {
            sfApiVersion: this.sfApiVersion,
            workspaceRoot: this._workspaceRoot,
            workspaceBasePath: this.workspaceBasePath,
            sessionHasExpired: this.sessionHasExpired,
            connectorHasError: this.connectorHasError,
            connectorErrorMessage: this.connectorErrorMessage,
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
        const connection = this._buildCurrentConnection();
        if (!connection || !this.connector) {
            return null;
        }
        return {
            connector: this.connector,
            connection,
        };
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

        const handler = (event) => {
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

        return this._workbenchContainerEl instanceof EventTarget ? this._workbenchContainerEl : null;
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
            this._workspaceRoot = this._normalizeWorkspaceRoot(
                this._workspaceRoot || this.workspaceBasePath
            );
            const isChromeExtension = Boolean(globalThis?.chrome?.runtime?.id);
            this._isChromeExtension = isChromeExtension;
            await this._ensureInitialConnectionBootstrap();
            let activeConnection = this._buildCurrentConnection();
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
                        enableExtHostWorker: true,
                        terminal: null,
                        enforceSemanticHighlighting:true,
                        ...(isChromeExtension
                            ? {
                                  workbenchFeatures: {
                                      terminal: true,
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
                    serviceOverrides: workbenchFilesService?.getServiceOverrides(),
                },
                logLevel: LogLevel.Info,
                caller: 'VscodeWorkbenchApp._startWorkbench',
            });

            const extensionDisposables = await registerAllExtensions(vscodeBundle, {
                orgContext: this.orgContext,
            });
            this._demoDisposables.push(...extensionDisposables);

            await this._runDemoFeatures();
            this.vscodeInitialized = true;
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
            this._workspaceBootstrap || this._buildDefaultWorkspaceBootstrap();
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
            this.orgContext?.hasConnection ||
                this.orgContext?.instanceUrl ||
                this.orgContext?.host
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
        return this.orgContext?.bannerTitle || 'Welcome to Salesforce.';
    }

    get orgBannerEnvironmentLabel() {
        return this.orgContext?.environmentLabel || '';
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
        return 'Salesforce connection required';
    }

    get authBoundarySubtitle() {
        if (this.showSessionExpiredBanner) {
            return 'Your Salesforce session has expired. Reconnect from the toolkit to continue using this workbench.';
        }
        if (this.connectorHasError) {
            return (
                this.connectorErrorMessage ||
                'This workbench detected an issue with the toolkit connection. Reconnect from the toolkit to continue.'
            );
        }
        return 'This workbench needs an active toolkit session before it can load.';
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
        return this.isConnectionBootstrapPending;
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

            const walk = async (uri) => {
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
                            const relative = child.path.slice(this._workspaceRoot.length).replace(/^\//, '');
                            pathToBytes[relative] = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
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
