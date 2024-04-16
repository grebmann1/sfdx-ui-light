import { api,track } from "lwc";
import Toast from 'lightning/toast';
import FeatureElement from 'element/featureElement';
import ConnectionNewModal from "connection/connectionNewModal";
import ConnectionDetailModal from "connection/connectionDetailModal";
import ConnectionRenameModal from "connection/connectionRenameModal";
import ConnectionImportModal from "connection/connectionImportModal";
import { download,classSet,runActionAfterTimeOut,checkIfPresent,isUndefinedOrNull,isNotUndefinedOrNull,isElectronApp,isChromeExtension,normalizeString as normalize,groupBy } from 'shared/utils';
import { getAllConnection,setAllConnection,removeConnection,connect,oauth,getConnection,getCurrentTab } from 'connection/utils';
import { store,store_application } from 'shared/store';


const actions = [
    { label: 'Connect', name: 'login' },
    { label: 'Browser', name: 'openBrowser' },
    { label: 'Export', name: 'export' },
    { label: 'See Details', name: 'seeDetails' },
    { label: 'Edit', name: 'setAlias' },
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
    isLoading   = false;

    // Injection
    isInjected  = false;
    loadFromExtension = false;
    @track injectedConnections = [];

    // Search
    filter;

    async connectedCallback(){
        await this.fetchAllConnections();
        this.checkForInjected();
        window.setTimeout(()=>{
            //this.addConnectionClick();
        },10)
    }

    /** Actions */
    checkForInjected = async () => {
        let el = document.getElementsByClassName('injected-connections');
        if(el){
            this.isInjected = true;
            try{
                let content = (el[0]?.textContent || "{'connections':[]}").trim();
                this.injectedConnections = JSON.parse(content)?.connections || [];
                this.loadFromExtension = (await window.defaultStore.getItem('connection-extension-toggle')) === true;
                if(this.loadFromExtension){
                    this.fetchInjectedConnections();
                }
            }catch(e){
                console.error('Issue while injecting',e);
            }
        }
    }

    @api
    applyFilter = (value) => {
        this.filter = value;
    }

    @api
    addConnectionClick = () => {
        this.authorizeOrg({connections:this.data});
    }

    authorizeOrg = (param) => {
        ConnectionNewModal.open(param)
        .then(async (res) => {
            //console.log('addConnectionClick',res);
            if(isNotUndefinedOrNull(res)){
                console.log('force refresh');
                await this.fetchAllConnections();
            }
            if(isElectronApp()){
                await window.electron.ipcRenderer.invoke('org-killOauth');
            }
        });
    }

    handleRowAction = (event) => {
        const actionName = event.detail.action.name;
        const { row,redirect } = event.detail;
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
                this.openToolkit(row,redirect);
                break;
            case 'openSoqlBuilder':
                this.openSoqlBuilder(row);
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
            case 'export':
                this.exportRow(row);
                break;
            default:
        }
    }


    handleLoadFromExtensionChange = async (e) => {
            // e.detail.checked;
            this.loadFromExtension = e.detail.checked;
            await window.defaultStore.setItem('connection-extension-toggle',this.loadFromExtension);
            if(this.loadFromExtension){
                this.fetchInjectedConnections();
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


    fetchAllConnections = async () => {
        // Browser & Electron version
        this.isLoading = true;
        this.data =  await getAllConnection();
        this.formattedData = this.formatDataForCardView();
        this.isLoading = false;
    }

    fetchInjectedConnections = async () => {
        this.isLoading = true;
        const aliasList = this.injectedConnections.map(x => x.alias);
        const newConnections = [].concat(this.injectedConnections,this.data.filter(x => !aliasList.includes(x.alias)));
        
        //console.log('newConnections',JSON.parse(JSON.stringify(newConnections)));
        await setAllConnection(JSON.parse(JSON.stringify(newConnections)));

        /** Fetch Again **/
        this.fetchAllConnections();
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
                const url = connector.frontDoorUrl;

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

    openToolkit = async (row,redirect) => {
        this.isLoading = true;
            try{
                const {alias,...settings} = this.data.find(x => x.id == row.id);
                const connector = await connect({alias,settings,disableEvent:true});
                var url = `https://sf-toolkit.com/extension?sessionId=${connector.conn.accessToken}&serverUrl=${encodeURIComponent(connector.conn.instanceUrl)}`;
                //var url = `http://localhost:3000/extension?sessionId=${connector.conn.accessToken}&serverUrl=${encodeURIComponent(connector.conn.instanceUrl)}`;
                if(redirect){
                    url+=`&redirectUrl=${encodeURIComponent(redirect)}`;
                }
                window.open(url,'_blank');
                /*chrome.tabs.create({url: url},(tab) => {
                    this.createOrAddToTabGroup(tab, alias);
                });*/
            }catch(e){
                console.log('error',e);
            }
        this.isLoading = false;
    }

    exportRow = async (row) => {
        const { alias,sfdxAuthUrl } = row;
        const exportedRow = [{
            alias,
            sfdxAuthUrl
        }];
        
        //navigator.clipboard.writeText(JSON.stringify(exportedRow, null, 4));
        download(JSON.stringify(exportedRow),'application/json',`${alias}_sftoolkit_config.json`);
        Toast.show({
            label: `${alias} has been exported.`,
            //message: 'Exported to your clipboard', // Message is hidden in small screen
            variant:'success',
        });
    }

    seeDetails = async (row) => {
        var {company,orgId,name,username,instanceUrl,sfdxAuthUrl} = row;
        const {alias,...settings} = this.data.find(x => x.id == row.id);
        const connector = await connect({alias,settings,disableEvent:true});
        const accessToken   = connector.conn.accessToken;
        const frontDoorUrl  = connector.frontDoorUrl;
        
        if(isElectronApp()){
            let settings = await getConnection(alias);
            sfdxAuthUrl = settings.sfdxAuthUrl || sfdxAuthUrl;
        }
        
        ConnectionDetailModal.open({
            company,orgId,name,alias,username,instanceUrl,sfdxAuthUrl,accessToken,frontDoorUrl,
            'size':isChromeExtension()?'full':'medium'
        }).then((result) => {});
    }

    setAlias = (row) => {
        ConnectionRenameModal.open({
            oldAlias:row.alias,
            category:row.company,
            orgName:row.name,
            username:row.username,
            connections:this.data
        })
        .then(async (result) => {
            await this.fetchAllConnections();
        });
    }

    removeConnection = async (row) => {
        var confirmed = window.confirm(`Are you sure you wish to remove this Connection : ${row.alias}:${row.username} ?`)
        if(confirmed){
            await removeConnection(row.alias);
            await this.fetchAllConnections();
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

    @api
    exportClick = (e) => {
        download(JSON.stringify(this.exportedData),'application/json','sftoolkit_config.json');
        navigator.clipboard.writeText(JSON.stringify(this.exportedData, null, 4));
        Toast.show({
            label: 'Exported to your clipboard',
            //message: 'Exported to your clipboard', // Message is hidden in small screen
            variant:'success',
        });
    }

    @api
    importClick = (e) => {
        ConnectionImportModal.open({
            'existingConnections':this.data,
            'size':isChromeExtension()?'full':'small'
        })
        .then(async (res) => {
            console.log('force refresh');
            await this.fetchAllConnections();
        });
    }

    displayCard = () => {
        if(!this.isCardVariant){
            this.variant = 'card';
        }
    }

    displayTable = () => {
        if(!this.isTableVariant){
            this.variant = 'table';
        }
    }

    /** Getters  */

    get isNoRecord(){
        return this.formattedData.length == 0;
    }

    get isSearchDisplayed(){
        return !this.isSearchHidden;
    }

    get exportedData(){
        return this.data.map(x => {
            const { sfdxAuthUrl,alias } = x;
            return {
                alias,
                sfdxAuthUrl
            }
        });
    }

    get filteredFormatted(){
        return this.formattedData.map(group => ({
            ...group,
            items:group.items.filter(x => isUndefinedOrNull(this.filter) || isNotUndefinedOrNull(this.filter) && (checkIfPresent(x.alias,this.filter) || checkIfPresent(x.username,this.filter))).map(x => ({
                ...x,
                _name:this.formatSpecificField(x.name || ''),
                _username:this.formatSpecificField(x.username || '')
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
        return classSet("slds-page-header__detail-row slds-is-relative min-height-200 slds-row-container").toString();
    }

    get columns(){
        let _columns = [
            { label: 'Category', fieldName: 'company', type: 'text',
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
            {   label:'Connect',
                type: 'button',initialWidth:110,
                typeAttributes:{    
                    label:'Connect',title:'Connect',name:'login',variant:'brand'
                },
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