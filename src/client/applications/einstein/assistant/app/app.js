import { LightningElement,api,track,wire} from "lwc";
import { isUndefinedOrNull,isNotUndefinedOrNull,isEmpty,guid,classSet } from "shared/utils";
import ToolkitElement from 'core/toolkitElement';
import { getThreadList,deleteThreadList } from 'assistant/utils';
import { store,connectStore,EINSTEIN} from 'core/store';

export default class App extends ToolkitElement {

    currentTab;
    isLoading = false;
    _hasRendered = false;


    @api openaiKey;
    @api openaiAssistantId;

    // Tabs
    @track tabs = [];
    currentTab;

    connectedCallback(){
        //this.isLoading = true;
        /*store.dispatch(EINSTEIN.reduxSlice.actions.addTab({
            tab:{
                id:guid(),
                body:""
            }
        }));*/
    }

    renderedCallback(){
        this._hasRendered = true;

        if(this._hasRendered && this.template.querySelector('slds-tabset')){
            this.template.querySelector('slds-tabset').activeTabValue = this.currentTab?.id;
        }
    }
    
    @wire(connectStore, { store })
    storeChange({ einstein,application }) {
        const isCurrentApp = this.verifyIsActive(application.currentApplication);
        if(!isCurrentApp) return;
        //console.log('einstein',einstein);

        this.tabs = einstein.tabs;
        this.currentTab = einstein.currentTab;

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
            id:tabId,alias:this.alias
        }));
    }

    handleCloseTab = async (e) => {
        const tabId = e.detail.value;
        store.dispatch(EINSTEIN.reduxSlice.actions.removeTab({id:tabId,alias:this.alias}));
    }


    /** Methods **/


    /** Getters **/

    get pageClass(){//Overwrite
        return super.pageClass+' slds-p-around_small';
    }

    get formattedTabs(){
        return this.tabs.map((x,index) => {
            return {
                ...x,
                name:`Dialog ${index + 1}`,
                isCloseable:this.tabs.length > 1,
                class:classSet('slds-tabs_scoped__item').toString()
            }
        })
    }
}