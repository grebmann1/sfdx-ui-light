import { LightningElement,api} from "lwc";
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
    @api recordId;
    @api currentOrigin;

    @api currentApplication = APPLICATIONS.RECORD_EXPLORER;

    @api isConnectorLoaded = false;
    @api isBackButtonDisplayed = false;
    


    connectedCallback(){

    }
    


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

    openSidePanel = async () => {
        const tab = await getCurrentTab();
        await chrome.sidePanel.setOptions({
            tabId:tab.id,
            path: 'views/side.html',
            enabled: true
        });
        chrome.sidePanel.open({ tabId: tab.id });
        window.close(); // close the popup
    }

    handleSearch = (e) => {
        const { value } = e.detail;
        if(this.isRecordExplorer && isNotUndefinedOrNull(value)){
            this.handleSearchRecordExplorer(value);
        }
    }

    openDefaultPanel = () => {
        this.dispatchEvent(new CustomEvent("changepanel", { detail:{
            panel:PANELS.DEFAULT,
            isBackButtonDisplayed:true
        },bubbles: true,composed: true}));
    }

    /** Methods **/

    handleSearchRecordExplorer = (value) => {
        if(this.refs.recordexplorer){
            this.refs.recordexplorer.updateTable(value);
        }
    }

    /** Getters **/

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
}