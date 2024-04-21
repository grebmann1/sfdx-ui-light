import { LightningElement,api,wire } from 'lwc';
import { isEmpty, classSet,isNotUndefinedOrNull,runActionAfterTimeOut } from 'shared/utils';
import { connectStore,store,store_application } from 'shared/store';

import constant from "global/constant";

export default class Header extends LightningElement {

    
    @api currentApplicationName = 'App Name';
    @api currentTabName = 'Home';
    @api applications;
    @api isUserLoggedIn = false

    @api version = constant.version || '';

    @api isMenuSmall = false;


    @wire(connectStore, { store })
    applicationChange({application}) {
        // Toggle Menu
        if(isNotUndefinedOrNull(application.isMenuExpanded)){
            this.isMenuSmall = !application.isMenuExpanded;
        }
    }

    connectedCallback(){}
    

    /** Events **/

    handleSearch = (e) => {
        runActionAfterTimeOut(e.detail.value,(newValue) => {
            this.dispatchEvent(new CustomEvent("search", {
                detail:{ value:newValue },
                bubbles: true 
            }));
        });
    }

    redirectToWebsite = () => {
        chrome.tabs.create({
            url:'https://sf-toolkit.com/app',
            //url:'https://sf-toolkit.com/extension?sessionId='+window.sessionId+'&serverUrl=https://'+window.serverUrl
        }, tab => {});
    }
    
    handleToggle = () => {
        this.isMenuSmall = !this.isMenuSmall;
        if(this.isMenuSmall){
            store.dispatch(store_application.collapseMenu());
        }else{
            store.dispatch(store_application.expandMenu());
        }
    }
    /** **/
    

    /** Getters */

    get collapseClass(){
        return classSet("slds-grid button-container") //slds-show_medium
        .add({
            'slds-grid_align-end':!this.isMenuSmall,
            'slds-grid_align-center':this.isMenuSmall,
        })
        .toString()
    }

    get iconName(){
        return this.isMenuSmall?'utility:toggle_panel_left':'utility:toggle_panel_right';
    }
    
}