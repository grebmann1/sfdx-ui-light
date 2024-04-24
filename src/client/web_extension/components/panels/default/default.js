import { LightningElement,api,wire} from "lwc";
import { connectStore,store,store_application } from 'shared/store';
import { isUndefinedOrNull,isNotUndefinedOrNull,normalizeString as normalize} from "shared/utils";
import { getCurrentTab } from 'connection/utils';
import Toast from 'lightning/toast';

const APPLICATIONS = {
    CONNECTION:'connection',
    DOCUMENTATION:'documentation'
}



export default class Default extends LightningElement {

    @api currentApplication = APPLICATIONS.CONNECTION;
    @api isBackButtonDisplayed = false;


    @wire(connectStore, { store })
    applicationChange({application}) {
        if(application?.type === 'FAKE_NAVIGATE'){
            const pageRef = application.target;
            this.loadFromNavigation(pageRef);
        }
        console.log('application in default',application)
    }


    connectedCallback(){

    }
    


    /** Events **/

    handleBackClick = () => {
        this.dispatchEvent(new CustomEvent("back", {bubbles: true,composed: true}));
    }

    openConnectionClick = () => {
        this.currentApplication = APPLICATIONS.CONNECTION;
    }

    handleSearch = (e) => {
        const { value } = e.detail;
        if(this.isConnection && isNotUndefinedOrNull(value)){
            this.handleSearchConnection(value);
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

    loadFromNavigation = async ({state, attributes}) => {
        //('documentation - loadFromNavigation');
        const {applicationName,attribute1}  = attributes;
        //console.log('applicationName',applicationName);
        if(applicationName == 'documentation'){
            this.currentApplication = APPLICATIONS.DOCUMENTATION;
        }else if(applicationName == 'home'){
            this.currentApplication = APPLICATIONS.CONNECTION;
        }
        
    }

    handleSearchConnection = (value) => {
        if(this.refs.connection){
            this.refs.connection.applyFilter(value);
        }
    }

    handleSearchDocumentation = (value) => {
        if(this.refs.documentation){
            this.refs.documentation.externalSearch(value);
        }
    }

    connection_authorizeOrg = () => {
        if(this.refs.connection){
            this.refs.connection.addConnectionClick();
        }
    }

    /** Getters **/

    get isConnection(){
        return this.currentApplication == APPLICATIONS.CONNECTION;
    }


    get isDocumentation(){
        return this.currentApplication == APPLICATIONS.DOCUMENTATION;
    }

}