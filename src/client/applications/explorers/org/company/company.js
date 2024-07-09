import ToolkitElement from 'core/toolkitElement';
import { api } from "lwc";
import { isEmpty,isElectronApp } from 'shared/utils';
import Toast from 'lightning/toast';
import { store,store_application } from 'shared/store';


export default class Company extends ToolkitElement {

    @api title = 'General Information';
    @api linkLabel = 'Company Information';
    
    orgInformation = {};


    connectedCallback(){
        //this.isFilterting_limits = true;
        this.init();
    }

    init = async () => {
        this.orgInformation = await this.load_orgInformations();
    }

    /** Methods */

    goToUrl = (e) => {
        const redirectUrl = e.currentTarget.dataset.url;
        store.dispatch(store_application.navigate(redirectUrl));
    }


    load_orgInformations = async () => {
        let response = await this.connector.conn.query("SELECT Fields(all) FROM Organization LIMIT 1");
        return response.records[0];
    }


    /** Getters */

    get organisationAddress(){
        return `${this.orgInformation.Address?.country} ${this.orgInformation.Address?.city}, ${this.orgInformation.Address?.street}`;
    }
    

    /** Events */

    handle_copyClick = (e) => {
        const value = e.target.dataset.value;
        const field = e.target.dataset.field;
        navigator.clipboard.writeText(value);
        Toast.show({
            label: `${field} exported to your clipboard'`,
            variant:'success',
        });
    }

}