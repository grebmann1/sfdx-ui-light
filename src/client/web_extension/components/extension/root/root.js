import { LightningElement,api,wire } from "lwc";
import FeatureElement from 'element/featureElement';
import LightningAlert from 'lightning/alert';
import { isUndefinedOrNull,runActionAfterTimeOut,normalizeString as normalize } from "shared/utils";
import { directConnect,getHostAndSession } from 'connection/utils';
import { getCurrentTab,getRecordId } from 'extension/utils';

/** Store **/
import { connectStore,store,store_application } from 'shared/store';

const VARIANT = {
    SIDE:'side',
    POPUP:'popup',
    OPTIONS:'options'
}

export default class root extends FeatureElement {
   

    @api variant;
    sessionId;
    serverUrl;
    versions = [];
    version;
    isConnectorLoaded = false;

    currentTab;
    recordId;


    set currentUrl(value){
        this._currentUrl = value;
        this.recordId = getRecordId(this._currentUrl);
        //console.log('this.recordId',this.recordId);
    }

    get currentUrl(){
        this._currentUrl;
    }

    @wire(connectStore, { store })
    applicationChange({application}) {
        // Redirect
        if(application.redirectTo){
            this.handleRedirection(application);
        }
    }

    connectedCallback(){
        this.loadComponent();
    }

    loadComponent = async () => {
       
        let cookie = await getHostAndSession();
        if(cookie){
            this.init_existingSession(cookie);
        }else{
            this.init_default();
        }

        this.currentTab = await getCurrentTab();
        this.currentUrl = this.currentTab.url;
        //this.currentOrigin = (new URL(this.currentTab.url)).origin;
        this.monitorUrlChange();
    }
    
    monitorUrlChange = async () => {
        chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
            //console.log('onUpdated',tabId, info, tab)
            if (!tab.url || info.status !== 'complete' || tabId != this.currentTab.id) return;
            runActionAfterTimeOut(tab.url,async (newUrl) => {
                this.currentUrl = newUrl;
            },{timeout:500});
        });
    }

    init_default = () => {
        //this.hasLoaded = true;
    }

    init_existingSession = async (cookie) => {
        this.sessionId = cookie.session;
        this.serverUrl = cookie.domain;

        /** Set as global **/
        window.sessionId = this.sessionId;
        window.serverUrl = this.serverUrl;
        window.connector = await directConnect(this.sessionId,'https://' + this.serverUrl);
        this.versions = (await this.connector.conn.request('/services/data/')).sort((a, b) => b.version.localeCompare(a.version));
        this.version = this.versions[0];
        // Initialize;
        this.connector.version = this.version.version;

        if(isUndefinedOrNull(this.sessionId) || isUndefinedOrNull(this.serverUrl)){
            this.sendError();
        }else{
            this.isConnectorLoaded = true;
        }
    }
    
    /*
    getSessionId = () => {
        return new URLSearchParams(window.location.search).get('sessionId');
    }

    getServerUrl = () => {
        return new URLSearchParams(window.location.search).get('serverUrl');
    }
    */

    sendError = () => {
        LightningAlert.open({
            message: 'Invalid Session',
            theme: 'error', // a red theme intended for error states
            label: 'Error!', // this is the header text
        });
    }

    loadConfigFromCache = async () => {
        const configuration = await loadExtensionConfigFromCache();
        this.openPopupInSidePanel_checked = configuration.openPopupInSidePanel || false;
    }

    handleRedirection = async (application) => {
        let url = application.redirectTo || '';

        /*if(url.startsWith('sftoolkit:')){
            // Inner Navigation
            const navigationConfig = url.replace('sftoolkit:','');
            navigate(this.navContext,JSON.parse(navigationConfig));
            return;
        }*/
        
        if(!url.startsWith('http')){
            // to force refresh in case it's not valid anymore : 
            await this.connector.conn.identity();
            url = `${this.connector.frontDoorUrl}&retURL=${encodeURI(url)}`;
        }

        window.open(url,'_blank');
    }

    /** Getters **/

    get normalizedVariant() {
        return normalize(this.variant, {
            fallbackValue: VARIANT.SIDE,
            validValues: Object.values(VARIANT)
        });
    }

    get isSide(){
        return this.normalizedVariant === VARIANT.SIDE
    }

    get isPopup(){
        return this.normalizedVariant === VARIANT.POPUP
    }

    get isOptions(){
        return this.normalizedVariant === VARIANT.OPTIONS
    }
}
