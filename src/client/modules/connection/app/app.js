import { LightningElement,api} from "lwc";

import ConnectionNewModal from "connection/connectionNewModal";
import ConnectionDetailModal from "connection/connectionDetailModal";
import ConnectionRenameModal from "connection/connectionRenameModal";

import {isNotUndefinedOrNull,isElectronApp} from 'shared/utils';
import {getAllConnection,removeConnection,connect,oauth} from 'connection/utils';

const actions = [
    { label: 'Connect', name: 'login' },
    { label: 'Login', name: 'openBrowser' },
    { label: 'See Details', name: 'seeDetails' },
    { label: 'Set Alias', name: 'setAlias' },
    { label: 'Remove', name: 'removeConnection' }
];





export default class App extends LightningElement {

    data = [];
    isLoading = false;

    async connectedCallback(){
        await this.setAllConnections();
    }

    /** Actions */


    addConnectionClick = () => {
        ConnectionNewModal.open()
        .then(async (res) => {
            if(isNotUndefinedOrNull(res)){
                // we can use window.jsforce.conn
                await this.setAllConnections();
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
            case 'openBrowser':
                this.openBrowser(row);
                break;
            case 'seeDetails':
                this.seeDetails(row);
                break;
            case 'removeConnection':
                this.removeConnection(row);
                break;
            case 'setAlias':
                this.setAlias(row);
                break;
            default:
        }
    }





    /** Methods */


    setAllConnections = async () => {
        // Browser & Electron version
        this.isLoading = true;
        this.data =  await getAllConnection();;
        this.isLoading = false;
    }

    login = async (row) => {
        let {alias,...settings} = this.data.find(x => x.id == row.id);
        try{
            console.log('settings',settings);
            let connector = await connect({alias,settings});
            this.dispatchEvent(new CustomEvent("login", { detail:{value:connector},bubbles: true }));
        }catch(e){
            // OAuth in case of login failure !!!!
            oauth({alias:alias,loginUrl:settings.instanceUrl || settings.loginUrl},(res) => {
                this.dispatchEvent(new CustomEvent("login", { detail:{value:res.connector},bubbles: true }));
            })
        }
        
    }

    openBrowser = (row) => {
        if(isElectronApp()){
            // Electron version
            window.electron.ipcRenderer.invoke('org-openOrgUrl',row);
        }else{
            let settings = this.data.find(x => x.id == row.id);
            // Browser version
            let url = settings.instanceUrl+'/secur/frontdoor.jsp?sid='+settings.accessToken;
            window.open(url,'_blank');
        }    
    }

    seeDetails = (row) => {
        ConnectionDetailModal.open(row).then((result) => {});
    }

    setAlias = (row) => {
        ConnectionRenameModal.open({
            oldAlias:row.alias,
            username:row.username,
            newAlias:row.alias
        })
        .then(async (result) => {
            await this.setAllConnections();
        });
    }

    removeConnection = async (row) => {
        var confirmed = window.confirm(`Are you sure you wish to remove this Connection : ${row.alias}:${row.username} ?`)
        if(confirmed){
            await removeConnection(row.alias);
            await this.setAllConnections();
        }
    }


    /** Getters  */

    get columns(){
        let _columns = [
            { label: 'Company', fieldName: 'company', type: 'text',
                cellAttributes: {
                    class: 'slds-text-title_bold slds-color-brand  slds-text-title_caps',
                },
            },
            { label: 'Name', fieldName: 'name', type: 'text',
                cellAttributes: {
                    class: { fieldName: '_typeClass' },
                },
            },
            { label: 'Alias', fieldName: 'alias', type: 'text',
                cellAttributes: {
                    class: { fieldName: '_typeClass' },
                },
            },
            { label: 'Type', fieldName: '_type', type:'text', fixedWidth:150, _filter:'electron',
                cellAttributes: {
                    class: { fieldName: '_typeClass' },
                },
            },
            { label: 'Status', fieldName: '_status', type:'text', fixedWidth:150, _filter:'electron',
                cellAttributes: {
                    class: { fieldName: '_statusClass' },
                },
            },
            { label: 'Expire', fieldName: 'expirationDate', type:'text', fixedWidth:150, _filter:'electron'},
            { label: 'API', fieldName: 'instanceApiVersion', type: 'text', fixedWidth:90, _filter:'electron'},
            { label: 'User Name', fieldName: 'username', type: 'text',initialWidth:400,
                cellAttributes: {
                    class: { fieldName: '_typeClass' },
                },
            },
            {
                type: 'action',
                typeAttributes: { rowActions: actions },
            },
        ];

        if(isElectronApp()){
            return _columns.filter(x => x._filter == null || x._filter === 'electron');
        }else{
            return _columns.filter(x => x._filter == null || x._filter === 'web');
        }
    }


}