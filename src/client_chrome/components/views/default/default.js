import { LightningElement,api,wire} from "lwc";
import { connectStore,store,store_application } from 'shared/store';
import { isUndefinedOrNull,isNotUndefinedOrNull,normalizeString as normalize} from "shared/utils";
import { PANELS } from 'extension/utils';

export default class Default extends LightningElement {

    @api currentApplication;
    @api recordId;
    @api panel = PANELS.DEFAULT;
    
    previousPanel;
    isBackButtonDisplayed = false;

    @wire(connectStore, { store })
    applicationChange({application}) {
        if(application?.type === 'FAKE_NAVIGATE'){
            const pageRef = application.target;
            this.loadFromNavigation(pageRef);
        }
        //console.log('application',application)
    }

    connectedCallback(){
        this.panel = this.urlOverwrittenPanel || this.panel;
    }
    

    /** Events **/

    handlePanelChange = (e) => {
        //console.log('handlePanelChange',e.detail);
        //this.previousPanel = this.panel;
        if(this.panel != e.detail.panel){
            this.panel = e.detail.panel;
            this.isBackButtonDisplayed = e.detail.isBackButtonDisplayed;
        }
        
    }

    handleGoBack = () => {
        //console.log('handleGoBack');
        //this.panel = this.previousPanel;
        this.panel = PANELS.SALESFORCE; // For now only salesforce is returned with go back, In the futur, store the navigation events to go back !
        this.isBackButtonDisplayed = false;
        //this.previousPanel = null;
    }

    /** Methods **/

    @api
    resetToDefaultView = () => {
        //console.log('resetToDefaultView');
        this.panel = PANELS.DEFAULT;
    }

    loadFromNavigation = async ({state, attributes}) => {
        //('documentation - loadFromNavigation');
        const {applicationName,attribute1}  = attributes;
        //console.log('applicationName',applicationName);
        if(applicationName == 'documentation' || applicationName == 'home'){
            this.handlePanelChange({
                detail:{
                    panel:PANELS.DEFAULT,
                    isBackButtonDisplayed:true
                }
            })
        }
        
    }

    /** Getters **/

    get urlOverwrittenPanel(){
        return new URLSearchParams(window.location.search).get('panel');
    }

    get normalizedPanel() {
        return normalize(this.panel, {
            fallbackValue: PANELS.SALESFORCE,
            validValues: Object.values(PANELS)
        });
    }

    get isSalesforcePanel(){
        return this.normalizedPanel == PANELS.SALESFORCE;
    }

    get salesforcePanelClass(){
        return this.isSalesforcePanel ? '':'slds-hide';
    }

    get defaultPanelClass(){
        return this.isSalesforcePanel ? 'slds-hide':'';
    }

  
}