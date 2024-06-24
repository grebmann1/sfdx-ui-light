import { LightningElement,api} from "lwc";
import { connectStore,store,store_application } from 'shared/store';
import { isUndefinedOrNull,isNotUndefinedOrNull,isEmpty,normalizeString as normalize} from "shared/utils";
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
        //this._isConnectorLoaded = true; // For offline debuging
        this.openSpecificTab(APPLICATIONS.RECORD_EXPLORER);
        //this.openUserExplorerTab(); // For offline debuging
    }
    
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
        console.log('handleSearch',this.refs.userexplorer);
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

    openSpecificTab = (tabName) => {
        if( this._isConnectorLoaded === false) return;

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
        return !isEmpty(this.recordId);
    }

    get isUserExplorerAvailable(){
        return true; // No specific logic yet to reduce the visibility
    }

    get versionFormatted(){
        return isUndefinedOrNull(this.version)?'':`${this.version.label} (${this.version.version})`;
    }

    get isFooterDisplayed(){
        return this.isConnectorLoaded;
    }
}