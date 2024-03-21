import { LightningElement,api} from "lwc";
import { isUndefinedOrNull,isNotUndefinedOrNull } from "shared/utils";
import { getCurrentTab } from 'connection/utils';

export default class Popup extends LightningElement {

    @api sessionId;
    @api serverUrl;
    @api versions = [];
    @api version;

    @api mode; // to investigate
    
    @api variant = 'side';

    connectedCallback(){
        //console.log('sessionId',this.sessionId);
        //console.log('serverUrl',this.serverUrl);
        //console.log('version',this.version);
        //console.log('variant',this.variant);
    }


    /** Events **/

    redirectToWebsite = () => {
        chrome.tabs.create({
            url:'https://sf-toolkit.com/extension?sessionId='+window.sessionId+'&serverUrl=https://'+window.serverUrl
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
        if(this.isConnection && isNotUndefinedOrNull(value)){
            this.handleSearchConnection(value);
        }else if(this.isRecordExplorer && isNotUndefinedOrNull(value)){
            this.handleSearchRecordExplorer(value);
        }
    }

    handleChangeVersionClick = (e) => {
        
    }

    /** Methods **/

    handleSearchConnection = (value) => {
        if(this.refs.connection){
            this.refs.connection.applyFilter(value);
        }
    }

    handleSearchRecordExplorer = (value) => {
        if(this.refs.recordexplorer){
            this.refs.recordexplorer.updateTable(value);
        }
    }

    connection_authorizeOrg = () => {
        if(this.refs.connection){
            this.refs.connection.addConnectionClick();
        }
    }

    /** Getters **/

    get isConnection(){
        return this.variant === 'side';
    }

    get isRecordExplorer(){
        return this.variant === 'popup';
    }

    get versionFormatted(){
        return isUndefinedOrNull(this.version)?'':`${this.version.label} (${this.version.version})`;
    }

    get isFooterDisplayed(){
        return isNotUndefinedOrNull(this.sessionId);
    }
}