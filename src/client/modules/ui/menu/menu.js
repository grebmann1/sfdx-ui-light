import { api,wire } from 'lwc';
import FeatureElement from 'element/featureElement';
import { isElectronApp, isEmpty, classSet,isNotUndefinedOrNull,isUndefinedOrNull } from 'shared/utils';
import { CONFIG } from 'ui/app';
import { connectStore,store,store_application } from 'shared/store';
import { NavigationContext, CurrentPageReference,generateUrl, navigate } from 'lwr/navigation';

        
export default class Menu extends FeatureElement {
    
    @api isUserLoggedIn = false; // to enforce t

    isMenuSmall = false;
    selectedItem = 'home';


    @wire(NavigationContext)
    navContext;


    @wire(connectStore, { store })
    applicationChange({application}) {
        // Toggle Menu
        if(isNotUndefinedOrNull(application.isMenuExpanded)){
            this.isMenuSmall = !application.isMenuExpanded;
        }
    }
    
    @wire(CurrentPageReference)
    handleNavigation(pageRef){
        if(isUndefinedOrNull(pageRef)) return;
        if(JSON.stringify(this._pageRef) == JSON.stringify(pageRef)) return;
        
        this.updateMenuItemFromNavigation(pageRef);
    }

    updateMenuItemFromNavigation = async ({attributes}) => {
        
        const {applicationName}  = attributes;
        if(this.selectedItem != applicationName){
            console.log('Update Menu - From Navigation');
            this.selectedItem = applicationName;
            this.updateSelectedItem();
        }
        
    }

    connectedCallback(){
        if(isElectronApp()){
            this.isMenuSmall = true; // by default it small for electron apps
            store.dispatch(store_application.collapseMenu());
        }
    }

    
    /** Events **/
    
    handleApplicationSelection = (e) => {
        e.stopPropagation();
        const target = e.detail.name || e.detail.value;
        if(!isEmpty(target)){
            navigate(this.navContext,{type:'application',attributes:{applicationName:target}});
        }else{
            navigate(this.navContext,{type:'home'});
        }
        this.selectedItem = target;
        
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

    updateSelectedItem = () => {
        let currentActiveItem   = this.template.querySelector('.slds-nav-vertical__item.slds-is-active');
        let newActiveItem       = this.template.querySelector(`.slds-nav-vertical__item[data-key="${this.selectedItem}"]`);
        if(currentActiveItem){
            currentActiveItem.classList.remove('slds-is-active');
        }
        if(newActiveItem){
            newActiveItem.classList.add('slds-is-active');
        }
    }

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

    generateFilter = (name,hideMenuLabel = false) => {
        var filtered = this.formatMenuItems(this.items.filter(x => x.type === name),hideMenuLabel);
        if(!isElectronApp()){
            filtered = filtered.filter(x => !x.isElectronOnly);
        }
        if(!this.isUserLoggedIn){
            filtered = filtered.filter(x => x.isOfflineAvailable);
        }

        return filtered;
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

    get isSmallToolDisplayed(){

    }
    
    get applicationLabel(){
        return this.isMenuSmall?'App':'Applications';
    }

    get toolsLabel(){
        return this.isMenuSmall?'Tools':'Tools';
    }

    get connectionLabel(){
        return this.isMenuSmall?'Conn':'Connections';
    }
    
    get items(){
        return CONFIG?.APP_LIST || [];
    }
    
    get homes(){
        return this.generateFilter('home',this.isMenuSmall);
    }
    
    get applications(){
        return this.generateFilter('application');
    }

    get documentations(){
        return this.generateFilter('documentation');
    }

    get tools(){
        return this.generateFilter('tool');
    }

    get hasTools(){
        return this.tools.length > 0;
    }

    get hasApplications(){
        return this.applications.length > 0;
    }
    
    get connections(){
        return this.generateFilter('connection');
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