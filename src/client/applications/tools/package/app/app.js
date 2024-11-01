import { api,track,wire } from "lwc";
import ToolkitElement from 'core/toolkitElement';
import { lowerCaseKey,isUndefinedOrNull,isNotUndefinedOrNull,isEmpty,guid,classSet,runActionAfterTimeOut,compareString,splitTextByTimestamp } from 'shared/utils';
import { store,connectStore,PACKAGE,SELECTORS } from 'core/store';
import { store_application, store as legacyStore } from 'shared/store';


export default class App extends ToolkitElement {
    

    isLoading = false;
    isDeploymentRunning = false;
    isRetrieveRunning = false;
    currentMethod;


    _deploymentResponse;
    _retrieveResponse;
    //_deploymentRequestId;

    connectedCallback(){
        //this.isLoading = true;
        

        store.dispatch((dispatch, getState) => {
            dispatch(PACKAGE.reduxSlice.actions.loadCacheSettings({
                alias:this.alias,
                apexFiles:getState().apexFiles
            }));
        })
    }

    @wire(connectStore, { store })
    storeChange({ package2,application }) {
        const isCurrentApp = this.verifyIsActive(application.currentApplication);
        if(!isCurrentApp) return;
        this.currentMethod = package2.currentMethod || super.i18n.TAB_RETRIEVE; // Default to TAB_DEPLOY

       // Deployment 
       const deployState = package2.currentDeploymentJob;
       if(deployState){
           this.isDeploymentRunning = deployState.isFetching;
           //this._deploymentRequestId = deployState.id;
           if(deployState.error){
                this._deploymentResponse = null;
           }else if(deployState.data){
               // Assign Data
               this._deploymentResponse = deployState.data;
           }else if(deployState.isFetching){
                this._deploymentResponse = null;
           }
       }else {
            this._deploymentResponse = null;
       }

       // Retrieve 
       const retrieveState = package2.currentRetrieveJob;
       if(retrieveState){
           this.isRetrieveRunning = retrieveState.isFetching;
           if(retrieveState.error){
                this._retrieveResponse = null;
           }else if(retrieveState.data){
               // Assign Data
               this._retrieveResponse = retrieveState.data;
           }else if(retrieveState.isFetching){
                this._retrieveResponse = null;
           }
       }else {
            this._retrieveResponse = null;
       }
    }

    /** Methods  **/
	

    


    /** Events **/

    handleSelectMethod = (e) => {
        store.dispatch(PACKAGE.reduxSlice.actions.updateCurrentMethodPanel({
            alias:this.alias,
            value:e.target.value
        }));
    }

    handleDeploy = (e) => {
        this.refs.deploy.run();
    }

    handleNewDeployment = (e) => {
        if(this.currentMethod === super.i18n.TAB_DEPLOY){
            this.refs.deploy.reset();
        }
    }

    handleRetrieve = (e) => {
        this.refs.retrieve.run();
    }

    goToUrl = (e) => {
        e.preventDefault();
        const redirectUrl = e.currentTarget.dataset.url;
        legacyStore.dispatch(store_application.navigate(redirectUrl));
    }

    handleAbort = (e) => {
        if(this.currentMethod === super.i18n.TAB_RETRIEVE){
            this.refs.retrieve.abort();
        }
    }

    
    /** Getters */

    get pageClass(){//Overwrite
        return super.pageClass+' slds-p-around_small';
    }

    get isDeployVisible(){
        return this.currentMethod === super.i18n.TAB_DEPLOY;
    }

    get isRetrieveVisible(){
        return this.currentMethod === super.i18n.TAB_RETRIEVE;
    }

    get isNewDeploymentButtonDisplayed(){
        return this._deploymentResponse?.success;
    }

    get deployClass(){
        return `slds-fill-height ${this.isDeployVisible?'slds-visible':'slds-hide'}`;
    }

    get retrieveClass(){
        return `slds-fill-height ${this.isRetrieveVisible?'slds-visible':'slds-hide'}`;
    }
  
}