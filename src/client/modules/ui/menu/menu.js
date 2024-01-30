import { api,wire } from 'lwc';
import FeatureElement from 'element/featureElement';
import { isElectronApp, isEmpty, classSet,isNotUndefinedOrNull } from 'shared/utils';
import { CONFIG } from 'ui/app';
import { connectStore,store,store_application } from 'shared/store';

        
export default class Menu extends FeatureElement {
    
    @api isMenuSmall = false;
    @api isUserLoggedIn = false; // to enforce
    selectedItem = 'home';


    @wire(connectStore, { store })
    applicationChange({application}) {
       
        // Toggle Menu
        if(isNotUndefinedOrNull(application.isMenuExpanded) && isNotUndefinedOrNull(application.source)){
            this.isMenuSmall = !application.isMenuExpanded;
        }
    }

    connectedCallback(){}

    
    /** Events **/
    
    handleApplicationSelection = (e) => {
        e.stopPropagation();
        const target = e.detail.name || e.detail.value;
        this.selectedItem = target;
        store.dispatch(store_application.open(target));
    }

    handleRedirection = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const url = e.currentTarget.dataset.url
        store.dispatch(store_application.navigate(url));
    }

    handleToggle = () => {
        this.isMenuSmall = !this.isMenuSmall;
        if(this.isMenuSmall){
            store.dispatch(store_application.collapseMenu());
        }else{
            store.dispatch(store_application.expandMenu());
        }
    }


    /** Methods **/

    formatMenuItems = (items,hideMenuLabel = false) => {
        return items.map(x => {
            const menuLabel = isEmpty(x.menuLabel)? x.label : x.menuLabel;
            return {
                ...x,
                menuLabel:hideMenuLabel?null:menuLabel,
                //menuIcon:isEmpty(x.menuIcon)?null:x.menuIcon
            }
        });
    }


    /** Getters **/
    
    get collapseClass(){
        return classSet("slds-grid slds-p-top_x-small")
        .add({
            'slds-grid_align-end slds-p-right_x-small':!this.isMenuSmall,
            'slds-grid_align-center':this.isMenuSmall,
        })
        .toString()
    }
    
    get applicationLabel(){
        return this.isMenuSmall?'App':'Applications';
    }

    get connectionLabel(){
        return this.isMenuSmall?'Conn':'Connections';
    }
    
    get items(){
        return CONFIG?.APP_LIST || [];
    }
    
    get homes(){
        var filtered = this.formatMenuItems(this.items.filter(x => x.type === 'home'),this.isMenuSmall);
        if(!isElectronApp()){
            filtered = filtered.filter(x => !x.isElectronOnly);
        }
        if(!this.isUserLoggedIn){
            filtered = filtered.filter(x => x.isOfflineAvailable);
        }
        
        return filtered;
    }
    
    get applications(){
        var filtered = this.formatMenuItems(this.items.filter(x => x.type === 'application'));
        if(!isElectronApp()){
            filtered = filtered.filter(x => !x.isElectronOnly);
        }
        if(!this.isUserLoggedIn){
            filtered = filtered.filter(x => x.isOfflineAvailable);
        }
        
        return filtered;
    }
    
    get connections(){
        var filtered = this.formatMenuItems(this.items.filter(x => x.type === 'connection'));
        if(!isElectronApp()){
            filtered = filtered.filter(x => !x.isElectronOnly);
        }
        if(!this.isUserLoggedIn){
            filtered = filtered.filter(x => x.isOfflineAvailable);
        }
        
        return filtered;
    }

    get others(){
        return [
            {
                name:'extra_reportIssue',
                url:"https://github.com/grebmann1/sfdx-ui-light/issues",
                menuIcon:'utility:bug',
                menuLabel:this.isMenuSmall?'':'Report Issue'
            },
            {
                name:'extra_contribute',
                url:"https://github.com/grebmann1/sfdx-ui-light",
                menuIcon:'utility:recipe',
                menuLabel:this.isMenuSmall?'':'Contribute'
            },
            {
                name:'extra_release',
                url:"https://github.com/grebmann1/sfdx-ui-light/blob/master/release.md",
                menuIcon:'utility:alert',
                menuLabel:this.isMenuSmall?'':'Release Info'
            }
        ]
    }

    get iconName(){
        return this.isMenuSmall?'utility:toggle_panel_left':'utility:toggle_panel_right';
    }
}