import { LightningElement } from "lwc";
import ConnectionNewModal from "connection/connectionNewModal";
import ConnectionDetailModal from "connection/connectionDetailModal";
import ConnectionRenameModal from "connection/connectionRenameModal";

import {isNotUndefinedOrNull} from 'shared/utils';
import {getAllConnection,removeConnection} from 'connection/utils';

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
        await this.setAllConnections();
    }

    /** Actions */


    addConnectionClick = () => {
        ConnectionNewModal.open()
        .then(async (res) => {
            if(isNotUndefinedOrNull(res)){
                // we can use window.jsforce.conn
                console.log('Connection Added',res);
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


    setAllConnections = async () => {
        // Browser version
        let records = await getAllConnection();

        // Electron version

        this.data =  records;
    }

    login = (row) => {

        // Browser version
        window.open(row.sfdxAuthUrl,'_blank');

        // Express version
    }

    seeDetails = (row) => {
        ConnectionDetailModal.open(row)
        .then((result) => {
            console.log(result);
        });
    }

    setAlias = (row) => {
        ConnectionRenameModal.open({
            row:row,
            alias:row.alias
        })
        .then(async (result) => {
            console.log(result);
            await this.setAllConnections();
        });
    }

    unsetAlias = async (row) => {
        var confirmed = window.confirm(`Are you sure you wish to remove this Alias : ${row.alias}?`)
        if(confirmed){
            await removeConnection(row.alias);
            await this.setAllConnections();
        }
    }


}