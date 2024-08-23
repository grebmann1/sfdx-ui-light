import { LightningElement,api,track,wire} from "lwc";
import Toast from 'lightning/toast';
import ToolkitElement from 'core/toolkitElement';
import { isUndefinedOrNull,isNotUndefinedOrNull,isEmpty,guid,classSet } from "shared/utils";
import { GLOBAL_EINSTEIN} from 'assistant/utils';
import { getConfigurations,connect } from 'connection/utils';
import { store,connectStore,EINSTEIN,APPLICATION,SELECTORS} from 'core/store';

export default class App extends ToolkitElement {

    isLoading = false;
    _hasRendered = false;

    @api isMobile = false;

    // Tabs
    @track dialogs = [];
    currentDialog;

    // Salesforce Instance
    @track salesforceIntance_connections = [];
    salesforceInstance_alias;
    salesforceInstance_connector;

    connectedCallback(){
        //this.isLoading = true;
        this.setDefaultEinsteinConnection();
        this.fetchAllConnections();
        store.dispatch(async (dispatch, getState) => {
            dispatch(EINSTEIN.reduxSlice.actions.loadCacheSettings({
                alias:GLOBAL_EINSTEIN
            }));
            // We init the connection only if it's not setup !
            
            //dispatch(EINSTEIN.reduxSlice.actions.initTabs());
        })

        if(chrome?.runtime){
            // Listening for broadcast messages from the background script
            chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
                if (message.action === 'broadcastMessage') {
                    //console.log('message.senderId',message.senderId,'sender.id',sender.id);
                    if (message.senderId != sender.id) {
                        // Force Refresh of cache setting to sync the messages !
                        console.log('--> Force Refresh Local Settings <--');
                        store.dispatch(EINSTEIN.reduxSlice.actions.loadCacheSettings({
                            alias:GLOBAL_EINSTEIN
                        }));
                    }
                }
            });
        }
    }

    renderedCallback(){
        this._hasRendered = true;

        if(this._hasRendered && this.template.querySelector('slds-tabset')){
            this.template.querySelector('slds-tabset').activeTabValue = this.currentDialog?.id;
        }
    }

    fetchAllConnections = async () => {
        // Browser & Electron version
        this.isLoading = true;
        this.salesforceIntance_connections =  await getConfigurations();
        this.isLoading = false;
    }
    
    @wire(connectStore, { store })
    storeChange({ einstein,application }) {
        //console.log('application.currentApplication',application.currentApplication,this.applicationName);
        const isCurrentApp = this.verifyIsActive(application.currentApplication);
        if(!isCurrentApp) return;
        //console.log('einstein',einstein);
        //const entities = SELECTORS.einstein.selectAll({einstein});
        //console.log('entities',entities);
        //this.tabs = einstein.tabs;
        this.dialogs = SELECTORS.einstein.selectAll({einstein});
        this.currentDialog = einstein.currentDialog;
        if(isNotUndefinedOrNull(einstein.connectionAlias) && this.salesforceInstance_alias != einstein.connectionAlias){
            this.salesforceInstance_alias = einstein.connectionAlias;
            this.salesforceInstance_connect(this.salesforceInstance_alias);
        }
    }

    /** Events **/

    handleAddTab = (e) => {
        store.dispatch(EINSTEIN.reduxSlice.actions.addTab({
            tab:{
                id:guid(),
                body:""
            }
        }));
    }

    handleSelectTab = (e) => {
        const tabId = e.target.value;
        store.dispatch(EINSTEIN.reduxSlice.actions.selectionTab({
            id:tabId,
            alias:GLOBAL_EINSTEIN
        }));
    }

    handleCloseTab = async (e) => {
        const tabId = e.detail.value;
        store.dispatch(EINSTEIN.reduxSlice.actions.removeTab({
            id:tabId,
            alias:GLOBAL_EINSTEIN
        }));
    }

    salesforceInstance_handleChange = (e) => {
        const alias = e.detail.value;
        this.salesforceInstance_connect(alias);
    }




    /** Methods **/

    salesforceInstance_connect = (alias) => {
        this.connectToOrg(alias);
        store.dispatch(EINSTEIN.reduxSlice.actions.updateConnectionAlias({
            connectionAlias:alias, // Used for the connection
            alias:GLOBAL_EINSTEIN // Used for the local storage
        }));
    }
    
    // This method is call in case there is no existing default connector
    setDefaultEinsteinConnection = () => {
        this.salesforceInstance_alias       = this.alias; // using another one to bypass the alias
        this.salesforceInstance_connector   = this.connector;
    }

    connectToOrg = async (alias) => {
        let settings = this.salesforceIntance_connections.find(x => x.id === alias);
        store.dispatch(APPLICATION.reduxSlice.actions.startLoading());

        try{
            this.salesforceInstance_connector = null;
            this.salesforceInstance_connector = await connect({alias,settings,disableEvent:true});
            store.dispatch(APPLICATION.reduxSlice.actions.stopLoading());
            if(!this.salesforceInstance_connector){
                Toast.show({
                    label: `OAuth Issue | Check your settings [re-authorize the org]`,
                    variant:'error',
                    mode:'dismissible'
                });
            }
        }catch(e){
            store.dispatch(APPLICATION.reduxSlice.actions.stopLoading());
        }
    }

    /** Getters **/

    get salesforceInstance_options(){
        return this.salesforceIntance_connections.filter(x => !x._isRedirect).map(x => ({value:x.alias,label:x.alias}));
    }

    get pageClass(){//Overwrite
        return `${super.pageClass} ${this.isMobile?'':' slds-p-around_small'}`;
    }

    get formattedTabs(){
        return this.dialogs.map((x,index) => {
            return {
                ...x,
                name:`Dialog ${index + 1}`,
                isCloseable:this.dialogs.length > 1,
                class:classSet('slds-tabs_scoped__item').toString()
            }
        })
    }
}