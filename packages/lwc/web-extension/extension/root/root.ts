import { api, LightningElement, wire } from 'lwc';
import Toast from 'lightning/toast';
import {
    isNotUndefinedOrNull,
    isUndefinedOrNull,
    normalizeString as normalize,
    runActionAfterTimeOut,
    getRecordId,
} from 'shared/utils';
import { getHostAndSession, credentialStrategies } from 'core/connector';
import { getCurrentTab, PANELS } from 'extension/utils';

/** Store **/
import { store as legacyStore } from 'shared/store';
import { connectStore, store, APPLICATION } from 'core/store';

const VARIANT = {
    DEFAULT: 'default',
    OVERLAY: 'overlay',
    VSCODE: 'vscode',
};

const MATCH_CONTENT_SCRIPT_URL = 'matchContentScriptUrl';

export default class Root extends LightningElement {
    @api variant;
    sessionId;
    serverUrl;
    version;

    currentTab;
    recordId;
    hasLoaded = false;
    panel = PANELS.SALESFORCE;
    connector;
    _currentUrl;
    activeTabMatchesSalesforce = false;

    get currentUrl() {
        return this._currentUrl;
    }

    set currentUrl(value) {
        this._currentUrl = value;
        this.recordId = getRecordId(this._currentUrl);
    }

    /** Getters **/

    get hasSession() {
        return isNotUndefinedOrNull(this.sessionId) && isNotUndefinedOrNull(this.serverUrl);
    }

    get normalizedVariant() {
        return normalize(this.variant, {
            fallbackValue: VARIANT.DEFAULT,
            validValues: Object.values(VARIANT),
        });
    }

    get isDefault() {
        return this.normalizedVariant === VARIANT.DEFAULT;
    }

    get isOverlay() {
        return this.normalizedVariant === VARIANT.OVERLAY;
    }

    get isVscode() {
        return this.normalizedVariant === VARIANT.VSCODE;
    }

    /*messageListener = (message, sender, sendResponse) => {
        if(sender.tab.id != this.currentTab.id) return;

        if(message?.action === 'lwc_hightlight_redirect'){
            const developerName = message.developerName.substring(2).split('-').join('');

            const redirect = `/metadata/LightningComponentBundle?param1=${developerName}`;
            sendResponse(
                `https://workbench-salesforce.com/extension?sessionId=${this.connector.conn.accessToken}&serverUrl=${encodeURIComponent(this.connector.conn.instanceUrl)}&redirectUrl=${encodeURIComponent(redirect)}`
            )
        }
    }*/

    @wire(connectStore, { store: legacyStore })
    applicationChange({ application }) {
        // Redirect
        if (application.redirectTo) {
            this.handleRedirection(application);
        }
    }

    @wire(connectStore, { store })
    storeChange({ application }) {
        // connector
        if (application.connector) {
            this.connector = null;
            this.connector = application.connector;
        }
    }

    connectedCallback() {
        this.loadComponent(true);
        //chrome.runtime.onMessage.addListener(this.messageListener);
    }

    disconnectedCallback() {
        chrome.tabs.onUpdated.removeListener(this.monitorUrlListener);
        chrome.tabs.onActivated.removeListener(this.handleTabActivatedListener);
        //chrome.runtime.onMessage.removeListener(this.messageListener);
    }

    /*
    getSessionId = () => {
        return new URLSearchParams(window.location.search).get('sessionId');
    }

    getServerUrl = () => {
        return new URLSearchParams(window.location.search).get('serverUrl');
    }
    */

    loadComponent = async withMonitorChange => {
        const cookie = await getHostAndSession();
        //console.log('cookie',cookie);
        if (cookie) {
            this.init_existingSession(cookie);
            this.panel = PANELS.SALESFORCE;
        } else {
            this.redirectToDefaultView();
        }

        // Handle Tabs
        try {
            this.currentTab = await getCurrentTab();
            this.currentUrl = this.currentTab?.url;
            //this.currentOrigin = (new URL(this.currentTab.url)).origin;
            if (withMonitorChange) {
                chrome.tabs.onUpdated.addListener(this.monitorUrlListener);
                chrome.tabs.onActivated.addListener(this.handleTabActivatedListener);
            }
        } catch (e) {
            console.error(e);
        }
        await this.updateActiveTabMatchesSalesforce(this.currentTab?.url);
        this.hasLoaded = true;
    };

    updateActiveTabMatchesSalesforce = async (url: string | undefined) => {
        let matches = false;
        try {
            const res = (await chrome.runtime.sendMessage({
                action: MATCH_CONTENT_SCRIPT_URL,
                url: url ?? '',
            })) as { matches?: boolean } | undefined;
            matches = res?.matches === true;
        } catch {
            matches = false;
        }
        this.activeTabMatchesSalesforce = matches;
    };

    syncForDebouncedUrl = async (url: string) => {
        if (!url) {
            return;
        }
        this.currentUrl = url;
        await this.updateActiveTabMatchesSalesforce(url);
        if (!this.hasSession) {
            await this.loadComponent(false);
        } else {
            const nextCookie = await getHostAndSession();
            if (isUndefinedOrNull(nextCookie)) {
                this.redirectToDefaultView();
            }
        }
    };

    applyActivatedTabId = async (tabId: number) => {
        let tab: chrome.tabs.Tab | undefined;
        try {
            tab = await chrome.tabs.get(tabId);
        } catch {
            return;
        }
        if (!tab?.id) {
            return;
        }
        this.currentTab = tab;
        if (tab.url) {
            this.currentUrl = tab.url;
        }
        await this.updateActiveTabMatchesSalesforce(tab.url);
        if (!this.hasSession) {
            await this.loadComponent(false);
        } else {
            const nextCookie = await getHostAndSession();
            if (isUndefinedOrNull(nextCookie)) {
                this.redirectToDefaultView();
            }
        }
    };

    handleTabActivatedListener = (activeInfo: chrome.tabs.TabActiveInfo) => {
        if (!activeInfo?.tabId) {
            return;
        }
        runActionAfterTimeOut(
            activeInfo.tabId,
            (tabId: number) => {
                void this.applyActivatedTabId(tabId);
            },
            { timeout: 100, key: 'sidepanel-tab-activated' }
        );
    };

    monitorUrlListener = (tabId: number, info: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) => {
        //console.log('onUpdated',tabId, info, tab)
        if (!tab.url || info.status !== 'complete' || tabId !== this.currentTab?.id) {
            return;
        }

        runActionAfterTimeOut(
            tab.url,
            async (newUrl: string) => {
                await this.syncForDebouncedUrl(newUrl);
            },
            { timeout: 300 }
        );
    };

    redirectToDefaultView = () => {
        //console.log('redirectToDefaultView');
        // Redirect to default view as there is no cookie !!!
        this.panel = PANELS.DEFAULT;
    };

    init_existingSession = async cookie => {
        this.sessionId = cookie.session;
        this.serverUrl = cookie.domain;
        /** Set as global **/
        window.sessionId = this.sessionId;
        window.serverUrl = this.serverUrl;
        if (isUndefinedOrNull(this.sessionId) || isUndefinedOrNull(this.serverUrl)) {
            this.sendError('Missing SessionId AND/OR ServerUrl'); // Shouldn't be used all the time
            this.redirectToDefaultView();
        }

        try {
            const connector = await credentialStrategies.SESSION.connect({
                sessionId: this.sessionId,
                serverUrl: this.serverUrl,
            });
            store.dispatch(APPLICATION.reduxSlice.actions.login({ connector }));
        } catch (e) {
            this.sendError(e.message); // Shouldn't be used all the time
            this.redirectToDefaultView();
        }
    };

    sendError = message => {
        /*LightningAlert.open({
            message: 'Invalid Session',
            theme: 'error', // a red theme intended for error states
            label: 'Error!', // this is the header text
        });*/
        Toast.show({
            label: message || 'Error during connection',
            variant: 'error',
            mode: 'dismissible',
        });
    };

    handleRedirection = async application => {
        let url = application.redirectTo || '';

        /*if(url.startsWith('sftoolkit:')){
            // Inner Navigation
            const navigationConfig = url.replace('sftoolkit:','');
            navigate(this.navContext,JSON.parse(navigationConfig));
            return;
        }*/

        if (!url.startsWith('http')) {
            // to force refresh in case it's not valid anymore :
            await this.connector.conn.identity();
            url = `${this.connector.frontDoorUrl}&retURL=${encodeURI(url)}`;
        }

        window.open(url, '_blank');
    };
}
