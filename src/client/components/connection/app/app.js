import { api } from "lwc";
import FeatureElement from 'element/featureElement';
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





export default class App extends FeatureElement {

    data = [];
    isLoading = false;

    connectedCallback(){
        this.setAllConnections();
    }

    /** Actions */


    addConnectionClick = () => {

        ConnectionNewModal.open()
        .then(async (res) => {
            //console.log('addConnectionClick',res);
            if(isNotUndefinedOrNull(res)){
                console.log('force refresh');
                await this.setAllConnections();
            }
            if(isElectronApp()){
                await window.electron.ipcRenderer.invoke('org-killOauth');
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
        if(isElectronApp()){
            window.electron.ipcRenderer.invoke('OPEN_INSTANCE',row);
        }else{
            let {alias,...settings} = this.data.find(x => x.id == row.id);
            try{
                let connector = await connect({alias,settings});
                console.log('login');
                this.dispatchEvent(new CustomEvent("login", { detail:{value:connector},bubbles: true }));
            }catch(e){
                // OAuth in case of login failure !!!!
                oauth({alias:alias,loginUrl:settings.instanceUrl || settings.loginUrl},(res) => {
                    this.dispatchEvent(new CustomEvent("login", { detail:{value:res.connector},bubbles: true }));
                })
            }
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
        const {company,orgId,name,alias,username,instanceUrl,sfdxAuthUrl,accessToken} = row
        ConnectionDetailModal.open({company,orgId,name,alias,username,instanceUrl,sfdxAuthUrl,accessToken}).then((result) => {});
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
    
    get pageClass(){
        return super.pageClass+' slds-overflow-hidden';
    }

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
            { label: 'Type', fieldName: '_type', type:'text', _filter:'electron',
                cellAttributes: {
                    class: { fieldName: '_typeClass' },
                },
            },
            { label: 'Status', fieldName: '_status', type:'text', fixedWidth:90, _filter:'electron',
                cellAttributes: {
                    class: { fieldName: '_statusClass' },
                },
            },
            { label: 'Expire', fieldName: 'expirationDate', type:'text', fixedWidth:100, _filter:'electron'},
            { label: 'API', fieldName: 'instanceApiVersion', type: 'text', fixedWidth:70, _filter:'electron'},
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