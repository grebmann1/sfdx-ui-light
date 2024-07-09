import { LightningElement,api,track} from "lwc";
import { isUndefinedOrNull,isNotUndefinedOrNull,isEmpty,guid,classSet } from "shared/utils";
import ToolkitElement from 'core/toolkitElement';
import { getThreadList,deleteThreadList } from 'assistant/utils';

export default class App extends ToolkitElement {

    currentTab;
    isLoading = false;

    @api openaiKey;
    @api openaiAssistantId;

    @track tabs = [];

    connectedCallback(){
        this.loadExistingThreads();
    }

    disconnectedCallback(){
        
    }

    /** Events **/

    handleCloseTab = (e) => {
        const tabId = e.detail.value;
        const threadId = this.tabs.find(x => x.id == tabId).threadId;
        if(isNotUndefinedOrNull(threadId)){
            deleteThreadList(threadId);
        }

        const currentTabId = this.template.querySelector('slds-tabset').activeTabValue;
        this.tabs = this.tabs.filter(x => x.id != tabId);
        const latestTab = this.tabs[this.tabs.length - 1];
        if(currentTabId == tabId){
            this.template.querySelector('slds-tabset').activeTabValue = latestTab.id;
        }
        this.dispatchEvent(new CustomEvent("change", {detail:{value:'delete',type:'tab'},bubbles: true }));
    }

    handleSelectTab = (e) => {    
        this.currentTab = e.target.value;
    }

    handleAddTab = (e) => {
        const newTabId = this.addTab();
        window.setTimeout(() => {
            this.template.querySelector('slds-tabset').activeTabValue = newTabId;
        },100);
    }


    /** Methods **/

    loadExistingThreads = async() => {
        const threads = await getThreadList();
        if(isUndefinedOrNull(threads) || threads.length == 0){
            this.handleAddTab();
        }else{
            this.tabs = threads.map(threadId => ({
                id:guid(),
                name:'Dialog',
                threadId
            }));
            //console.log('this.tabs',this.tabs);
            window.setTimeout(() => {
                this.template.querySelector('slds-tabset').activeTabValue = this.tabs[0].id;
            },100);
        }
    }

    addTab = () => {
        const newTab = this.createTab();
        this.currentTab = newTab.id;
        this.tabs.push(newTab);
        return newTab.id;
    }

    createTab = () => {
        return {
            id:guid(),
            name:'Dialog'
        }
    }



    /** Getters **/

    get formattedTabs(){
        return this.tabs.map((x,index) => ({
            ...x,
            isCloseable:this.tabs.length > 1,
            name:`Dialog ${index + 1}`,
            class:classSet('slds-tabs_scoped__item').add({'slds-is-active':x.id === this.currentTab}).toString()
        }))
    }
}