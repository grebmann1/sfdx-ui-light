import { LightningElement, track, api, wire } from 'lwc';
import LightningAlert from 'lightning/alert';
import {
    guid,
    isNotUndefinedOrNull,
    classSet,
    isUndefinedOrNull,
    isEmpty,
    isElectronApp,
    isChromeExtension,
} from 'shared/utils';
import {
    cacheManager,
    getOpenAIKeyFromCache,
    CACHE_CONFIG,
    loadExtensionConfigFromCache,
} from 'shared/cacheManager';

import { credentialStrategies, OAUTH_TYPES, getConfiguration } from 'connection/utils';
import { NavigationContext, CurrentPageReference, navigate } from 'lwr/navigation';
import { basicStore } from 'shared/cacheManager';
import { handleRedirect } from './utils';
import LOGGER from 'shared/logger';
/** Apps  **/
import { APP_LIST } from './modules';
import SessionExpiredModal, { RESULT as SESSION_EXPIRED_RESULT } from 'ui/sessionExpiredModal';

/** Store **/
import { store as legacyStore } from 'shared/store';
import { connectStore, store, DOCUMENT, APPLICATION } from 'core/store';

import hotkeys from 'hotkeys-js';

const LIMITED = 'limited';

export * as CONFIG from './modules';

export default class App extends LightningElement {
    @wire(NavigationContext)
    navContext;

    @api mode;
    @api redirectUrl;
    // for Extension (Limited Mode)
    @api sessionId;
    @api serverUrl;
    // for Electron (Limited Mode)
    @api alias;

    version;
    isApplicationTabVisible = false;
    isSalesforceCliInstalled = false;
    isJavaCliInstalled = false;
    isCommandCheckFinished = false;
    isMenuHidden = false;
    isMenuCollapsed = false;
    pageHasLoaded = false;
    targetPage;
    _isLoggedIn = false;

    // Full App Loading
    _isFullAppLoading = false;
    _fullAppLoadingMessage;

    @track applications = [];

    currentApplicationId;

    // To manage expired session
    sessionHasExpiredIsDisplayed = false;

    // Port to communicate with background
    _backgroundPort = null;

    // Agent View
    @api isAgentChatExpanded = false;

    @wire(connectStore, { store: legacyStore })
    applicationChange({ application }) {
        // Open Application
        if (application.isOpen) {
            const { target } = application;
            this.handleApplicationSelection(target);
        }

        // Toggle Menu
        if (isNotUndefinedOrNull(application.isMenuDisplayed)) {
            this.isMenuHidden = !application.isMenuDisplayed;
        } else if (isNotUndefinedOrNull(application.isMenuExpanded)) {
            this.isMenuCollapsed = !application.isMenuExpanded;
        }

        // Toggle Agent Chat
        if (isNotUndefinedOrNull(application.isAgentChatExpanded)) {
            this.isAgentChatExpanded = application.isAgentChatExpanded;
        }

        // Redirect
        if (application.redirectTo) {
            this.handleRedirection(application);
        }
    }

    @wire(connectStore, { store })
    storeChange({ application }) {
        this._isFullAppLoading = application.isLoading;
        this._fullAppLoadingMessage = application.isLoadingMessage;

        if (this._isLoggedIn != application.isLoggedIn) {
            this._isLoggedIn = application.isLoggedIn;
            if (application.isLoggedIn) {
                this.handleLogin(application.connector);
            } else if (!application.isLoggedIn) {
                this.handleLogout();
            }
        }

        if (application.sessionHasExpired) {
            this.redirectAfterExpiration();
        }
    }

    @wire(CurrentPageReference)
    handleNavigation(pageRef) {
        this.targetPage = pageRef;
        if (!this.pageHasLoaded) return;
        const { type, state } = pageRef;
        switch (type) {
            case 'home':
            case 'application':
                const formattedApplicationName = (state.applicationName || '').toLowerCase();
                const target = APP_LIST.find(x => x.path === formattedApplicationName);
                if (isNotUndefinedOrNull(target)) {
                    this.handleApplicationSelection(target.name);
                } else {
                    this.handleApplicationSelection('home/app');
                }
                break;
        }
    }

    connectedCallback() {
        this.init();
        //this.checkForInjected();
        // Load keys from cache

        this.loadFromCache();
        this.initShortcuts();
        //this.test();
    }

    init = async () => {
        await this.initCacheStorage();
        if (isElectronApp()) {
            await this.initElectron();
            this.isCommandCheckFinished = true;
        }
        this.loadVersion();
        this.initMode();
        this.initDragDrop();
    };

    initCacheStorage = async () => {
        if (isChromeExtension()) return;
        LOGGER.debug('initCacheStorage');
        window.defaultStore = await basicStore('local');
        window.settingsStore = await basicStore('session');
    };

    /** Events */

    handleLogin = async connector => {
        if (isUndefinedOrNull(connector)) {
            store.dispatch(APPLICATION.reduxSlice.actions.stopLoading());
            return;
        }

        // Reset first
        this.applications = this.applications.filter(x => x.name == 'home/app');

        // Add new module
        if (this.applications.filter(x => x.name == 'org/app').length == 0) {
            this.openSpecificModule('org/app');
        }
        store.dispatch(APPLICATION.reduxSlice.actions.stopLoading());

        // Load Cached data
        store.dispatch(
            DOCUMENT.reduxSlices.RECENT.actions.loadFromStorage({
                alias: this.connector.configuration.alias,
            })
        );

        // Connect to background
        this.connectToBackgroundWithIdentity();
    };

    handleLogout = () => {
        // Reset Applications
        this.applications = this.applications.filter(x => x.name == 'home/app');
        navigate(this.navContext, { type: 'application', state: { applicationName: 'home' } });
        // Disconnect from background
        this.disconnectFromBackground();
    };

    handleLogoutClick = async e => {
        e.preventDefault(); // currentApplication

        await store.dispatch(APPLICATION.reduxSlice.actions.logout());

        this.initMode();
        //location.reload();
    };

    handleTabChange = e => {
        let applicationId = e.detail.id;
        this.loadSpecificTab(applicationId);
    };

    handleTabDelete = e => {
        this.applications = this.applications.filter(x => x.id != e.detail.id);
    };

    handleNewApp = async e => {
        this.loadModule(e.detail);
    };

    handleRedirection = async application => {
        let url = application.redirectTo || '';
        if (url.startsWith('sftoolkit:')) {
            /* Inner Navigation */
            const navigationConfig = url.replace('sftoolkit:', '');
            navigate(this.navContext, JSON.parse(navigationConfig));
            return;
        }

        if (this.isUserLoggedIn && !url.startsWith('http')) {
            // to force refresh in case it's not valid anymore :
            await this.connector.conn.identity();
            url = `${this.connector.frontDoorUrl}&retURL=${encodeURI(url)}`;
        }

        if (isElectronApp()) {
            window.location = url;
        } else {
            window.open(url, '_blank');
        }
    };

    handleApplicationSelection = async target => {
        if (this.applications.filter(x => x.name === target).length == 0) {
            this.loadModule(target);
        } else {
            const existingAppId = this.applications.find(x => x.name === target).id;
            this.loadSpecificTab(existingAppId);
        }
    };

    /** Methods  */

    loadFromCache = async () => {
        const configuration = await loadExtensionConfigFromCache([
            CACHE_CONFIG.UI_IS_APPLICATION_TAB_VISIBLE.key,
            CACHE_CONFIG.MISTRAL_KEY.key,
            CACHE_CONFIG.AI_PROVIDER.key,
            CACHE_CONFIG.OPENAI_KEY.key,
            CACHE_CONFIG.OPENAI_URL.key,
        ]);

        this.isApplicationTabVisible = configuration[CACHE_CONFIG.UI_IS_APPLICATION_TAB_VISIBLE.key];

        // Handle LLM keys and provider
        const openaiKey = configuration[CACHE_CONFIG.OPENAI_KEY.key];
        const openaiUrl = configuration[CACHE_CONFIG.OPENAI_URL.key];
        const mistralKey = configuration[CACHE_CONFIG.MISTRAL_KEY.key];
        const aiProvider = configuration[CACHE_CONFIG.AI_PROVIDER.key];
        LOGGER.debug('loadFromCache - openaiKey',openaiKey);
        LOGGER.debug('loadFromCache - openaiUrl',openaiUrl);
        LOGGER.debug('loadFromCache - mistralKey',mistralKey);
        LOGGER.debug('loadFromCache - aiProvider',aiProvider);
        if(openaiKey) {
            store.dispatch(APPLICATION.reduxSlice.actions.updateOpenAIKey({ openaiKey,openaiUrl }));
        }
        if(mistralKey) {
            store.dispatch(APPLICATION.reduxSlice.actions.updateMistralKey({ mistralKey }));
        }
        if(aiProvider) {
            store.dispatch(APPLICATION.reduxSlice.actions.updateAiProvider({ aiProvider }));
        }

        if(isEmpty(openaiKey)) {
            this.checkForInjected();
        }
    };

    redirectAfterExpiration = async () => {
        if (this.sessionHasExpiredIsDisplayed) return;

        this.sessionHasExpiredIsDisplayed = true;
        //this.sessionHasExpired = false;
        //store.dispatch(APPLICATION.reduxSlice.actions.sessionExpired({sessionHasExpired:false}));
        const credentialType = this.connector?.configuration?.credentialType;
        const result = await SessionExpiredModal.open({
            size: 'small',
            label: 'Session Expired',
            message: 'Session has expired. \n Please consider adding it to your list of orgs.',
            isAutoReconnectEnabled: isChromeExtension() && credentialType === OAUTH_TYPES.SESSION,
        });
        if(result === SESSION_EXPIRED_RESULT.AUTO_RECONNECT){
            await this.handleAutoReconnect();
        }else{
            await store.dispatch(APPLICATION.reduxSlice.actions.logout());
        }
        this.sessionHasExpiredIsDisplayed = false;
    };

    handleAutoReconnect = async () => {
        const configuration = this.connector?.configuration;
        if (configuration?.credentialType === OAUTH_TYPES.SESSION && isChromeExtension()) {
            try {
                const alias = configuration?.alias;
                const instanceUrl = configuration?.instanceUrl;
                const result = await new Promise(resolve => {
                    try {
                        chrome.runtime.sendMessage(
                            {
                                action: 'findExistingSession',
                                alias,
                                instanceUrl,
                            },
                            response => resolve(response)
                        );
                    } catch (e) {
                        resolve(undefined);
                    }
                });

                if (result && result.sessionId && result.serverUrl) {
                    const connector = await credentialStrategies.SESSION.connect({
                        sessionId: result.sessionId,
                        serverUrl: result.serverUrl,
                    });
                    store.dispatch(APPLICATION.reduxSlice.actions.login({ connector }));
                } else {
                    await LightningAlert.open({
                        message:
                            'No valid session found in existing tabs for this org. Please log in again before clicking on the auto reconnect button.',
                        theme: 'warning',
                        label: 'Auto Reconnect',
                    });
                    this.redirectAfterExpiration();
                }
            } catch (e) {
                LOGGER.error('Auto reconnect failed', e);
                await LightningAlert.open({
                    message: 'Auto reconnect failed. Please try logging in again.',
                    theme: 'error',
                    label: 'Auto Reconnect',
                });
                this.redirectAfterExpiration();
            }
        }
    };

    openSpecificModule = async target => {
        this.handleApplicationSelection(target);
    };

    loadVersion = async () => {
        let url = isChromeExtension() ? '/manifest.json' : '/version';
        const data = await (await fetch(url)).json();
        this.version = `v${data.version || '1.0.0'}`;
    };

    initElectron = async () => {
        try {
            let { error, result } = await window.electron.invoke('util-checkCommands');
            if (error) {
                throw decodeError(error);
            }

            this.isSalesforceCliInstalled = result.sfdx;
            this.isJavaCliInstalled = result.java;
        } catch (error) {
            this.isSalesforceCliInstalled = false;
            this.isJavaCliInstalled = false;
        }
    };

    initDragDrop = () => {
        window.addEventListener(
            'dragover',
            function (e) {
                e.preventDefault();
            },
            false
        );
        window.addEventListener(
            'drop',
            function (e) {
                e.preventDefault();
            },
            false
        );
    };

    initMode = async () => {
        window.isLimitedMode = this.isLimitedMode; // To hide

        this.applications = [];
        this.applicationId = null;
        try{
            LOGGER.log('Init Mode -->',this.isLimitedMode);
            if (this.isLimitedMode) {
                await this.load_limitedMode();
            } else {
                await this.load_fullMode();
            }
        }catch(e){  
            LOGGER.error('Init Mode Error -->',e);
            this.pageHasLoaded = true;
            handleError(e, 'Init Mode Error');
        }
    };

    loadSpecificTab = applicationId => {
        this.currentApplicationId = applicationId;
        let _applications = this.applicationPreFormatted;
        _applications.forEach(x => {
            if (x.id == applicationId) {
                x.isActive = true;
                x.class = 'slds-context-bar__item slds-is-active';
                x.classVisibility = 'slds-show slds-full-height';
                x.attributes.isActive = true;
                // Update the store
                store.dispatch(
                    APPLICATION.reduxSlice.actions.updateCurrentApplication({
                        application: x.name,
                    })
                );
            } else {
                x.attributes.isActive = false;
            }
        });
        this.applications = _applications;
    };

    /** Extension & Electron Org Window  **/
    load_limitedMode = async () => {
        try {
            let connector;
            LOGGER.debug('load_limitedMode - alias', this.alias);
            LOGGER.debug('load_limitedMode - sessionId', this.sessionId);
            LOGGER.debug('load_limitedMode - serverUrl', this.serverUrl);
            if (isNotUndefinedOrNull(this.alias)) {
                LOGGER.debug('load_limitedMode - OAUTH');
                let configuration = await getConfiguration(this.alias);
                if (configuration && configuration.credentialType === OAUTH_TYPES.OAUTH) {
                    connector = await credentialStrategies.OAUTH.connect({ alias: this.alias });
                } else if (configuration && configuration.credentialType === OAUTH_TYPES.USERNAME) {
                    connector = await credentialStrategies.USERNAME.connect({
                        username: configuration.username,
                        password: configuration.password,
                        loginUrl: configuration.instanceUrl,
                        alias: this.alias,
                    });
                } else {
                    connector = null;
                    throw new Error('No configuration found');
                }
            } else if (isNotUndefinedOrNull(this.sessionId) && isNotUndefinedOrNull(this.serverUrl)) {
                LOGGER.debug('load_limitedMode - SESSION');
                connector = await credentialStrategies.SESSION.connect({
                    sessionId: this.sessionId,
                    serverUrl: this.serverUrl,
                });
                // Reset after to prevent looping
                this.sessionId = null;
                this.serverUrl = null;
            } else {
                LOGGER.debug('load_limitedMode - NO CREDENTIALS');
                connector = null;
                throw new Error('No credentials found');
            }

            store.dispatch(APPLICATION.reduxSlice.actions.login({ connector }));

            if(isElectronApp()){
                LOGGER.debug('load_limitedMode - ELECTRON - channel : ',window.electron.getChannel());
                window.electron.send(window.electron.getChannel(),{
                    isLoggedIn:true,
                    username:connector.configuration.username,
                });
            }

            if (this.redirectUrl) {
                // This method use LWR redirection or window.location based on the url !
                handleRedirect(this.navContext, this.redirectUrl);
            } else {
                navigate(this.navContext, {
                    type: 'application',
                    state: { applicationName: 'org' },
                }); // org is the default
            }
        } catch (e) {
            LOGGER.error(e);
            if(isElectronApp()){
                LOGGER.debug('load_limitedMode - ELECTRON - channel : ',window.electron.getChannel());
                window.electron.send(window.electron.getChannel(),{
                    isLoggedIn:false,
                    message:e.message,
                });
            }
            await LightningAlert.open({
                message: e.message, //+'\n You might need to remove and OAuth again.',
                theme: 'error', // this is the header text
                label: 'Error!', // this is the header text
            });
        }

        // Default Mode
        /*await this.loadModule({
            component:'extension/app',
            name:"Apps",
            isDeletable:false,
        });*/

        // Should be loaded via login !
        //this.openSpecificModule('org/app');
        //this.openSpecificModule('code/app');
        this.pageHasLoaded = true;
        if (this.targetPage) {
            this.handleNavigation(this.targetPage);
        }
    };

    /** Website & Electron **/
    load_fullMode = async () => {
        if (isNotUndefinedOrNull(this.sessionId) && isNotUndefinedOrNull(this.serverUrl)) {
            let connector = await credentialStrategies.SESSION.connect({
                sessionId: this.sessionId,
                serverUrl: this.serverUrl,
            });
            // Reset after to prevent looping
            this.sessionId = null;
            this.serverUrl = null;
            store.dispatch(APPLICATION.reduxSlice.actions.login({ connector }));
        } else {
            // New logic inspired by old getExistingSession
            const currentConnectionRaw = sessionStorage.getItem('currentConnection');
            if (currentConnectionRaw) {
                try {
                    const settings = JSON.parse(currentConnectionRaw);
                    settings.logLevel = null;
                    let connector;
                    if (settings.sessionId && settings.serverUrl) {
                        // For Web/Chrome, use SESSION strategy
                        connector = await credentialStrategies.SESSION.connect({
                            sessionId: settings.sessionId,
                            serverUrl: settings.serverUrl,
                        });
                    } else if (
                        settings.credentialType &&
                        credentialStrategies[settings.credentialType || 'OAUTH']
                    ) {
                        // Fallback: use credentialType if present
                        connector = await credentialStrategies[settings.credentialType].connect(settings);
                    }
                    if (connector) {
                        store.dispatch(APPLICATION.reduxSlice.actions.login({ connector }));
                    }
                    // Optionally: handle result (e.g., update store, etc.)
                } catch (e) {
                    // Optionally: log or show error
                    LOGGER.error('load_fullMode Error -->',e);
                }
            }
            // If no session, do nothing (or optionally prompt user)
        }

        if (this.redirectUrl) {
            // This method use LWR redirection or window.location based on the url !
            handleRedirect(this.navContext, this.redirectUrl);
        } else {
            // Default Mode
            this.loadModule('home/app', true);
        }

        this.pageHasLoaded = true;
        if (this.targetPage) {
            this.handleNavigation(this.targetPage);
        }
    };

    /** Getters */

    get connector() {
        return store.getState()?.application?.connector;
    }

    get isFullAppLoading() {
        return this._isFullAppLoading || !this.pageHasLoaded;
    }

    get fullAppLoadingMessageFormatted() {
        return this._fullAppLoadingMessage || 'Loading Page ...';
    }

    get isSFDXMissing() {
        return isElectronApp() && !this.isSalesforceCliInstalled && this.isCommandCheckFinished;
    }

    get isLimitedMode() {
        return this.mode === LIMITED;
    }

    get dynamicAppContainerClass() {
        return this.isUserLoggedIn
            ? 'app-container-logged-in slds-full-height'
            : 'app-container slds-full-height';
    }

    get isLogoutDisplayed() {
        return !this.isLimitedMode;
    }

    get formattedAlias() {
        if (isUndefinedOrNull(this.connector?.configuration?.alias)) {
            return 'No Alias : ';
        } else if (
            this.connector?.configuration?.username == this.connector?.configuration?.alias
        ) {
            return '';
        } else {
            return `${this.connector.configuration?.alias} : `;
        }
    }

    get loggedInMessage() {
        return `Logged in as ${this.connector?.configuration?.userInfo?.display_name || 'User'} (${
            this.formattedAlias
        }${this.connector?.configuration?.username}). `;
    }

    get isUserLoggedIn() {
        return this._isLoggedIn;
    }

    get menuClass() {
        return classSet('l-cell-content-size home__navigation slds-show_small slds-is-relative')
            .add({
                'slds-hide': this.isMenuHidden,
                'slds-menu-collapsed': this.isMenuCollapsed,
            })
            .toString();
    }

    get applicationPreFormatted() {
        return this.applications.map(x => ({
            ...x,
            ...{
                isActive: false,
                class: 'slds-context-bar__item',
                classVisibility: 'slds-hide slds-full-height',
            },
        }));
    }

    get isElectronApp() {
        return isElectronApp();
    }

    /** Dynamic Loading */

    loadModule = (target, isFirst = false) => {
        const settings = APP_LIST.find(x => x.name === target);

        if (!settings) {
            LOGGER.warn(`Unknown app type: ${target}`);
            // Run Manual Mode
        } else {
            const application = {
                name: settings.name,
                constructor: settings.module,
                path: settings.path,
                id: guid(),
                label: settings.label,
                isActive: true,
                class: 'slds-context-bar__item slds-is-active',
                classVisibility: 'slds-show slds-full-height',
                isFullHeight: settings.isFullHeight,
                isDeletable: settings.isDeletable,
                requireConnection: !settings.isOfflineAvailable,
                isTabVisible: settings.isTabVisible,
                attributes: {
                    applicationName: settings.name,
                    //connector:this.connector
                    isActive: true,
                },
            };
            // Store current Application in the store
            store.dispatch(
                APPLICATION.reduxSlice.actions.updateCurrentApplication({
                    application: settings.name,
                })
            );
            let _applications = this.applicationPreFormatted;
            if (isFirst) {
                _applications.unshift(application);
            } else {
                _applications.push(application);
            }

            this.applications = _applications;
            this.currentApplicationId = application.id;
        }
    };

    /** Background  Communication **/

    connectToBackgroundWithIdentity() {
        if (isChromeExtension()) {
            if (!this._backgroundPort) {
                this._backgroundPort = chrome.runtime.connect({ name: 'sf-toolkit-instance' });
                const connector = this.connector;
                if (connector && connector.configuration) {
                    this._backgroundPort.postMessage({
                        action: 'registerInstance',
                        serverUrl: connector.conn.instanceUrl,
                        alias: connector.configuration.alias,
                        username: connector.configuration.username,
                    });
                }
                this._backgroundPort.onMessage.addListener((msg) => {
                    // handle messages from background if needed
                    LOGGER.log('[Instance] onMessage', msg);
                    if(msg.action === 'redirectToUrl'){
                        navigate(this.navContext, msg.navigation);
                    }
                });
                this._backgroundPort.onDisconnect.addListener(() => {
                    this._backgroundPort = null;
                });
            }
        }
    }

    disconnectFromBackground() {
        if (isChromeExtension()) {
            if (this._backgroundPort) {
                this._backgroundPort.postMessage({ action: 'closeConnection' });
                this._backgroundPort = null;
            }
        }
    }

    /** Shortcuts **/

    initShortcuts = async() => {
        const configuration = await loadExtensionConfigFromCache([
            CACHE_CONFIG.SHORTCUT_INJECTION_ENABLED.key,
            CACHE_CONFIG.SHORTCUT_OVERVIEW.key,
            CACHE_CONFIG.SHORTCUT_SOQL.key,
            CACHE_CONFIG.SHORTCUT_APEX.key,
            CACHE_CONFIG.SHORTCUT_API.key,
            CACHE_CONFIG.SHORTCUT_DOCUMENTATION.key,
        ]);
    
        const shortcutEnabled = configuration[CACHE_CONFIG.SHORTCUT_INJECTION_ENABLED.key];
        const shortcutOverview = configuration[CACHE_CONFIG.SHORTCUT_OVERVIEW.key];
        const shortcutSoql = configuration[CACHE_CONFIG.SHORTCUT_SOQL.key];
        const shortcutApex = configuration[CACHE_CONFIG.SHORTCUT_APEX.key];
        const shortcutApi = configuration[CACHE_CONFIG.SHORTCUT_API.key];
        const shortcutDocumentation = configuration[CACHE_CONFIG.SHORTCUT_DOCUMENTATION.key];
        if (!shortcutEnabled) return;
    
    
        // Define all shortcuts
        const shortcuts = [
            {
                id: 'org-overview',
                shortcut: shortcutOverview,
                action: async (event, handler) => {
                    event.preventDefault();
                    navigate(this.navContext, {
                        type: 'application',
                        state: {
                            applicationName: 'home',
                        },
                    });
                },
            },
            {
                id: 'soql-explorer',
                shortcut: shortcutSoql,
                action: async (event, handler) => {
                    event.preventDefault();
                    
                    navigate(this.navContext, {
                        type: 'application',
                        state: {
                            applicationName: 'soql',
                        },
                    });
                },
            },
            {
                id: 'apex-explorer',
                shortcut: shortcutApex,
                action: async (event, handler) => {
                    event.preventDefault();
                    navigate(this.navContext, {
                        type: 'application',
                        state: {
                            applicationName: 'anonymousapex',
                        },
                    });
                },
            },
            {
                id: 'api-explorer',
                shortcut: shortcutApi,
                action: async (event, handler) => {
                    event.preventDefault();
                    navigate(this.navContext, {
                        type: 'application',
                        state: {
                            applicationName: 'api',
                        },
                    });
                },
            },
            {
                id: 'documentation',
                shortcut: shortcutDocumentation,
                action: async (event, handler) => {
                    event.preventDefault();
                    navigate(this.navContext, {
                        type: 'application',
                        state: {
                            applicationName: 'documentation',
                        },
                    });
                },
            },
        ];
    
        shortcuts.forEach(shortcut => {
            hotkeys(shortcut.shortcut, shortcut.action);
        });
    }
}
