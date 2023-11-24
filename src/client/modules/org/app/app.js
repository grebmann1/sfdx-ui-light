import { LightningElement } from "lwc";
import LightningAlert from 'lightning/alert';
import NewOrgModal from "org/NewOrgModal";
import OrgDetailModal from "org/OrgDetailModal";
import OrgRenameModal from "org/OrgRenameModal";

import {decodeError,getAllOrgs} from 'shared/utils';
import jsforce from 'jsforce/build/jsforce.js';



const actions = [
    { label: 'Login', name: 'login' },
    { label: 'See Details', name: 'seeDetails' },
    { label: 'Set Alias', name: 'setAlias' },
    { label: 'Unset Alias', name: 'unsetAlias' }
];

const columns = [
    { label: 'Company', fieldName: 'company', type: 'text',
    cellAttributes: {
        class: 'slds-text-title_bold slds-color-brand  slds-text-title_caps',
    },
    },
    { label: 'Name', fieldName: 'name', type: 'text' },
    { label: 'Alias', fieldName: 'alias', type: 'text' },
    { label: 'User Name', fieldName: 'username', type: 'text' },
    {
        type: 'action',
        typeAttributes: { rowActions: actions },
    },
];



export default class Alias extends LightningElement {
    
    columns = columns;
    data = [];

    async connectedCallback(){
        this.data = await this.execute_getAllOrgs();
    }


    test = async () => {
        jsforce.browser.init({
            clientId: '3MVG9_kZcLde7U5oNdaqndT3T9qa54eaA.ycC6APuOkYzRP286pPeOvwOqAQ2ue7l5ejNAxPYj4xTbWn3zS6Y',
            redirectUri: 'http://localhost:3000/callback',
            //proxyUrl: 'http://localhost:3000/proxy/'
        });
        jsforce.browser.login({loginUrl:'https://test.salesforce.com'});
        //let res = await fetch('http://localhost:3001/url', {method: 'GET'}).then((response) => {console.log('response',response); return response;});

    }

    /** Actions */

    createNewOrg = () => {
        NewOrgModal.open()
        .then(async (res) => {
            if(res){
                this.data = await this.execute_getAllOrgs();
            }
        });
    }

    handleRowAction(event) {
        const actionName = event.detail.action.name;
        const row = event.detail.row;
        switch (actionName) {
            case 'login':
                this.login(row);
                break;
            case 'seeDetails':
                this.seeDetails(row);
                break;
            case 'unsetAlias':
                this.unsetAlias(row);
                break;
            case 'setAlias':
                this.setAlias(row);
                break;
            default:
        }
    }
    




    /** Methods */
    login(row) {
        this.execute_openOrgUrl(row);
    }

    seeDetails = async (row) =>  {
        try{
            let res = await this.execute_loadDetails(row);
            if(res){
                OrgDetailModal.open(res)
                .then((result) => {
                    console.log(result);
                });
            }
        }catch(e){
            await LightningAlert.open({
                message: e.message,
                theme: 'error', 
                label: 'Error!', 
            });
        }
        
    }

    unsetAlias = async (row) => {
        try{
            var confirmed = window.confirm(`Are you sure you wish to remove this Alias : ${row.alias}?`)
            if(confirmed){
                await this.execute_unsetAlias(row);
            }
            this.data = await this.execute_getAllOrgs();
        }catch(e){
            await LightningAlert.open({
                message: e.message,
                theme: 'error', 
                label: 'Error!',
            });
        }
    }

    setAlias = async (row) => {
        try{
            OrgRenameModal.open({
                row:row,
                alias:row.alias
            })
            .then(async (res) => {
                console.log('res',res);
                if(res === 'success'){
                    await this.execute_unsetAlias(row);
                    this.data = await this.execute_getAllOrgs();
                }
            });
        }catch(e){
            await LightningAlert.open({
                message: e.message,
                theme: 'error', 
                label: 'Error!',
            });
        }
    }


    /** Execution Methods */

    execute_loadDetails = async (row) => {
        var {res, error} = await window.electron.ipcRenderer.invoke('org-seeDetails',row);
        if (error) {
            throw decodeError(error)
        }
        res = {
            ...res,
            ...{
                id:res.alias,
                company:`${res.alias.split('-').length > 1?res.alias.split('-').shift():''}`.toUpperCase(),
                name:res.alias.split('-').pop()
            }
        }
        return res;
    }

    execute_openOrgUrl = async (row) => {
        await window.electron.ipcRenderer.invoke('org-openOrgUrl',row);
    }

    execute_getAllOrgs = async () => {
        return await getAllOrgs();
    }

    execute_unsetAlias = async (row) => {
        var {res, error} = await window.electron.ipcRenderer.invoke('org-unsetAlias',row);
        if (error) {
            throw decodeError(error)
        }
    }

}