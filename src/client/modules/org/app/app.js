import { LightningElement } from "lwc";
import NewOrgModal from "org/NewOrgModal";
import OrgDetailModal from "org/OrgDetailModal";


import {decodeError} from 'shared/utils';



const actions = [
    { label: 'Login', name: 'login' },
    { label: 'See Details', name: 'seeDetails' }
    /*{ label: 'Set Alias', name: 'setAlias' },
    { label: 'Unset Alias', name: 'unsetAlias' }*/
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

    connectedCallback(){
        this.execute_getAllOrgs();
    }


    /** Actions */

    createNewOrg = () => {
        NewOrgModal.open()
        .then((result) => {
            console.log(result);
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
            default:
        }
    }
    




    /** Methods */
    login(row) {
        this.execute_openOrgUrl(row);
    }

    seeDetails = async (row) =>  {
        let res = await this.execute_loadDetails(row);
        if(res){
            OrgDetailModal.open(res)
            .then((result) => {
                console.log(result);
            });
        }
    }


    /** Execution Methods */

    execute_loadDetails = async (row) => {
        try{
            var {res, error} = await window.electron.ipcRenderer.invoke('org-seeDetails',row);
            if (error) {
                throw decodeError(error)
            }
            /*this.setState({
                isSelectedUserDetailDisplayed:true,
                selectedUserDetail:{...result,...{username:user.username}}
            })*/
            console.log('result',{res, error});
            console.log('display details !!!')
            // set alias if null
            res = {
                ...res,
                ...{
                    id:res.alias,
                    company:`${res.alias.split('-').length > 1?res.alias.split('-').shift():''}`.toUpperCase(),
                    name:res.alias.split('-').pop()
                }
            }
            return res;
        }catch(e){
            console.log('error',e);
            return null;
        }
    }

    execute_openOrgUrl = async (row) => {
        await window.electron.ipcRenderer.invoke('org-openOrgUrl',row);
    }

    execute_getAllOrgs = async () => {
        let res = await window.electron.ipcRenderer.invoke('org-getAllOrgs');
            res = res.sort((a, b) => a.alias.localeCompare(b.alias));
            res = res.map((item,index) => {
                return {
                    ...item,
                    ...{
                        id:item.alias,
                        username:item.value,
                        company:`${item.alias.split('-').length > 1?item.alias.split('-').shift():''}`.toUpperCase(),
                        name:item.alias.split('-').pop()
                    }
                }
            })
        this.data = res;
        console.log('res',res);
    }

}