import { LightningElement,api} from "lwc";
import { connectStore,store,store_application } from 'shared/store';
import { isUndefinedOrNull,isNotUndefinedOrNull,isEmpty,normalizeString as normalize} from "shared/utils";
import { PANELS } from 'extension/utils';
import { getCurrentTab } from 'connection/utils';
import Toast from 'lightning/toast';

const APPLICATIONS = {
    RECORD_EXPLORER:'recordExplorer'
}

export default class Salesforce extends LightningElement {

    @api versions = [];
    @api version;
    @api currentOrigin;

    @api currentApplication = APPLICATIONS.RECORD_EXPLORER;
    @api isBackButtonDisplayed = false;
    
    connectedCallback(){}

    _isConnectorLoaded = false;
    @api
    get isConnectorLoaded(){
        return this._isConnectorLoaded;
    }
    set isConnectorLoaded(value){
        this._isConnectorLoaded = value;
        this.openRecordExplorerTab();
    }
    
    _recordId;
    @api
    get recordId(){
        return this._recordId;
    }
    set recordId(value){
        this._recordId = value;
        this.openRecordExplorerTab();
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
        const { value } = e.detail;
        if(this.isRecordExplorer && isNotUndefinedOrNull(value) && this.currentActiveTab === this.tabName_recordExplorer){
            this.handleSearchRecordExplorer(value);
        }
    }

    einsteinClick = () => {
        const params = {
            type:'application',
            attributes:{
                applicationName:'assistant',
            },state:{}
        };

        store.dispatch(store_application.fakeNavigate(params));
    }

    openDefaultPanel = () => {
        const params = {
            type:'application',
            attributes:{
                applicationName:'home',
            },state:{}
        };

        store.dispatch(store_application.fakeNavigate(params));
    }

    /** Methods **/

    openRecordExplorerTab = () => {
        if(isUndefinedOrNull(this._recordId) || this._isConnectorLoaded === false) return;

        window.setTimeout(() => {
            this.template.querySelector('slds-tabset').activeTabValue = this.tabName_recordExplorer;
        },100);
    }

    handleSearchRecordExplorer = (value) => {
        if(this.refs.recordexplorer){
            this.refs.recordexplorer.updateFilter(value);
        }
    }



    /** Getters **/

    get currentActiveTab(){
        return this.template.querySelector('slds-tabset')?.activeTabValue;
    }

    get isDefaultMenu(){
        return true;
    }

    get isRecordExplorer(){
        return !isEmpty(this.recordId);
    }

    get versionFormatted(){
        return isUndefinedOrNull(this.version)?'':`${this.version.label} (${this.version.version})`;
    }

    get isFooterDisplayed(){
        return this.isConnectorLoaded;
    }

    get tabName_recordExplorer(){
        return 'recordExplorer';
    }

    get tabName_orgInfo(){
        return 'orgInfo';
    }
}