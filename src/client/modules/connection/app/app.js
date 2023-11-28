import { LightningElement,api} from "lwc";
import ConnectionNewModal from "connection/connectionNewModal";
import ConnectionDetailModal from "connection/connectionDetailModal";
import ConnectionRenameModal from "connection/connectionRenameModal";

import {isNotUndefinedOrNull,isElectronApp} from 'shared/utils';
import {getAllConnection,removeConnection,connect,Connector} from 'connection/utils';

const actions = [
    { label: 'Login', name: 'login' },
    { label: 'Open Browser', name: 'openBrowser' },
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
        let records = await getAllConnection();
        this.data =  records;
        this.isLoading = false;
    }

    login = async (row) => {
        let settings = this.data.find(x => x.id == row.id);
        let connection = await connect({settings});
        this.dispatchEvent(new CustomEvent("login", { detail:{value:new Connector(settings,connection)},bubbles: true }));
    }

    openBrowser = (row) => {
        if(isElectronApp()){
            // Express version
            window.electron.ipcRenderer.invoke('org-openOrgUrl',row);
        }else{
            // Browser version
            window.open(row.sfdxAuthUrl,'_blank');
        }    
    }

    seeDetails = (row) => {
        ConnectionDetailModal.open(row)
        .then((result) => {
        });
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


    /** Getters */

    get columns(){
        let _columns = [
            { label: 'Company', fieldName: 'company', type: 'text',
                cellAttributes: {
                    class: 'slds-text-title_bold slds-color-brand  slds-text-title_caps',
                },
            },
            { label: 'Name', fieldName: 'name', type: 'text' },
            { label: 'Alias', fieldName: 'alias', type: 'text' },
            { label: 'DevHub', fieldName: 'isDevHub', type:'boolean', fixedWidth:90, _filter:'electron'},
            { label: 'API', fieldName: 'instanceApiVersion', type: 'text', fixedWidth:90, _filter:'electron'},
            { label: 'User Name', fieldName: 'username', type: 'text',initialWidth:400 },
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