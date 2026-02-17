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
    decodeBase64UrlToJson,
} from 'shared/utils';
import { NavigationContext, CurrentPageReference, navigate } from 'lwr/navigation';
import { handleRedirect } from './utils';
import LOGGER from 'shared/logger';
import {
    getConfigurations,
    setConfigurations,
    extractConfig,
    normalizeConfiguration,
    saveSession,
} from 'connection/utils';
/** Apps  **/
import { APP_LIST } from './modules';
import SessionExpiredModal, { RESULT as SESSION_EXPIRED_RESULT } from 'ui/sessionExpiredModal';
/** Helpers **/
import { loadLimitedMode, loadFullMode } from './session';
import { connectToBackgroundWithIdentity, disconnectFromBackground } from './background';
import { initShortcuts } from './shortcuts';
import { initCacheStorage, loadFromCache } from './cache';

/** Store **/
import { connectStore, store, DOCUMENT, APPLICATION, SHELL } from 'core/store';
import { store as legacyStore } from 'shared/store';

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
    betaSmartInputEnabled = false;
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
                if (formattedApplicationName === 'smartinput' && !this.betaSmartInputEnabled) {
                    this.handleApplicationSelection('home/app');
                    break;
                }
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
        //this.test();
    }

    init = async () => {
        await initCacheStorage();
        await this.processShareParams();
        if (isElectronApp()) {
            await this.initElectron();
            this.isCommandCheckFinished = true;
        }
        this.loadVersion();
        this.initMode();
        this.initDragDrop();
    };

    processShareParams = async () => {
        if (typeof window === 'undefined' || !window.location) return;
        const url = new URL(window.location.href);
        const share = url.searchParams.get('share');
        const shareUser = url.searchParams.get('shareUser');
        let urlChanged = false;

        if (share) {
            try {
                const payload = decodeBase64UrlToJson(decodeURIComponent(share));
                if (payload?.v === 1 && payload.alias && payload.sfdxAuthUrl) {
                    const params = extractConfig(payload.sfdxAuthUrl);
                    if (params) {
                        let instanceUrl = params.instanceUrl;
                        if (instanceUrl && !instanceUrl.startsWith('http')) {
                            instanceUrl = `https://${instanceUrl}`;
                        }
                        const rawConfig = {
                            credentialType: 'OAUTH',
                            alias: payload.alias,
                            refreshToken: params.refreshToken,
                            instanceUrl,
                        };
                        const normalized = normalizeConfiguration(rawConfig, true);
                        const configs = await getConfigurations();
                        const next = configs.some((c) => c.alias === payload.alias)
                            ? configs.map((c) => (c.alias === payload.alias ? normalized : c))
                            : [...configs, normalized];
                        await setConfigurations(next);
                        await saveSession({ credentialType: 'OAUTH', alias: payload.alias });
                    }
                }
            } catch (e) {
                LOGGER.error('processShareParams share', e);
            }
            url.searchParams.delete('share');
            urlChanged = true;
        }

        if (shareUser) {
            try {
                const payload = decodeBase64UrlToJson(decodeURIComponent(shareUser));
                if (payload?.v === 1) {
                    sessionStorage.setItem('connectionNewModalPrefill', JSON.stringify(payload));
                }
            } catch (e) {
                LOGGER.error('processShareParams shareUser', e);
            }
            url.searchParams.delete('shareUser');
            urlChanged = true;
        }

        if (urlChanged) {
            const cleanUrl = url.pathname + (url.search || '') + (url.hash || '');
            window.history.replaceState(null, '', cleanUrl);
        }
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
        const context = { 
            connector: this.connector, 
            navContext: this.navContext, 
            _backgroundPort: this._backgroundPort 
        };
        connectToBackgroundWithIdentity(context);
        this._backgroundPort = context._backgroundPort;
    };

    handleLogout = () => {
        // Reset Applications
        this.applications = this.applications.filter(x => x.name == 'home/app');
        navigate(this.navContext, { type: 'application', state: { applicationName: 'home' } });
        // Disconnect from background
        const context = { _backgroundPort: this._backgroundPort };
        disconnectFromBackground(context);
        this._backgroundPort = context._backgroundPort;
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

    handleRedirection = async ({ redirectTo }) => {
        let url = redirectTo || '';
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
        if (target === 'smartinput/app' && !this.betaSmartInputEnabled) {
            target = 'home/app';
        }
        if (this.applications.filter(x => x.name === target).length == 0) {
            this.loadModule(target);
        } else {
            const existingAppId = this.applications.find(x => x.name === target).id;
            this.loadSpecificTab(existingAppId);
        }
    };

    /** Methods  */

    loadFromCache = async () => {
        const config = await loadFromCache(this);
        this.isApplicationTabVisible = config.isApplicationTabVisible;
        
        if (isEmpty(config.openaiKey)) {
            // `checkForInjected` exists in some app modules but not all.
            // Guard to avoid runtime crash when the method isn't implemented.
            const maybeCheckForInjected = this.checkForInjected;
            if (typeof maybeCheckForInjected === 'function') {
                maybeCheckForInjected.call(this);
            }
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
        } catch (e) {
            LOGGER.error('Init Mode Error -->', e);
            this.pageHasLoaded = true;
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
        const result = await loadLimitedMode({
            alias: this.alias,
            sessionId: this.sessionId,
            serverUrl: this.serverUrl,
            redirectUrl: this.redirectUrl,
            navContext: this.navContext,
            targetPage: this.targetPage,
            handleNavigation: this.handleNavigation.bind(this),
        });
        
        // Reset session params after use
        if (result.success && isNotUndefinedOrNull(this.sessionId)) {
            this.sessionId = null;
            this.serverUrl = null;
        }
        
        this.pageHasLoaded = true;
        if (this.targetPage) {
            this.handleNavigation(this.targetPage);
        }
    };

    /** Website & Electron **/
    load_fullMode = async () => {
        await loadFullMode({
            sessionId: this.sessionId,
            serverUrl: this.serverUrl,
            redirectUrl: this.redirectUrl,
            navContext: this.navContext,
            targetPage: this.targetPage,
            loadModule: this.loadModule.bind(this),
            handleNavigation: this.handleNavigation.bind(this),
        });
        
        // Reset session params after use
        if (isNotUndefinedOrNull(this.sessionId)) {
            this.sessionId = null;
            this.serverUrl = null;
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

    get uiMenuClass() {
        return classSet('l-container-vertical')
        .add({
            'slds-fill-height': !this.isMenuCollapsed,
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
        if (target === 'smartinput/app' && !this.betaSmartInputEnabled) {
            LOGGER.warn('Smart Input is disabled by beta feature flag');
            target = 'home/app';
        }
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

    /** Shortcuts **/
    initShortcuts = async () => {
        await initShortcuts({ navContext: this.navContext });
    }
}
