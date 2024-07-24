import { LightningElement,api,wire} from "lwc";
import { connectStore,store } from 'core/store';
import { store_application,store as legacyStore } from 'shared/store';
import { isUndefinedOrNull,isNotUndefinedOrNull,isEmpty,isSalesforceId} from "shared/utils";
import { PANELS } from 'extension/utils';
import { getCurrentTab } from 'connection/utils';
import Toast from 'lightning/toast';

const APPLICATIONS = {
    RECORD_EXPLORER:'recordExplorer',
    USER_EXPLORER:'userExplorer',
    ORG_INFO:'orgInfo',
    TOOLS:'tools'
}

export default class Salesforce extends LightningElement {

    @api currentOrigin;

    @api currentApplication = APPLICATIONS.RECORD_EXPLORER;
    @api isBackButtonDisplayed = false;
    
    connectedCallback(){}

    isConnectorLoaded = false;
    @wire(connectStore, { store })
    applicationChange({application}) {
        if(application.connector && this.connector == null){
            this.isConnectorLoaded = true;
            this.openSpecificTab(APPLICATIONS.RECORD_EXPLORER);
        }
    }

    
    // this.openSpecificTab(APPLICATIONS.RECORD_EXPLORER);
    
    _recordId;
    @api
    get recordId(){
        return this._recordId;
    }
    set recordId(value){
        this._recordId = value;
        if(isNotUndefinedOrNull(this._recordId)){
            this.openSpecificTab(APPLICATIONS.RECORD_EXPLORER);
        }
    }

    //orgInfo


    /** Events **/

    

    redirectToWebsite = () => {
        this.redirectToUrlViaChrome({});
    }

    redirectToAnonymousApex = () => {
        this.redirectToUrlViaChrome({redirectUrl:'anonymousapex'});
    }

    redirectToSoqlBuilder = () => {
        this.redirectToUrlViaChrome({redirectUrl:'soql'});
    }

    redirectToUrlViaChrome = ({redirectUrl}) => {
        let url = new URL('https://sf-toolkit.com/extension');
        let params = new URLSearchParams();
            params.append('sessionId', window.sessionId);
            params.append('serverUrl', 'https://'+window.serverUrl);
        if(redirectUrl){
            params.append('redirectUrl', redirectUrl);
        }
        url.search = params.toString();

        chrome.tabs.create({
            url:url.href
        }, tab => {});
    }

    

    handleSearch = (e) => {
        //console.log('handleSearch',this.refs.userexplorer);
        const { value } = e.detail;
        if(this.refs.recordexplorer && isNotUndefinedOrNull(value) && this.currentActiveTab === APPLICATIONS.RECORD_EXPLORER){
            this.refs.recordexplorer.updateFilter(value);
        }else if(this.refs.userexplorer && isNotUndefinedOrNull(value) && this.currentActiveTab === APPLICATIONS.USER_EXPLORER){
            this.refs.userexplorer.updateFilter(value);
        }
    }

    einsteinClick = () => {
        const params = {
            type:'application',
            attributes:{
                applicationName:'assistant',
            },state:{}
        };

        legacyStore.dispatch(store_application.fakeNavigate(params));
    }

    openDefaultPanel = () => {
        const params = {
            type:'application',
            attributes:{
                applicationName:'home',
            },state:{}
        };

        legacyStore.dispatch(store_application.fakeNavigate(params));
    }

    /** Methods **/

    openSpecificTab = (tabName) => {
        //if(isUndefinedOrNull(this.connector)) return;

        window.setTimeout(() => {
            this.template.querySelector('slds-tabset').activeTabValue = tabName;
        },100);
    }

    handleSearchRecordExplorer = (value) => {
        if(this.refs.recordexplorer){
            this.refs.recordexplorer.updateFilter(value);
        }
    }



    /** Getters **/

    get APPLICATIONS(){
        return APPLICATIONS;
    }

    get currentActiveTab(){
        return this.template.querySelector('slds-tabset')?.activeTabValue;
    }

    get isDefaultMenu(){
        return true;
    }

    get isRecordExplorerAvailable(){
        return !isEmpty(this.recordId) && isSalesforceId(this.recordId) && /\d/.test(this.recordId);
    }

    get isUserExplorerAvailable(){
        return true; // No specific logic yet to reduce the visibility
    }

    get isFooterDisplayed(){
        return this.isConnectorLoaded;
    }
}