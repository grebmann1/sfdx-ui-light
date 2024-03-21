import { api,track } from "lwc";
import FeatureElement from 'element/featureElement';
import ConnectionNewModal from "connection/connectionNewModal";
import ConnectionDetailModal from "connection/connectionDetailModal";
import ConnectionRenameModal from "connection/connectionRenameModal";

import { classSet,runActionAfterTimeOut,checkIfPresent,isUndefinedOrNull,isNotUndefinedOrNull,isElectronApp,isChromeExtension,normalizeString as normalize,groupBy } from 'shared/utils';
import { getAllConnection,removeConnection,connect,oauth,getSettings,getCurrentTab } from 'connection/utils';
import { store,store_application } from 'shared/store';


const actions = [
    { label: 'Connect', name: 'login' },
    { label: 'Browser', name: 'openBrowser' },
    { label: 'See Details', name: 'seeDetails' },
    { label: 'Set Alias', name: 'setAlias' },
    { label: 'Remove', name: 'removeConnection' }
];

const LOGIN_URL = 'https://login.salesforce.com';
const TEST_URL = 'https://login.salesforce.com';
const CUSTOM_URL = 'custom';

export default class App extends FeatureElement {

    @api variant = 'table';
    @api isHeaderLess = false;
    @track data = [];
    @track formattedData = [];
    isLoading = false;

    // Search
    filter;

    connectedCallback(){
        this.setAllConnections();
    }

    /** Actions */


    @api
    applyFilter = (value) => {
        this.filter = value;
    }

    @api
    addConnectionClick = () => {
        this.authorizeOrg();
    }

    authorizeOrg = (param) => {
        ConnectionNewModal.open(param)
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
        console.log('handleRowAction',event.detail);
        const actionName = event.detail.action.name;
        const row = event.detail.row;
        switch (actionName) {
            case 'login':
                this.login(row);
                break;
            case 'openBrowser':
                this.openBrowser(row,'_blank');
                break;
            case 'incognito':
                this.openBrowser(row,'incognito');
                break;
            case 'openToolkit':
                this.openToolkit(row);
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

    forceAuthorization = (row) => {
        const selectedDomain = row.loginUrl.startsWith(LOGIN_URL)?LOGIN_URL:(row.loginUrl.startsWith(TEST_URL)?TEST_URL:CUSTOM_URL);
        const authorizeParams = {
            selectedDomain,
            customDomain:selectedDomain === CUSTOM_URL?row.loginUrl:null,
            alias:row.alias
        }
        this.authorizeOrg(authorizeParams);
    }


    setAllConnections = async () => {
        // Browser & Electron version
        this.isLoading = true;
        this.data =  await getAllConnection();
        this.formattedData = this.formatDataForCardView();
        this.isLoading = false;
    }

    formatDataForCardView = () => {
        let grouped = groupBy(this.data,'company');
        return Object.keys(grouped).map(key => ({
            key:key,
            title:key,
            items:grouped[key]
        }))
    }

    login = async (row) => {
        if(isElectronApp()){
            if(row._hasError){
                this.forceAuthorization(row);
            }else{
                window.electron.ipcRenderer.invoke('OPEN_INSTANCE',row);
            }
            
        }else{
            let {alias,...settings} = this.data.find(x => x.id == row.id);
            this.dispatchEvent(new CustomEvent("startlogin", { bubbles: true,composed: true }));
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

    openBrowser = async (row,target) => {
        console.log('openBrowser',target);

        if(isElectronApp()){
            // Electron version
            if(row._hasError){
                this.forceAuthorization(row);
            }else{
                window.electron.ipcRenderer.invoke('org-openOrgUrl',row);
            }
        }else{
            this.isLoading = true;
            try{
                const {alias,...settings} = this.data.find(x => x.id == row.id);
                const connector = await connect({alias,settings,disableEvent:true});
                const url = connector.conn.instanceUrl+'/secur/frontdoor.jsp?sid='+connector.conn.accessToken;

                if(isChromeExtension()){
                    if(target == 'incognito'){
                        chrome.windows.getAll({populate: false, windowTypes: ['normal']}, (windows) => {
                            for (let w of windows) {
                                if (w.incognito) {
                                    // Use this window.
                                    chrome.tabs.create({url: url, windowId: w.id},(tab) => {
                                        this.createOrAddToTabGroup(tab, alias);
                                    });
                                    return;
                                }
                            }
                            // No incognito window found, open a new one.
                            chrome.windows.create({url: url, incognito: true});
                        });
                    }else{
                        chrome.tabs.create({url: url},(tab) => {
                            this.createOrAddToTabGroup(tab, alias);
                        });
                        
                    }
                }else{
                    window.open(url,target);
                }
            }catch(e){}
            this.isLoading = false;
        }    
    }

    openToolkit = async (row) => {
        this.isLoading = true;
            try{
                const {alias,...settings} = this.data.find(x => x.id == row.id);
                const connector = await connect({alias,settings,disableEvent:true});
                const url = `https://sf-toolkit.com/extension?sessionId=${connector.conn.accessToken}&serverUrl=${encodeURIComponent(connector.conn.instanceUrl)}`;
                window.open(url,'_blank');
                /*chrome.tabs.create({url: url},(tab) => {
                    this.createOrAddToTabGroup(tab, alias);
                });*/
            }catch(e){}
        this.isLoading = false;
    }

    seeDetails = async (row) => {
        var {company,orgId,name,alias,username,instanceUrl,sfdxAuthUrl,accessToken,frontDoorUrl} = row;
        if(isElectronApp()){
            let settings = await getSettings(alias);
            sfdxAuthUrl = settings.sfdxAuthUrl || sfdxAuthUrl;
        }
        
        ConnectionDetailModal.open({company,orgId,name,alias,username,instanceUrl,sfdxAuthUrl,accessToken,frontDoorUrl}).then((result) => {});
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
    };

    createOrAddToTabGroup = (tab, groupName) =>{
        chrome.tabGroups.query({}, (groups) => {
            let group = groups.find(g => g.title === groupName);
        
            if (group) {
                // Group exists, add the tab to this group
                chrome.tabs.group({groupId: group.id, tabIds: tab.id}, () => {
                    console.log(`Tab added to existing group '${groupName}'`);
                });
            } else {
                // Group does not exist, create a new group with this tab
                chrome.tabs.group({createProperties: {}, tabIds: tab.id}, (newGroupId) => {
                    chrome.tabGroups.update(newGroupId, {title: groupName}, () => {
                        console.log(`New group '${groupName}' created and tab added`);
                    });
                });
            }
        });
    }

    handleFieldsFilter = (e) => {
        runActionAfterTimeOut(e.detail.value,(newValue) => {
            this.filter = newValue;
            //this.updateFieldsTable();
        });
    }

    formatSpecificField = (content) => {
        var regex = new RegExp('('+this.filter+')','gi');
        if(regex.test(content)){
            return content.replace(/<?>?/,'').replace(regex,'<span style="font-weight:Bold; color:blue;">$1</span>');
        }else{
            return content;
        }
    }

    /** Getters  */

    get isNoRecord(){
        return this.formattedData.length == 0;
    }

    get isSearchDisplayed(){
        return !this.isSearchHidden;
    }

    get filteredFormatted(){
        return this.formattedData.map(group => ({
            ...group,
            items:group.items.filter(x => isUndefinedOrNull(this.filter) || isNotUndefinedOrNull(this.filter) && (checkIfPresent(x.alias,this.filter) || checkIfPresent(x.username,this.filter))).map(x => ({
                ...x,
                _name:this.formatSpecificField(x.name),
                _username:this.formatSpecificField(x.username)
            }))
        }));
    }

    get filteredOriginal(){
        return this.data.filter(x => isUndefinedOrNull(this.filter) || isNotUndefinedOrNull(this.filter) && (checkIfPresent(x.alias,this.filter) || checkIfPresent(x.username,this.filter)));
    }

    get normalizedVariant() {
        return normalize(this.variant, {
            fallbackValue: 'table',
            validValues: ['table', 'card']
        });
    }

    get isTableVariant(){
        return this.normalizedVariant == 'table';
    }

    get isCardVariant(){
        return this.normalizedVariant == 'card';
    }
    
    get pageClass(){
        return super.pageClass+' slds-overflow-hidden';
    }

    get headerRowClass(){
        return classSet("slds-page-header__row").toString();
    }

    get detailRowClass(){
        return classSet("slds-page-header__detail-row slds-is-relative min-height-200").toString();
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
            { label: 'Status', fieldName: '_status', type:'text', initialWidth:90, _filter:'electron',
                cellAttributes: {
                    class: { fieldName: '_statusClass' },
                },
            },
            { label: 'Expire', fieldName: 'expirationDate', type:'text', initialWidth:100, _filter:'electron'},
            { label: 'API', fieldName: 'instanceApiVersion', type: 'text', initialWidth:70, _filter:'electron'},
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