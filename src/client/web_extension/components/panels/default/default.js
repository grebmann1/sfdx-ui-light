import { LightningElement,api} from "lwc";
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