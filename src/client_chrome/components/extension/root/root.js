import { api, LightningElement, wire } from 'lwc';
import Toast from 'lightning/toast';
import {
    isNotUndefinedOrNull,
    isUndefinedOrNull,
    normalizeString as normalize,
    runActionAfterTimeOut,
    getRecordId,
} from 'shared/utils';
import { getHostAndSession, credentialStrategies } from 'connection/utils';
import { getCurrentTab, PANELS } from 'extension/utils';

/** Store **/
import { store as legacyStore } from 'shared/store';
import { connectStore, store, APPLICATION } from 'core/store';

const VARIANT = {
    DEFAULT: 'default',
    OVERLAY: 'overlay',
};

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

    get currentUrl() {
        this._currentUrl;
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

    /*messageListener = (message, sender, sendResponse) => {
        if(sender.tab.id != this.currentTab.id) return;

        if(message?.action === 'lwc_hightlight_redirect'){
            const developerName = message.developerName.substring(2).split('-').join('');

            const redirect = `/metadata/LightningComponentBundle?param1=${developerName}`;
            sendResponse(
                `https://sf-toolkit.com/extension?sessionId=${this.connector.conn.accessToken}&serverUrl=${encodeURIComponent(this.connector.conn.instanceUrl)}&redirectUrl=${encodeURIComponent(redirect)}`
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
        let cookie = await getHostAndSession();
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
            this.currentUrl = this.currentTab.url;
            //this.currentOrigin = (new URL(this.currentTab.url)).origin;
            if (withMonitorChange) {
                chrome.tabs.onUpdated.addListener(this.monitorUrlListener);
            }
        } catch (e) {
            console.error(e);
        }
        this.hasLoaded = true;
    };

    monitorUrlListener = async (tabId, info, tab) => {
        //console.log('onUpdated',tabId, info, tab)
        if (!tab.url || info.status !== 'complete' || tabId != this.currentTab.id) return;

        runActionAfterTimeOut(
            tab.url,
            async newUrl => {
                this.currentUrl = newUrl;
                if (!this.hasSession) {
                    // Reload in case there is existing session found!
                    this.loadComponent(false);
                } else {
                    // verify cookie
                    let cookie = await getHostAndSession();
                    if (isUndefinedOrNull(cookie)) {
                        this.redirectToDefaultView();
                    }
                }
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
            let connector = await credentialStrategies.SESSION.connect({
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
