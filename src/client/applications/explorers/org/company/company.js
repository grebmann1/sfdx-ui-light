import ToolkitElement from 'core/toolkitElement';
import { api } from "lwc";
import { isEmpty,isElectronApp,classSet,isNotUndefinedOrNull } from 'shared/utils';
import Toast from 'lightning/toast';
import { store as legacyStore,store_application } from 'shared/store';


export default class Company extends ToolkitElement {

    @api title = 'General Information';
    @api linkLabel = 'Company Information';
    @api isInjected = false;
    
    orgInformation = {};


    connectedCallback(){
        //this.isFilterting_limits = true;
        this.init();
    }

    init = async () => {
        this.orgInformation = await this.load_orgInformations();
        console.log('this.orgInformation',this.orgInformation);
    }

    /** Methods */

    goToUrl = (e) => {
        const redirectUrl = e.currentTarget.dataset.url;
        legacyStore.dispatch(store_application.navigate(redirectUrl));
    }


    load_orgInformations = async () => {
        let response = await this.connector.conn.query("SELECT Fields(all) FROM Organization LIMIT 1");
        return response.records[0];
    }


    /** Getters */

    get instanceUrl(){
        return this.connector?.conn?.instanceUrl;
    }

    get instanceUrlFormatted(){
        return isNotUndefinedOrNull(this.instanceUrl)?(new URL(this.instanceUrl))?.host:'';
    }

    get organisationAddress(){
        return `${this.orgInformation.Address?.country} ${this.orgInformation.Address?.city}, ${this.orgInformation.Address?.street}`;
    }

    get containerClass(){
        return classSet('slds-col slds-size_1-of-1 slds-p-top_x-small slds-p-left_x-small')
            .add({
                'slds-large-size_1-of-2':!this.isInjected,
            }).toString();
    }
    

    /** Events */

    handle_copyClick = (e) => {
        const value = e.target.dataset.value;
        const field = e.target.dataset.field;
        navigator.clipboard.writeText(value);
        Toast.show({
            label: `${field} exported to your clipboard`,
            variant:'success',
        });
    }

}