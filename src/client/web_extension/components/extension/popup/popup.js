import { LightningElement,api} from "lwc";
import { isUndefinedOrNull,isNotUndefinedOrNull,normalizeString as normalize} from "shared/utils";
import { getCurrentTab } from 'connection/utils';
import Toast from 'lightning/toast';

const APPLICATIONS = {
    RECORD_EXPLORER:'recordExplorer',
    CONNECTION:'connection',
    DOCUMENTATION:'documentation'
}

const VARIANT = {
    SIDE:'side',
    POPUP:'popup'
}

export default class Popup extends LightningElement {

    @api sessionId;
    @api serverUrl;
    @api versions = [];
    @api version;

    @api currentApplication; // to investigate
    
    @api variant;


    connectedCallback(){
        //console.log('sessionId',this.sessionId);
        //console.log('serverUrl',this.serverUrl);
        //console.log('version',this.version);
        //console.log('variant',this.variant);

        if(this.normalizedVariant === VARIANT.POPUP){
            this.currentApplication = APPLICATIONS.RECORD_EXPLORER; // Home page for popup
        }else if(this.normalizedVariant === VARIANT.SIDE){
            this.currentApplication = APPLICATIONS.CONNECTION; // Home page for side
        }else{
            throw new Error('Variant is required !!!');
        }
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

    openConnectionClick = () => {
        this.currentApplication = APPLICATIONS.CONNECTION;
    }

    handleSearch = (e) => {
        const { value } = e.detail;
        if(this.isConnection && isNotUndefinedOrNull(value)){
            this.handleSearchConnection(value);
        }else if(this.isRecordExplorer && isNotUndefinedOrNull(value)){
            this.handleSearchRecordExplorer(value);
        }else if(this.isDocumentation && isNotUndefinedOrNull(value)){
            this.handleSearchDocumentation(value);
        }
    }

    exportClick = (e) => {
        if(this.refs.connection){
            this.refs.connection.exportClick();
        }
    }

    importClick = (e) => {
        if(this.refs.connection){
            this.refs.connection.importClick();
        }
    }

    documentationClick = (e) => {
        this.currentApplication = APPLICATIONS.DOCUMENTATION;
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

    handleSearchDocumentation = (value) => {
        if(this.refs.documentation){
            console.log('handleSearchDocumentation');
            this.refs.documentation.externalSearch(value);
        }
    }

    connection_authorizeOrg = () => {
        if(this.refs.connection){
            this.refs.connection.addConnectionClick();
        }
    }

    /** Getters **/

    get normalizedVariant() {
        return normalize(this.variant, {
            fallbackValue: VARIANT.SIDE,
            validValues: Object.values(VARIANT)
        });
    }

    get isConnection(){
        return this.currentApplication == APPLICATIONS.CONNECTION;
    }

    get isRecordExplorer(){
        return this.currentApplication == APPLICATIONS.RECORD_EXPLORER;
    }

    get isDocumentation(){
        return this.currentApplication == APPLICATIONS.DOCUMENTATION;
    }

    get versionFormatted(){
        return isUndefinedOrNull(this.version)?'':`${this.version.label} (${this.version.version})`;
    }

    get isFooterDisplayed(){
        return isNotUndefinedOrNull(this.sessionId);
    }
}