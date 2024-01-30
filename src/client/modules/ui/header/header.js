import { LightningElement,api,wire } from 'lwc';
import { isElectronApp, isEmpty, classSet,isNotUndefinedOrNull } from 'shared/utils';
import { store,store_application } from 'shared/store';

import ModalLauncher from "ui/modalLauncher";
import constant from "global/constant";

export default class Header extends LightningElement {

    
    @api currentApplicationName = 'App Name';
    @api currentTabName = 'Home';
    @api applications;
    @api isUserLoggedIn = false

    @api version = constant.version || '';

    @api isMenuSmall = false;

    connectedCallback(){}
    

    /** Events **/
    
    handleToggle = () => {
        this.isMenuSmall = !this.isMenuSmall;
        if(this.isMenuSmall){
            store.dispatch(store_application.collapseMenu());
        }else{
            store.dispatch(store_application.expandMenu());
        }
    }
    
    selectTab = (e) => {
        this.dispatchEvent(new CustomEvent("tabchange",{detail:{
            id:e.currentTarget.dataset.key
        }}));
    }

    deleteTab = (e) => {
        e.stopPropagation();
        this.dispatchEvent(new CustomEvent("tabdelete",{detail:{
            id:e.currentTarget.closest('li').dataset.key
        }}));
    }

    /** **/
    
    openLauncher = () => {
        ModalLauncher.open({
            isUserLoggedIn:this.isUserLoggedIn
        })
        .then((res) => {
            if(res){
                this.dispatchEvent(new CustomEvent("newapp",{detail:res}));
            }
        })
    }

    /** Getters */

    get formattedVersion(){
        return `${this.version}`;
    }

    get collapseClass(){
        return classSet("slds-grid button-container")
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