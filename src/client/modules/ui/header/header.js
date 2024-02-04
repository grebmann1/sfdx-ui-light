import { LightningElement,api,wire } from 'lwc';
import { isElectronApp, isEmpty, classSet,isNotUndefinedOrNull } from 'shared/utils';
import { connectStore,store,store_application } from 'shared/store';
import { NavigationContext, generateUrl, navigate } from 'lwr/navigation';

import ModalLauncher from "ui/modalLauncher";
import constant from "global/constant";

export default class Header extends LightningElement {

    
    @api currentApplicationName = 'App Name';
    @api currentTabName = 'Home';
    @api applications;
    @api isUserLoggedIn = false

    @api version = constant.version || '';

    @api isMenuSmall = false;

    @wire(NavigationContext)
    navContext;

    @wire(connectStore, { store })
    applicationChange({application}) {
        // Toggle Menu
        if(isNotUndefinedOrNull(application.isMenuExpanded)){
            this.isMenuSmall = !application.isMenuExpanded;
        }
    }

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
        console.log('e.currentTarget.dataset.path',e.currentTarget.dataset.path);
        const target = e.currentTarget.dataset.path;
        if(!isEmpty(target)){
            navigate(this.navContext,{type:'application',attributes:{applicationName:target}});
        }else{
            navigate(this.navContext,{type:'home'});
        }
    }

    deleteTab = (e) => {
        e.stopPropagation();
        const applicationId = e.currentTarget.closest('li').dataset.key;
        const filteredTabs  = this.applications.filter(x => x.isTabVisible);
        const index = filteredTabs.findIndex(x => x.id === applicationId);
        // Delete app
        this.dispatchEvent(new CustomEvent("tabdelete",{detail:{id:applicationId}}));
        // Navigate
        if(index > 0){
            navigate(this.navContext,{type:'application',attributes:{applicationName:filteredTabs[index - 1].path} });
        }else{
            navigate(this.navContext,{type:'home'});
        }
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
        return classSet("slds-grid button-container slds-show_medium")
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