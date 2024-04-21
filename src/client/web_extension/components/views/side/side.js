import { LightningElement,api} from "lwc";
import { isUndefinedOrNull,isNotUndefinedOrNull,normalizeString as normalize} from "shared/utils";
import { PANELS } from 'extension/utils';

export default class Side extends LightningElement {

    @api currentApplication;
    @api isConnectorLoaded = false;
    @api versions = [];
    @api version;
    @api recordId;


    panel = PANELS.DEFAULT;
    previousPanel;
    isBackButtonDisplayed = false;

    connectedCallback(){
        this.panel = this.defaultPanel;
    }
    

    /** Events **/

    handlePanelChange = (e) => {
        this.previousPanel = this.panel;
        this.panel = e.detail.panel;
        this.isBackButtonDisplayed = e.detail.isBackButtonDisplayed;
    }

    handleGoBack = () => {
        console.log('handleGoBack');
        this.panel = this.previousPanel;
        this.isBackButtonDisplayed = false;
        this.previousPanel = null;
    }

    /** Methods **/


    /** Getters **/

    get defaultPanel(){
        return new URLSearchParams(window.location.search).get('panel');
    }

    get normalizedPanel() {
        return normalize(this.panel, {
            fallbackValue: PANELS.SALESFORCE,
            validValues: Object.values(PANELS)
        });
    }

    get isSalesforcePanel(){
        return this.panel == PANELS.SALESFORCE;
    }

  
}