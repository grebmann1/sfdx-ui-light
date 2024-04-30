import { LightningElement,api,track} from "lwc";
import { isUndefinedOrNull,isEmpty,guid,classSet } from "shared/utils";
import FeatureElement from 'element/featureElement';

export default class App extends FeatureElement {

    currentTab;
    isLoading = false;

    @api openaiKey;
    @api openaiAssistantId;

    @track tabs = [];

    connectedCallback(){
        this.addTab();
    }

    disconnectedCallback(){
        
    }

    /** Events **/

    handleCloseTab = (e) => {
        const tabId = e.detail.value;

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
        return this.tabs.map(x => ({
            ...x,
            isCloseable:this.tabs.length > 1,
            class:classSet('slds-tabs_scoped__item').add({'slds-is-active':x.id === this.currentTab}).toString()
        }))
    }
}