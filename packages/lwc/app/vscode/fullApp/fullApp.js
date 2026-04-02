import { api, LightningElement, track } from 'lwc';
import { initializeVscodeApiWithDefaults, LogLevel } from 'vscode/baseEditor';
import { getVscodeBundle } from 'vscode/vscodeBundle';
import { createToolingClient } from 'vscode/toolingApi';
import { loadExtension as loadSfMetadataExtension, activate as activateSfMetadataExtension } from './extensions/metadata/extension.js';
import { loadExtension as loadAgentScriptExtension, activate as activateAgentScriptExtension } from './extensions/agentscript/extension.js';
import { getIndexedDbFileSystem } from 'core/fs';
import { DEFAULT_WORKSPACE_ROOT } from './workbench/constants.js';
import { buildUserConfiguration, buildWorkspaceConfig, preloadWorkbenchConfiguration } from './workbench/config.js';
import { createChromeExtensionWorkerFactory } from './workbench/workers.js';
import { runDemoFeatures } from './workbench/demoFeatures.js';
import { refreshSalesforceMetadataForApp } from './workbench/salesforceSync.js';
import {
    clearActiveConnection,
    connectUsingSharedConfiguration,
    persistActiveConnection,
    resolveStoredConnection,
    toStoredConnectionFromConnector,
} from './workbench/sharedConnection.js';
import {
    clearUrlConnectionParams,
    deriveWorkspaceRootFromConnection,
    loadStoredConnection,
    parseUrlConnectionParams,
} from './workbench/activeConnection.js';
import {
    disposeRegistrations,
    ensureIndexedDbWritableFileClass,
    hydrateWorkspaceFromIndexedDb,
    mkdirp,
    registerFileNode,
    registerLazyReadOnlyFile,
    registerSfLazyReadOnlyFile,
    registerSfTextFile,
    registerTextFile,
    resolveInitialIndexedDbText,
    seedWorkspaceFiles,
} from './workbench/fsBridge.js';
import {
    auraFilename,
    encodeUtf8,
    mapWithConcurrency,
    sanitizePathSegment,
    STORAGE_KEYS,
} from 'vscode/utils';

export default class VscodeWorkbenchApp extends LightningElement {
    // static renderMode = 'light';

    @api alias;
    @api sessionId;
    @api serverUrl;
    @api redirectUrl;
    @api sourceTabId;
    @api workspaceBasePath = '/workspace/orgs/Workbench-PROD';

    @track vscodeInitialized = false;
    @track initializationError = null;

    // Extension-first UX: Salesforce UI lives in the workbench (status bar/commands).
    @track useExtensionUi = true;

    @track sfInstanceUrl = '';
    @track sfAccessToken = '';
    @track sfApiVersion = '63.0';
    @track sfUseProxy = false;
    @track sfProxyUrl = 'http://localhost:3001';
    @track sfConnected = false;
    @track sfConnecting = false;
    @track sfRefreshing = false;
    @track sfError = null;
    @track sfLastRefreshAt = null;
    @track sfPanelCollapsed = false;

    _started = false;
    _isChromeExtension = false;
    _workbenchContainerEl = null;
    _vscodeBundle = null;
    _vscode = null;
    _globalKeydownDisposer = null;
    _agentScriptLanguageClientWrapper = null;
    _workspaceRoot = DEFAULT_WORKSPACE_ROOT;

    _fsw = null;
    _fsProvider = null;
    _fsOverlayDisposable = null;
    _fsRegistrations = [];
    _sfRegistrations = [];
    _appFs = null;
    _IndexedDbWritableFile = null;
    _LazyReadOnlyFile = null;
    _demoDisposables = [];

    connectedCallback() {
        const activeConnection = loadStoredConnection();
        try {
            this.sfInstanceUrl = activeConnection.instanceUrl || localStorage.getItem(STORAGE_KEYS.instanceUrl) || '';
            this.sfApiVersion = activeConnection.apiVersion || localStorage.getItem(STORAGE_KEYS.apiVersion) || '63.0';

            const storedUseProxy = localStorage.getItem(STORAGE_KEYS.useProxy);
            if (storedUseProxy === null) {
                const host = typeof window !== 'undefined' ? window.location.hostname : '';
                this.sfUseProxy = host === 'localhost' || host === '127.0.0.1';
            } else {
                this.sfUseProxy = storedUseProxy === 'true';
            }
            this.sfProxyUrl = localStorage.getItem(STORAGE_KEYS.proxyUrl) || '';

            const collapsed = localStorage.getItem(STORAGE_KEYS.panelCollapsed);
            this.sfPanelCollapsed = collapsed === 'true';
        } catch {
            // ignore
        }

        try {
            this.sfAccessToken = activeConnection.accessToken || sessionStorage.getItem(STORAGE_KEYS.accessToken) || '';
        } catch {
            // ignore
        }

        this._workspaceRoot = activeConnection.instanceUrl
            ? this._normalizeWorkspaceRoot(
                activeConnection.workspaceRoot || this._deriveConnectionWorkspaceRoot(activeConnection)
            )
            : this._normalizeWorkspaceRoot(this.workspaceBasePath);
    }

    disconnectedCallback() {
        try {
            this._globalKeydownDisposer?.dispose?.();
        } catch {
            // ignore
        } finally {
            this._globalKeydownDisposer = null;
        }
        try {
            this._agentScriptLanguageClientWrapper?.dispose?.();
        } catch {
            // ignore
        } finally {
            this._agentScriptLanguageClientWrapper = null;
        }
        try {
            this._disposeDemoRegistrations();
        } catch {
            // ignore
        }
    }

    renderedCallback() {
        if (this._started) return;
        this._started = true;
        void this._startWorkbench();
    }

    _normalizeWorkspaceRoot(value) {
        const raw = String(value ?? '').trim();
        if (!raw) {
            return DEFAULT_WORKSPACE_ROOT;
        }
        const normalized = raw.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
        return normalized ? `/${normalized}` : DEFAULT_WORKSPACE_ROOT;
    }

    _deriveConnectionWorkspaceRoot(connection) {
        return this._normalizeWorkspaceRoot(
            deriveWorkspaceRootFromConnection(connection, this.workspaceBasePath || DEFAULT_WORKSPACE_ROOT)
        );
    }

    async _fetchUserInfo({ instanceUrl, accessToken }) {
        try {
            const url = `${String(instanceUrl || '').replace(/\/+$/, '')}/services/oauth2/userinfo`;
            const response = await fetch(url, {
                method: 'GET',
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (!response.ok) {
                return null;
            }
            const body = await response.json().catch(() => null);
            if (!body || typeof body !== 'object') {
                return null;
            }
            return {
                username: body?.preferred_username || body?.email || body?.username || '',
                userId: body?.user_id || '',
                orgId: body?.organization_id || '',
            };
        } catch {
            return null;
        }
    }

    async _validateBootstrapConnection(connection) {
        if (!connection?.instanceUrl || !connection?.accessToken) {
            return null;
        }

        const client = createToolingClient({
            instanceUrl: connection.instanceUrl,
            accessToken: connection.accessToken,
            apiVersion: connection.apiVersion || '63.0',
            proxyUrl: this.sfUseProxy ? (this.sfProxyUrl?.trim() || window.location.origin) : undefined,
        });

        await client.ping();
        const userInfo =
            !connection.username || !connection.userId || !connection.orgId
                ? await this._fetchUserInfo({
                    instanceUrl: client.instanceUrl,
                    accessToken: connection.accessToken,
                })
                : null;

        return {
            ...connection,
            instanceUrl: client.instanceUrl,
            apiVersion: client.apiVersion,
            username: connection.username || userInfo?.username || '',
            userId: connection.userId || userInfo?.userId || '',
            orgId: connection.orgId || userInfo?.orgId || '',
            workspaceRoot: connection.workspaceRoot || this._deriveConnectionWorkspaceRoot(connection),
        };
    }

    async _resolveBootstrapConnectionFromProps() {
        const alias = String(this.alias || '').trim();
        if (alias) {
            const connector = await connectUsingSharedConfiguration({
                alias,
                credentialType: 'OAUTH',
            }).catch(() => null);
            if (connector) {
                const stored = toStoredConnectionFromConnector(connector, {
                    sharedAlias: alias,
                    workspaceRoot: this._deriveConnectionWorkspaceRoot({
                        username: connector?.configuration?.username,
                        instanceUrl: connector?.conn?.instanceUrl || connector?.configuration?.instanceUrl,
                        orgId: connector?.configuration?.orgId,
                    }),
                });
                if (stored.instanceUrl && stored.accessToken) {
                    return stored;
                }
            }

            const resolved = await resolveStoredConnection({
                sharedAlias: alias,
                workspaceRoot: this._deriveConnectionWorkspaceRoot({ username: alias }),
            }).catch(() => null);
            if (resolved?.instanceUrl && resolved?.accessToken) {
                return resolved;
            }
        }

        const sessionId = String(this.sessionId || '').trim();
        const serverUrl = String(this.serverUrl || '').trim();
        if (sessionId && serverUrl) {
            return await this._validateBootstrapConnection({
                instanceUrl: serverUrl,
                accessToken: sessionId,
                apiVersion: this.sfApiVersion || '63.0',
                authType: 'session',
                sharedAlias: '',
                username: '',
                userId: '',
                orgId: '',
                workspaceRoot: this._deriveConnectionWorkspaceRoot({ instanceUrl: serverUrl }),
            });
        }

        return null;
    }

    _applyActiveConnection(connection) {
        if (!connection?.instanceUrl || !connection?.accessToken) {
            return;
        }
        this.sfInstanceUrl = connection.instanceUrl;
        this.sfAccessToken = connection.accessToken;
        this.sfApiVersion = connection.apiVersion || '63.0';
        this.sfConnected = true;
        this.sfError = null;
        this._workspaceRoot = this._normalizeWorkspaceRoot(
            connection.workspaceRoot || this._deriveConnectionWorkspaceRoot(connection)
        );
    }

    _installSaveKeybindingWorkaround() {
        if (!this._isChromeExtension) return;
        if (this._globalKeydownDisposer) return;

        const handler = (e) => {
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

    async _initializeAgentScriptSupport(vscodeBundle) {
        try {
            const LanguageClientWrapper = vscodeBundle?.monacoLanguageClient?.LanguageClient?.LanguageClientWrapper;
            if (LanguageClientWrapper && !this._agentScriptLanguageClientWrapper) {
                const { languageClientConfig } = await activateAgentScriptExtension(vscodeBundle);
                if (languageClientConfig) {
                    this._agentScriptLanguageClientWrapper = new LanguageClientWrapper(languageClientConfig);
                    await this._agentScriptLanguageClientWrapper.start();
                }
            }
        } catch (e) {
            // eslint-disable-next-line no-console
            console.warn('Agent Script language client failed to start:', e);
        }

        try {
            const extension = vscodeBundle?.vscode?.extensions?.getExtension?.('salesforce.agentscript-extension');
            await extension?.activate?.();
        } catch (e) {
            // eslint-disable-next-line no-console
            console.warn('Agent Script extension activation failed:', e);
        }
    }

    async _startWorkbench() {
        try {
            this._workspaceRoot = this._normalizeWorkspaceRoot(this.workspaceBasePath);
            const isChromeExtension = Boolean(globalThis?.chrome?.runtime?.id);
            this._isChromeExtension = isChromeExtension;

            const urlConnection = parseUrlConnectionParams();
            if (urlConnection) {
                try {
                    const validatedUrlConnection = await this._validateBootstrapConnection(urlConnection);
                    await persistActiveConnection(validatedUrlConnection);
                    this._applyActiveConnection(validatedUrlConnection);
                } catch (e) {
                    this.sfError = e?.message || 'Failed to validate URL-provided Salesforce connection.';
                    await clearActiveConnection();
                } finally {
                    clearUrlConnectionParams();
                }
            } else {
                const propConnection = await this._resolveBootstrapConnectionFromProps().catch(() => null);
                if (propConnection?.instanceUrl && propConnection?.accessToken) {
                    await persistActiveConnection(propConnection);
                    this._applyActiveConnection(propConnection);
                } else {
                    const storedConnection = loadStoredConnection();
                    if (storedConnection.sharedAlias || (storedConnection.instanceUrl && storedConnection.accessToken)) {
                        const resolvedConnection = await resolveStoredConnection(storedConnection).catch(() => storedConnection);
                        if (resolvedConnection.instanceUrl && resolvedConnection.accessToken) {
                            this._applyActiveConnection(resolvedConnection);
                        }
                    }
                }
            }

            if ((!this.sfInstanceUrl || !this.sfAccessToken) && isChromeExtension && this.sourceTabId && chrome?.runtime?.sendMessage) {
                const tabId = Number(this.sourceTabId);
                if (Number.isFinite(tabId)) {
                    try {
                        const cookieInfo = await chrome.runtime.sendMessage({
                            action: 'fetchCookieForTabId',
                            tabId,
                        });
                        const serverUrl = cookieInfo?.serverUrl;
                        const sessionId = cookieInfo?.sessionId;
                        if (serverUrl && sessionId) {
                            this.sfInstanceUrl = serverUrl;
                            this.sfAccessToken = sessionId;
                            this.sfUseProxy = false;
                            await this.handleConnect();
                        } else if (cookieInfo?.error) {
                            this.sfError = cookieInfo.error;
                        }
                    } catch (e) {
                        this.sfError = e?.message || 'Failed to read Salesforce session cookie.';
                    }
                }
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

            const [sfMetadataExtension, agentScriptExtension] = await Promise.all([
                loadSfMetadataExtension(),
                loadAgentScriptExtension(),
            ]);
            const userConfiguration = buildUserConfiguration(isChromeExtension);
            const vscodeBundle = await getVscodeBundle();
            await preloadWorkbenchConfiguration(vscodeBundle, userConfiguration);

            await initializeVscodeApiWithDefaults({
                vscodeApiConfig: {
                    $type: 'extended',
                    viewsConfig: {
                        $type: 'WorkbenchService',
                        htmlContainer: this._workbenchContainerEl,
                    },
                    ...(isChromeExtension ? { monacoWorkerFactory: createChromeExtensionWorkerFactory(vscodeBundle) } : {}),
                    advanced: {
                        loadThemes: true,
                        enableExtHostWorker: false,
                        terminal: null,
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
                                    mcp: false,
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
                    extensions: [sfMetadataExtension, agentScriptExtension],
                },
                logLevel: LogLevel.Info,
                caller: 'VscodeWorkbenchApp._startWorkbench',
            });

            await activateSfMetadataExtension(await getVscodeBundle());
            await activateAgentScriptExtension(await getVscodeBundle());

            //await this._openReadme();
            await this._runDemoFeatures();
            if (isChromeExtension) {
                this._installSaveKeybindingWorkaround();
            }

            this.vscodeInitialized = true;
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Failed to initialize VSCode workbench:', error);
            this.initializationError =
                error?.message ||
                (typeof error === 'string' ? error : 'Failed to initialize VSCode workbench');
        }
    }

    _disposeSfRegistrations() {
        disposeRegistrations(this, '_sfRegistrations');
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

    _registerSfFileNode(node) {
        return registerFileNode(this, node, '_sfRegistrations');
    }

    async _registerSfTextFile(path, text, options = {}) {
        return registerSfTextFile(this, path, text, options, encodeUtf8);
    }

    _registerSfLazyReadOnlyFile(path, read) {
        return registerSfLazyReadOnlyFile(this, path, read, encodeUtf8);
    }

    async _seedWorkspaceFiles() {
        await seedWorkspaceFiles(this, {
            getVscodeBundle,
            getIndexedDbFileSystem,
            encodeUtf8,
            workspaceRoot: this._workspaceRoot,
        });
    }

    get sfStatusText() {
        if (this.sfConnecting) return 'Connecting...';
        if (this.sfRefreshing) return 'Refreshing metadata...';
        if (this.sfConnected) {
            try {
                const url = new URL(this.sfInstanceUrl);
                const last = this.sfLastRefreshAt ? ` • refreshed ${this.sfLastRefreshAt}` : '';
                return `Connected: ${url.host}${last}`;
            } catch {
                return this.sfLastRefreshAt ? `Connected • refreshed ${this.sfLastRefreshAt}` : 'Connected';
            }
        }
        return 'Not connected';
    }

    get sfPanelChevron() {
        return this.sfPanelCollapsed ? '▸' : '▾';
    }

    get connectDisabled() {
        return this.sfConnecting
            || this.sfRefreshing
            || !this.sfInstanceUrl?.trim()
            || !this.sfAccessToken?.trim();
    }

    get refreshDisabled() {
        return this.sfConnecting || this.sfRefreshing || !this.sfConnected;
    }

    get disconnectDisabled() {
        return this.sfConnecting || this.sfRefreshing || !this.sfConnected;
    }

    handleInstanceUrlInput(event) {
        this.sfInstanceUrl = event?.target?.value ?? '';
    }

    handleAccessTokenInput(event) {
        this.sfAccessToken = event?.target?.value ?? '';
    }

    handleApiVersionInput(event) {
        this.sfApiVersion = event?.target?.value ?? '';
    }

    handleUseProxyToggle(event) {
        this.sfUseProxy = Boolean(event?.target?.checked);
        try {
            localStorage.setItem(STORAGE_KEYS.useProxy, String(this.sfUseProxy));
        } catch {
            // ignore
        }
    }

    handleProxyUrlInput(event) {
        this.sfProxyUrl = event?.target?.value ?? '';
        try {
            localStorage.setItem(STORAGE_KEYS.proxyUrl, this.sfProxyUrl);
        } catch {
            // ignore
        }
    }

    handlePanelToggle() {
        this.sfPanelCollapsed = !this.sfPanelCollapsed;
        try {
            localStorage.setItem(STORAGE_KEYS.panelCollapsed, String(this.sfPanelCollapsed));
        } catch {
            // ignore
        }
    }

    async handleConnect() {
        this.sfError = null;
        this.sfConnecting = true;
        this.sfConnected = false;
        try {
            const effectiveProxyUrl = this.sfUseProxy
                ? (this.sfProxyUrl?.trim() || window.location.origin)
                : undefined;
            const client = createToolingClient({
                instanceUrl: this.sfInstanceUrl,
                accessToken: this.sfAccessToken,
                apiVersion: this.sfApiVersion,
                proxyUrl: effectiveProxyUrl,
            });

            await client.ping();

            // Normalize fields after successful connect (e.g. ensure https:// and no trailing slash).
            this.sfInstanceUrl = client.instanceUrl;
            this.sfApiVersion = client.apiVersion;
            const userInfo = await this._fetchUserInfo({
                instanceUrl: client.instanceUrl,
                accessToken: this.sfAccessToken,
            });

            const activeConnection = {
                instanceUrl: client.instanceUrl,
                apiVersion: client.apiVersion,
                accessToken: this.sfAccessToken,
                authType: 'manual',
                sharedAlias: '',
                username: userInfo?.username || '',
                userId: userInfo?.userId || '',
                orgId: userInfo?.orgId || '',
                oauthConnectionId: '',
                workspaceRoot: this._workspaceRoot,
            };
            await persistActiveConnection(activeConnection);

            this.sfConnected = true;
            try {
                localStorage.setItem(STORAGE_KEYS.instanceUrl, this.sfInstanceUrl);
                localStorage.setItem(STORAGE_KEYS.apiVersion, this.sfApiVersion);
                localStorage.setItem(STORAGE_KEYS.useProxy, String(this.sfUseProxy));
                localStorage.setItem(STORAGE_KEYS.proxyUrl, this.sfProxyUrl);
                localStorage.setItem(STORAGE_KEYS.panelCollapsed, String(this.sfPanelCollapsed));
            } catch {
                // ignore
            }
            try {
                sessionStorage.setItem(STORAGE_KEYS.accessToken, this.sfAccessToken);
            } catch {
                // ignore
            }
        } catch (e) {
            this.sfError = e?.message || 'Failed to connect to Salesforce.';
            this.sfConnected = false;
        } finally {
            this.sfConnecting = false;
        }
    }

    async handleRefresh() {
        this.sfError = null;
        this.sfRefreshing = true;
        try {
            await this.refreshSalesforceMetadata();
            this.sfLastRefreshAt = new Date().toLocaleTimeString();
        } catch (e) {
            this.sfError = e?.message || 'Failed to refresh metadata.';
        } finally {
            this.sfRefreshing = false;
        }
    }

    async handleFetchMetadata() {
        this.sfError = null;
        this.sfRefreshing = true;
        try {
            if (!this.sfConnected) {
                await this.handleConnect();
            }
            if (!this.sfConnected) {
                throw new Error('Not connected.');
            }
            await this.refreshSalesforceMetadata();
            this.sfLastRefreshAt = new Date().toLocaleTimeString();
        } catch (e) {
            this.sfError = e?.message || 'Failed to fetch metadata.';
        } finally {
            this.sfRefreshing = false;
        }
    }

    handleDisconnect() {
        this.sfConnected = false;
        this.sfError = null;
        this.sfLastRefreshAt = null;
        this._workspaceRoot = this._normalizeWorkspaceRoot(this.workspaceBasePath);
        try {
            sessionStorage.removeItem(STORAGE_KEYS.accessToken);
        } catch {
            // ignore
        }
        void clearActiveConnection();
        this.sfAccessToken = '';
    }

    async refreshSalesforceMetadata() {
        await refreshSalesforceMetadataForApp(this, {
            createToolingClient,
            mapWithConcurrency,
            sanitizePathSegment,
            auraFilename,
        });
    }

    /* async _openReadme() {
        const vscodeBundle = await getVscodeBundle();
        const vscode = vscodeBundle.vscode;
        const createModelReference = vscodeBundle.createModelReference;

        const uri = vscode.Uri.file(getReadmeUri(this._workspaceRoot));

        // Ensure the file exists in the virtual FS and a VSCode model is created.
        const modelRef = await createModelReference(uri, README_TEXT);

        // Prefer showing the doc in the workbench editor.
        try {
            const doc = await vscode.workspace.openTextDocument(uri);
            if (vscode.window?.showTextDocument) {
                await vscode.window.showTextDocument(doc, { preview: false });
            }
        } catch (e) {
            // Fallback: at least ensure it exists and has content; the workbench may open it later.
            // eslint-disable-next-line no-console
            console.warn('Unable to show README via VSCode APIs, leaving it created:', e);
        }

        // Avoid leaking the model reference; the workbench/editor services keep their own refs.
        modelRef?.dispose?.();
    } */

    async _runDemoFeatures() {
        await runDemoFeatures(this, getVscodeBundle);
    }

}

