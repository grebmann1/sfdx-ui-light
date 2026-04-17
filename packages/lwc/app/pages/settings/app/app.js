import { track, wire } from 'lwc';
import ToolkitElement from 'core/toolkitElement';
import { isChromeExtension } from 'shared/utils';
import { GOOGLE_SIGNIN_SCOPES, GOOGLE_DRIVE_SCOPES } from 'agent/googleAuth';
import {
    cacheManager,
    CACHE_CONFIG,
    CACHE_SESSION_CONFIG,
    getSyncedSettingsInitializedFromCache,
    CACHE_ORG_DATA_TYPES,
    buildProviderConfigCacheRecord,
    getAiProviderFromConfig,
    resolveLlmProviderConfigMap,
    saveSingleExtensionConfigToCache,
} from 'shared/cacheManager';
import Toast from 'lightning/toast';
import LOGGER from 'shared/logger';
import { store, APPLICATION, connectStore } from 'core/store';
import { NavigationContext, navigate } from 'lwr/navigation';
import { METADATA as METADATA_UTILS } from 'shared/utils';

function buildEditableProviderConfigs(config) {
    const currentProviderConfigs = resolveLlmProviderConfigMap(config);
    return {
        ...currentProviderConfigs,
        openai: {
            ...currentProviderConfigs.openai,
            apiKey: config[CACHE_CONFIG.OPENAI_KEY.key],
            baseUrl: config[CACHE_CONFIG.OPENAI_URL.key],
        },
        anthropic: {
            ...currentProviderConfigs.anthropic,
            apiKey: config[CACHE_CONFIG.ANTHROPIC_KEY.key],
            baseUrl: config[CACHE_CONFIG.ANTHROPIC_URL.key],
        },
        gemini: {
            ...currentProviderConfigs.gemini,
            apiKey: config[CACHE_CONFIG.GEMINI_KEY.key],
            baseUrl: config[CACHE_CONFIG.GEMINI_URL.key],
        },
        mistral: {
            ...currentProviderConfigs.mistral,
            apiKey: config[CACHE_CONFIG.MISTRAL_KEY.key],
            baseUrl: config[CACHE_CONFIG.MISTRAL_URL.key],
        },
        grok: {
            ...currentProviderConfigs.grok,
            apiKey: config[CACHE_CONFIG.GROK_KEY.key],
            baseUrl: config[CACHE_CONFIG.GROK_URL.key],
        },
    };
}

export default class App extends ToolkitElement {
    static DEFAULT_METADATA_STORAGE_TYPES = [
        'ApexClass',
        'ApexTrigger',
        'ApexPage',
        'ApexComponent',
        'AuraDefinitionBundle',
        'LightningComponentBundle',
        'CustomObject',
        'CustomField',
        'PermissionSet',
        'Profile',
        'Flow',
        'StaticResource',
    ];

    //openAsPopup_checked = false;
    //openai_key;
    //openai_assistant_id;
    //experienceCloudLoginAsIncognito;

    // Cache
    //isCached_enabled;
    //isCached_profiles;
    //isCached_sobjects;

    // Extension Permissions
    hasIncognitoAccess = false;
    // Chrome Sync
    isChromeSyncSettingsEnabled = false;

    // Config
    @track config = {};
    @track originalConfig = {};
    // Session Config
    @track sessionConfig = {};
    @track originalSessionConfig = {};
    // Content Script Config
    @track contentScriptIncludePatterns = '';
    @track contentScriptExcludePatterns = '';

    @track activeTab;

    isOpenAIKeyVisible = false;
    isMistralKeyVisible = false;

    // Google Integration. `googleConnected` is derived from `googleUser.token` so the
    // UI can never claim "Connected" while the session token is missing.
    @track googleUser = null;
    @track googleDriveConnected = false;

    // New property to track API version validity
    _isApiVersionValid = true;

    // Cache Explorer
    @track showCacheExplorer = false;
    @track cacheEntries = [];
    @track cacheFilter = '';
    _cacheFilterTimer = null;

    @track metadataStorageTypeOptions = App.DEFAULT_METADATA_STORAGE_TYPES.map(type => ({
        label: type,
        value: type,
    }));

    @wire(NavigationContext)
    navContext;

    @wire(connectStore, { store })
    storeChange({ application }) {
        const settings = application?.settings || {};
        const session = settings[CACHE_CONFIG.GOOGLE_SESSION.key] || null;
        this.googleUser = session;
        this.googleDriveConnected =
            !!session?.token && !!(settings[CACHE_CONFIG.GOOGLE_DRIVE_CONNECTED.key]);
    }

    connectedCallback() {
        this.loadConfigFromCache();
        this.activeTab = this.isUserLoggedIn ? 'session' : 'ui';
        this.loadMetadataStorageTypeOptions();
    }

    /** Events **/

    chromeSyncSettings_change = async e => {
        this.isChromeSyncSettingsEnabled = e.currentTarget.checked;
        cacheManager.isChromeSyncSettingsEnabled = e.currentTarget.checked;
        if (cacheManager.isChromeSyncSettingsEnabled) {
            // reload the cache
            if (!(await getSyncedSettingsInitializedFromCache())) {
                LOGGER.log('Syncing settings', this.originalConfig);
                // If not initialized, we need to initialize the settings in the extension sync
                await cacheManager.saveConfig(this.originalConfig);
                // Save the session specific settings to the cache
                if (this.connector?.conn?.alias) {
                    await cacheManager.saveOrgData(
                        this.connector.conn.alias,
                        CACHE_ORG_DATA_TYPES.SESSION_SETTINGS,
                        this.sessionConfig
                    );
                }

                cacheManager.isChromeSyncSettingsInitialized = true;
            }
            this.loadConfigFromCache();
        }
    };

    // Config Input Field Change
    inputfield_change = e => {
        const inputField = e.currentTarget;
        const config = this.config;
        if (e.detail?.value !== undefined) {
            config[inputField.dataset.key] = e.detail.value;
        } else if (inputField.type === 'toggle') {
            config[inputField.dataset.key] = inputField.checked;
        } else {
            config[inputField.dataset.key] = inputField.value;
        }
        this.config = null;
        this.config = config;
    };

    // Session Input Field Change
    sessionInputfield_change = e => {
        const inputField = e.currentTarget;
        const sessionConfig = this.sessionConfig;
        sessionConfig[inputField.dataset.key] = inputField.value;
        this.sessionConfig = null;
        this.sessionConfig = sessionConfig;

        // Validate API Version input (and any other relevant fields)
        if (inputField.dataset.key === 'api_version') {
            this._isApiVersionValid = inputField.validity.valid;
        }
    };

    handleSaveClick = async e => {
        await this.saveToCache();
    };

    handleCancelClick = async e => {
        await this.loadConfigFromCache();
        //window.close();
    };

    handleClearAllClick = async e => {
        const configurationList = Object.values(CACHE_CONFIG);
        const config = {};
        Object.values(configurationList).forEach(item => {
            config[item.key] = item.value;
        });
        this.config = config;
        await this.saveToCache();
    };

    handleToggleVisibility = e => {
        e.preventDefault();
        let isVisible = e.currentTarget.dataset.isVisible !== 'true'; // toggle the visibility
        this.template.querySelector(
            'lightning-input[data-key="' + e.currentTarget.dataset.key + '"]'
        ).type = isVisible ? 'text' : 'password';
        // update the button
        e.currentTarget.dataset.isVisible = isVisible;
        e.currentTarget.iconName = isVisible ? 'utility:hide' : 'utility:preview';
    };

    handleResetPatternsClick = () => {
        // Ask background for the default patterns
        if (this.isChrome && chrome.runtime.sendMessage) {
            chrome.runtime.sendMessage({ action: 'getDefaultContentScriptPatterns' }, response => {
                if (response && response.includePatterns && response.excludePatterns) {
                    this.config.content_script_include_patterns =
                        response.includePatterns.join('\n');
                    this.config.content_script_exclude_patterns =
                        response.excludePatterns.join('\n');
                    this.config = { ...this.config };
                }
            });
        }
    };

    handleToggleQaMode = () => {
        const qaClientId = 'SfdcInternalQA/';
        const next = this.isQaModeEnabled ? CACHE_SESSION_CONFIG.CLIENT_ID.value : qaClientId;
        this.sessionConfig = { ...this.sessionConfig, client_id: next };
    };

    handleResetClientId = e => {
        this.sessionConfig.client_id = CACHE_SESSION_CONFIG.CLIENT_ID.value;
    };

    handleResetApiVersion = e => {
        this.sessionConfig.api_version = CACHE_SESSION_CONFIG.API_VERSION.value;
    };

    handleOpenFilesExplorer = () => {
        navigate(this.navContext, { type: 'application', state: { applicationName: 'files' } });
    };

    handleOpenCacheExplorer = async () => {
        this.showCacheExplorer = true;
        await this._loadCacheEntries();
    };

    handleCloseCacheExplorer = () => {
        this.showCacheExplorer = false;
    };

    handleCacheFilterChange = e => {
        const value = e.target.value || '';
        clearTimeout(this._cacheFilterTimer);
        this._cacheFilterTimer = setTimeout(() => {
            this.cacheFilter = value;
        }, 300);
    };

    handleCacheEntryDelete = async e => {
        const key = e.currentTarget.dataset.key;
        if (!key) return;
        if (this.isChrome) {
            await new Promise(resolve => chrome.storage.local.remove(key, resolve));
        } else {
            localStorage.removeItem(key);
        }
        await this._loadCacheEntries();
    };

    handleCacheRefresh = async () => {
        await this._loadCacheEntries();
    };

    handleCacheDownload = () => {
        const data = this.cacheEntries.reduce((acc, entry) => {
            try {
                acc[entry.key] = JSON.parse(entry.value);
            } catch {
                acc[entry.key] = entry.value;
            }
            return acc;
        }, {});
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sf-toolkit-cache-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    _loadCacheEntries = async () => {
        let entries = [];
        if (this.isChrome) {
            entries = await new Promise(resolve => {
                chrome.storage.local.get(null, items => {
                    resolve(
                        Object.entries(items).map(([key, value]) => ({
                            key,
                            value: JSON.stringify(value, null, 2),
                        }))
                    );
                });
            });
        } else {
            entries = Object.keys(localStorage).map(key => ({
                key,
                value: localStorage.getItem(key),
            }));
        }
        this.cacheEntries = entries.sort((a, b) => a.key.localeCompare(b.key));
    };

    get filteredCacheEntries() {
        const filter = (this.cacheFilter || '').toLowerCase();
        const entries = this.cacheEntries || [];
        if (!filter) return entries;
        return entries.filter(
            e =>
                e.key.toLowerCase().includes(filter) ||
                (e.value && e.value.toLowerCase().includes(filter))
        );
    }

    get cacheExplorerCount() {
        return this.filteredCacheEntries.length;
    }

    handleConnectGoogle = async () => {
        if (!this.isChrome || typeof chrome?.identity?.getAuthToken !== 'function') {
            Toast.show({ label: 'Google sign-in is only available in the Chrome extension.', variant: 'error' });
            return;
        }
        try {
            const oauthToken = await new Promise((resolve, reject) => {
                chrome.identity.getAuthToken({ interactive: true, scopes: GOOGLE_SIGNIN_SCOPES }, t => {
                    if (chrome.runtime.lastError || !t) {
                        reject(new Error(chrome.runtime.lastError?.message || 'Authorization failed'));
                    } else {
                        resolve(t);
                    }
                });
            });

            // Verify with the backend to get a session JWT — same flow as the AI panel's
            // googleAuth component — so both entry points share the same stored token format.
            let serverUrl = '';
            try { serverUrl = (process.env.WORKBENCH_BASE_URL || '').replace(/\/+$/, ''); } catch {}
            serverUrl = serverUrl || window.location.origin;

            const resp = await fetch(`${serverUrl}/google/oauth/verify-token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accessToken: oauthToken }),
            });
            if (!resp.ok) throw new Error(`Backend verification failed (${resp.status})`);
            const data = await resp.json();

            const session = { token: data.token, email: data.email, name: data.name, picture: data.picture };
            await saveSingleExtensionConfigToCache(CACHE_CONFIG.GOOGLE_SESSION.key, session);
            store.dispatch(APPLICATION.reduxSlice.actions.updateSettings({
                [CACHE_CONFIG.GOOGLE_SESSION.key]: session,
            }));
            Toast.show({ label: `Connected as ${data.name || data.email}`, variant: 'success' });
        } catch (err) {
            LOGGER.error('Google OAuth error', err);
            Toast.show({ label: `Failed to connect: ${err.message}`, variant: 'error' });
        }
    };

    handleDisconnectGoogle = async () => {
        if (!this.isChrome || typeof chrome?.identity?.getAuthToken !== 'function') return;
        try {
            const token = await new Promise(resolve => {
                chrome.identity.getAuthToken({ interactive: false, scopes: GOOGLE_SIGNIN_SCOPES }, t => resolve(t || null));
            });
            if (token) {
                await new Promise(resolve => chrome.identity.removeCachedAuthToken({ token }, resolve));
            }
            await saveSingleExtensionConfigToCache(CACHE_CONFIG.GOOGLE_SESSION.key, null);
            await saveSingleExtensionConfigToCache(CACHE_CONFIG.GOOGLE_DRIVE_CONNECTED.key, false);
            store.dispatch(APPLICATION.reduxSlice.actions.updateSettings({
                [CACHE_CONFIG.GOOGLE_SESSION.key]: null,
                [CACHE_CONFIG.GOOGLE_DRIVE_CONNECTED.key]: false,
            }));
            Toast.show({ label: 'Disconnected from Google', variant: 'success' });
        } catch (err) {
            LOGGER.error('Google disconnect error', err);
            Toast.show({ label: `Failed to disconnect: ${err.message}`, variant: 'error' });
        }
    };

    handleConnectGoogleDrive = async () => {
        if (!this.isChrome || typeof chrome?.identity?.getAuthToken !== 'function') {
            Toast.show({ label: 'Google Drive is only available in the Chrome extension.', variant: 'error' });
            return;
        }
        try {
            await new Promise((resolve, reject) => {
                chrome.identity.getAuthToken({ interactive: true, scopes: GOOGLE_DRIVE_SCOPES }, token => {
                    if (chrome.runtime.lastError || !token) {
                        reject(new Error(chrome.runtime.lastError?.message || 'Drive authorization failed'));
                    } else {
                        resolve(token);
                    }
                });
            });
            await saveSingleExtensionConfigToCache(CACHE_CONFIG.GOOGLE_DRIVE_CONNECTED.key, true);
            store.dispatch(APPLICATION.reduxSlice.actions.updateSettings({
                [CACHE_CONFIG.GOOGLE_DRIVE_CONNECTED.key]: true,
            }));
            Toast.show({ label: 'Google Drive & Sheets connected', variant: 'success' });
        } catch (err) {
            LOGGER.error('Google Drive OAuth error', err);
            Toast.show({ label: `Failed to connect Drive: ${err.message}`, variant: 'error' });
        }
    };

    handleDisconnectGoogleDrive = async () => {
        await saveSingleExtensionConfigToCache(CACHE_CONFIG.GOOGLE_DRIVE_CONNECTED.key, false);
        store.dispatch(APPLICATION.reduxSlice.actions.updateSettings({
            [CACHE_CONFIG.GOOGLE_DRIVE_CONNECTED.key]: false,
        }));
        Toast.show({ label: 'Google Drive & Sheets disconnected', variant: 'success' });
    };

    get googleConnected() {
        return !!this.googleUser?.token;
    }

    get googleUserDisplayName() {
        return this.googleUser?.name || this.googleUser?.email || '';
    }

    get googleUserEmail() {
        return this.googleUser?.email || '';
    }

    get googleUserPicture() {
        return this.googleUser?.picture || '';
    }

    get isDriveConnectDisabled() {
        return !this.googleConnected;
    }

    /** Methods **/

    sendToggleOverlayMessage = checked => {
        chrome.runtime.sendMessage({
            action: 'toggleOverlay',
            enabled: checked,
        });
    };

    saveToCache = async () => {
        const configurationList = Object.values(CACHE_CONFIG);
        const config = {};
        Object.values(configurationList).forEach(item => {
            config[item.key] = this.config[item.key];
        });
        const providerConfigs = buildEditableProviderConfigs(config);
        Object.assign(config, buildProviderConfigCacheRecord(providerConfigs));
        // if the overlayEnabled is changed, send a message to the background script
        if (
            this.config[CACHE_CONFIG.OVERLAY_ENABLED.key] !==
            this.originalConfig[CACHE_CONFIG.OVERLAY_ENABLED.key]
        ) {
            LOGGER.log('overlayEnabled changed', this.config[CACHE_CONFIG.OVERLAY_ENABLED.key]);
            this.sendToggleOverlayMessage(this.config[CACHE_CONFIG.OVERLAY_ENABLED.key]);
        }
        // Persist to chrome.storage / localStorage then mirror into the Redux store so
        // any component subscribed via storeChange picks up the new values immediately.
        await cacheManager.saveConfig(config);
        store.dispatch(APPLICATION.reduxSlice.actions.updateSettings(config));
        store.dispatch(APPLICATION.reduxSlice.actions.updateProviderConfigs({ providerConfigs }));
        store.dispatch(
            APPLICATION.reduxSlice.actions.updateAiProvider({
                aiProvider: getAiProviderFromConfig(config),
            })
        );
        // we update the originalConfig
        this.originalConfig = { ...config };

        // Save the session specific settings to the cache
        if (this.isUserLoggedIn) {
            const _oldOriginalSessionConfig = Object.assign({}, this.originalSessionConfig);
            await this.saveSessionConfigToCache();

            // force the connector to reload
            const apiVersionChanged =
                _oldOriginalSessionConfig.api_version !== this.originalSessionConfig.api_version;
            const clientIdChanged =
                _oldOriginalSessionConfig.client_id !== this.originalSessionConfig.client_id;
            const hasChanged = apiVersionChanged || clientIdChanged;
            if (apiVersionChanged) {
                LOGGER.log('api_version changed', this.originalSessionConfig.api_version);
                this.connector.conn.version = this.originalSessionConfig.api_version;
            }
            if (clientIdChanged) {
                LOGGER.log('client_id changed', this.originalSessionConfig.client_id);
                this.connector.conn._callOptions.client = this.originalSessionConfig.client_id;
            }
            if (hasChanged) {
                store.dispatch(
                    APPLICATION.reduxSlice.actions.updateConnector({ connector: this.connector })
                );
            }
        }

        Toast.show({
            label: 'Configuration Saved',
            variant: 'success',
        });
    };

    saveSessionConfigToCache = async () => {
        const sessionConfigurationList = Object.values(CACHE_SESSION_CONFIG);
        const sessionConfig = {};
        Object.values(sessionConfigurationList).forEach(item => {
            sessionConfig[item.key] = this.sessionConfig[item.key];
        });
        await cacheManager.saveOrgData(
            this.connector.conn.alias,
            CACHE_ORG_DATA_TYPES.SESSION_SETTINGS,
            sessionConfig
        );
        // we update the originalSessionConfig
        this.originalSessionConfig = { ...sessionConfig };
    };

    loadConfigFromCache = async () => {
        // Use the new CacheManager to load config
        const cachedConfiguration = await cacheManager.loadConfig(
            Object.values(CACHE_CONFIG).map(x => x.key)
        );
        LOGGER.log('cachedConfiguration', cachedConfiguration);

        const configurationList = Object.values(CACHE_CONFIG);
        const config = {};
        Object.values(configurationList).forEach(item => {
            const cached = cachedConfiguration[item.key];
            config[item.key] = cached !== undefined && cached !== null ? cached : item.defaultValue;
        });
        const providerConfigs = resolveLlmProviderConfigMap(cachedConfiguration);
        Object.assign(config, buildProviderConfigCacheRecord(providerConfigs));
        config.ai_provider = getAiProviderFromConfig(cachedConfiguration);
        if (!Array.isArray(config.metadata_storage_types)) {
            config.metadata_storage_types = [];
        }
        this.config = config;
        this.originalConfig = { ...config };

        // Load the session specific settings from the cache

        if (this.isUserLoggedIn) {
            const sessionCachedConfiguration =
                (await cacheManager.loadOrgData(
                    this.connector.conn.alias,
                    CACHE_ORG_DATA_TYPES.SESSION_SETTINGS
                )) || {};
            const sessionConfigurationList = Object.values(CACHE_SESSION_CONFIG);
            const sessionConfig = {};
            Object.values(sessionConfigurationList).forEach(item => {
                sessionConfig[item.key] = sessionCachedConfiguration[item.key]; // || item.value;
            });

            this.sessionConfig = sessionConfig;
            this.originalSessionConfig = { ...sessionConfig };
        }

        // Chrome Only
        if (this.isChrome) {
            this.hasIncognitoAccess = await chrome.extension.isAllowedIncognitoAccess();
            this.isChromeSyncSettingsEnabled = cacheManager.isChromeSyncSettingsEnabled; // Manually added to the cacheManager
        }

        // Google session state is now driven by application.settings via storeChange;
        // no manual assignment needed here.
    };

    loadMetadataStorageTypeOptions = async () => {
        if (
            !this.isUserLoggedIn ||
            !this.connector?.conn?.metadata ||
            !this.connector?.conn?.version
        ) {
            return;
        }

        try {
            const result = await this.connector.conn.metadata.describe(this.connector.conn.version);
            const metadataObjects = Array.isArray(result?.metadataObjects)
                ? result.metadataObjects
                : [];
            const runtimeTypes = metadataObjects
                .filter(item => !METADATA_UTILS.METADATA_EXCLUDE_LIST.includes(item.xmlName))
                .map(item => item.xmlName);
            const exceptionTypes = METADATA_UTILS.METADATA_EXCEPTION_LIST.filter(
                item => item.isSearchable
            ).map(item => item.name);
            const values = Array.from(
                new Set([...App.DEFAULT_METADATA_STORAGE_TYPES, ...runtimeTypes, ...exceptionTypes])
            ).sort((a, b) => a.localeCompare(b));

            this.metadataStorageTypeOptions = values.map(type => ({ label: type, value: type }));
        } catch (error) {
            LOGGER.warn('Unable to load metadata type options for settings', error);
        }
    };

    /** Getters */

    get openaiKeyInputType() {
        return this.isOpenAIKeyVisible ? 'text' : 'password';
    }

    get hasChanged() {
        return (
            JSON.stringify(this.config) != JSON.stringify(this.originalConfig) ||
            JSON.stringify(this.sessionConfig) != JSON.stringify(this.originalSessionConfig)
        );
    }

    get pageClass() {
        //Overwrite
        return super.pageClass + ' slds-p-around_small';
    }

    get isChrome() {
        return isChromeExtension();
    }

    get isShortcutDisabled() {
        return !this.config[CACHE_CONFIG.SHORTCUT_INJECTION_ENABLED.key];
    }

    get isMetadataStorageTypeSelectionDisabled() {
        return !this.config[CACHE_CONFIG.METADATA_STORAGE_ENABLED.key];
    }

    get isCancelDisabled() {
        return !this.hasChanged;
    }

    get isSaveDisabled() {
        // Disable if config hasn't changed or if API version is invalid
        if (this._isApiVersionValid === false) return true;
        return !this.hasChanged;
    }

    get isFullIncognitoAccess() {
        return this.hasIncognitoAccess;
    }

    get isQaModeEnabled() {
        return this.sessionConfig?.client_id === 'SfdcInternalQA/';
    }

    get qaModeButtonVariant() {
        return this.isQaModeEnabled ? 'brand' : 'neutral';
    }

    get userName() {
        return this.connector?.configuration?.username;
    }

    get instanceUrl() {
        return this.connector?.conn?.instanceUrl || this.connector?.configuration?.instanceUrl || '';
    }
}
