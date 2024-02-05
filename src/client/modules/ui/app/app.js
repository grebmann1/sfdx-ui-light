import { LightningElement,track,api,wire } from "lwc";
import { guid,isNotUndefinedOrNull,isElectronApp,classSet,isUndefinedOrNull } from "shared/utils";
import { getExistingSession,saveSession,removeSession,directConnect,connect } from "connection/utils";
import { NavigationMixin,CurrentPageReference } from 'lwr/navigation';
/** Apps  **/
import {APP_MAPPING,APP_LIST,DIRECT_LINK_MAPPING} from './modules';
/** Store **/
import { connectStore,store,store_application } from 'shared/store';

const LIMITED = 'limited';

export * as CONFIG from './modules';

export default class App extends LightningElement {

    @api mode;
    // for Extension (Limited Mode)
    @api sessionId;
    @api serverUrl;
    // for Electron (Limited Mode)
    @api alias;


    version;
    isSalesforceCliInstalled = false;
    isJavaCliInstalled = false;
    isCommandCheckFinished = false;
    isMenuHidden = false;
    isMenuCollapsed = false;
    pageHasLoaded = false;
    targetPage;

    @track applications = [];

    get currentApplicationId(){
        return this._currentApplicationId;
    }
    set currentApplicationId(value){
        this._currentApplicationId = value;
        //this.assignNewHash(value);
    }


    @api 
    get connector(){
        return window.connector;
    }
    set connector(value){
        window.connector = value;
    }

    @wire(connectStore, { store })
    applicationChange({application}) {
        // Open Application
        if(application.isOpen){
            const {target} = application;
            this.handleApplicationSelection(target);
        }

        if(application.isLoggedIn){
            this.handleLogin(application.connector);
        }else if(application.isLoggedOut){
            this.connector = null;
        }

        // Toggle Menu
        if(isNotUndefinedOrNull(application.isMenuDisplayed)){
           this.isMenuHidden = !application.isMenuDisplayed;
        }else if(isNotUndefinedOrNull(application.isMenuExpanded)){
            this.isMenuCollapsed = !application.isMenuExpanded;
        }

        // Redirect
        if(application.redirectTo){
            this.handleRedirection(application);
        }
    }

    @wire(CurrentPageReference)
    handleNavigation(pageRef){
        this.targetPage = pageRef;
        if(!this.pageHasLoaded) return;
        const {type, attributes} = pageRef;
        switch(type){
            case 'home':
            case 'application':
                
                const target = APP_LIST.find(x => x.path === attributes.applicationName);
                console.log('handleNavigation',target)
                if(isNotUndefinedOrNull(target)){
                    this.handleApplicationSelection(target.name);
                }else{
                    this.handleApplicationSelection('home/app');
                }
            break;
        }
    }


    

    connectedCallback(){
        this.init();
    }

    init = async () => {
        if(isElectronApp()){
            await this.initElectron();
            this.isCommandCheckFinished = true;
        }
        this.loadVersion();
        this.initMode();
    }

    /** Events */
    
    handleLogin = async (connector) => {
        this.connector = connector;
        const { instanceUrl,accessToken,version,refreshToken } = this.connector.conn;
        saveSession({
            ...this.connector.header,
            instanceUrl,
            accessToken,
            instanceApiVersion:version,
            refreshToken
        });
        // Reset first
        this.applications = this.applications.filter(x => x.name == 'home/app');
        
        // Add new module
        if(this.applications.filter(x => x.name == 'org/app').length == 0){
            this.openSpecificModule('org/app');
        }
    }

    handleLogout = (e) => {
        e.preventDefault();
        store.dispatch(store_application.logout());

        removeSession();
        this.initMode();
        //location.reload();
    }

    handleTabChange = (e) => {
        let applicationId = e.detail.id;
        this.loadSpecificTab(applicationId);
    }

    handleTabDelete = (e) => {
        this.applications = this.applications.filter(x => x.id != e.detail.id);
    }

    handleNewApp = async (e) => {
        this.loadModule(e.detail);
    };
    

    handleRedirection = (application) => {
        let url = application.redirectTo || '';

        if(this.isUserLoggedIn && !url.startsWith('http')){
            url = `${this.connector.header.sfdxAuthUrl}&retURL=${encodeURI(url)}`;
        }

        if(isElectronApp()){
            window.location = url;
        }else{
            window.open(url,'_blank');
        }
    }

    handleApplicationSelection = async (target) => {
        //console.log('this.applications',this.applications.map(x => x.name),target);
        if(this.applications.filter(x => x.name === target).length == 0){
            this.loadModule(target);
        }else{
            const existingAppId = this.applications.find(x => x.name === target).id;
            this.loadSpecificTab(existingAppId);
        }
    }


    /** Methods  */
    
    assignNewHash = (value) => {
        if(isUndefinedOrNull(value)) return;

        const app = this.applications.find(x => x.id === value);
        if(app && APP_MAPPING.hasOwnProperty(app.name) && isNotUndefinedOrNull(APP_MAPPING[app.name].path)){
            window.location.hash = APP_MAPPING[app.name].path;
        }
    }
    
    openSpecificModule = async (target) => {
        this.handleApplicationSelection(target);
    }
    
    loadVersion = async () => {
        const data = await (await fetch('/version')).json();
        this.version = `v${data.version || '1.0.0'}`;
    }
    
    initElectron = async () => {
        let {error, result} = await window.electron.ipcRenderer.invoke('util-checkCommands');
        if (error) {
            throw decodeError(error);
        }

        this.isSalesforceCliInstalled   = result.sfdx;
        this.isJavaCliInstalled         = result.java;
    }

    initMode = async () => {
        console.log('init mode');
        window.isLimitedMode = this.isLimitedMode; // To hide 

        this.connector      = null;
        this.applications   = [];
        this.applicationId  = null;

        if(this.isLimitedMode){
            await this.load_limitedMode();
        }else{
            await this.load_fullMode();
        }
    }

    loadSpecificTab = (applicationId) => {
        this.currentApplicationId = applicationId;
        let _applications = this.applicationPreFormatted;
            _applications.forEach(x => {
                if(x.id == applicationId){
                    x.isActive = true;
                    x.class = "slds-context-bar__item slds-is-active";
                    x.classVisibility = "slds-show slds-full-height";
                }
            })
        this.applications = _applications;
    }

    /** Extension & Electron Org Window  **/
    load_limitedMode = async () => {
        if(isElectronApp()){
            this.connector = await connect({alias:this.alias});
        }else{
            this.connector = await directConnect(this.sessionId,this.serverUrl);
        }
        
        // Default Mode
        /*await this.loadModule({
            component:'extension/app',
            name:"Apps",
            isDeletable:false,
        });*/

        // Should be loaded via login !
        this.openSpecificModule('org/app'); 
        this.pageHasLoaded = true;
        if(this.targetPage){
            this.handleNavigation(this.targetPage);
        }
    }

    /** Website & Electron **/
    load_fullMode = async () => {
        this.connector = await getExistingSession(); // await connect({alias:'acet-dev'})//
        // Default Mode
        this.loadModule('home/app',true);

        if(this.isUserLoggedIn){
            // Should be loaded via login !
            //this.openSpecificModule('org/app');
        }
        
        /** DEV MODE  */

        if(process.env.NODE_ENV === 'dev' && this.isUserLoggedIn /*&& this.isUserLoggedIn*/){
            //await this.loadModule('editor/app');
            /*await this.loadModule({
                component:'soql/app',
                name:"SOQL Builder",
                isDeletable:true
            });*/
        }

        /** Direct Opening Mode */
        const hash = (window.location.hash || '').replace('#','');
        //console.log('hash -> ',hash);
        if(DIRECT_LINK_MAPPING.hasOwnProperty(hash)){
            //await this.loadModule(DIRECT_LINK_MAPPING[hash]);
        }

        this.pageHasLoaded = true;
        if(this.targetPage){
            this.handleNavigation(this.targetPage);
        }
    }


    /** Getters */
    
    get isSFDXMissing(){
        return isElectronApp() && !this.isSalesforceCliInstalled && this.isCommandCheckFinished;
    }

    get isLimitedMode(){
        return this.mode === LIMITED;
    }

    get dynamicAppContainerClass(){
        return this.isUserLoggedIn?'app-container-logged-in slds-full-height':'app-container slds-full-height';
    }

    get isLogoutDisplayed(){
        return !this.isLimitedMode;
    }

    get loggedInMessage(){
        return `Logged in as ${this.connector.header?.userInfo?.display_name || 'User'} (${this.connector.header?.alias || 'No Alias'} : ${this.connector.header?.username}). `;
    }

    get isUserLoggedIn(){
        return isNotUndefinedOrNull(this.connector);
    }

    get menuClass(){
        return classSet('l-cell-content-size home__navigation slds-show_small')
        .add({
            'slds-hide':this.isMenuHidden,
            'slds-menu-collapsed':this.isMenuCollapsed
        })
        .toString()
    }


    get applicationPreFormatted(){
        return this.applications.map(x => ({...x,...{
            isActive:false,
            class:"slds-context-bar__item",
            classVisibility:"slds-hide slds-full-height",
        }}));
    }

    /** Dynamic Loading */
    

    loadModule = (target,isFirst = false) => {
        const settings = APP_LIST.find(x => x.name === target);
        
        if (!settings) {
            console.warn(`Unknown app type: ${target}`);
            // Run Manual Mode
        }else{
            const application = {
                name:settings.name,
                constructor:settings.module,
                path:settings.path,
                id:guid(),
                label:settings.label,
                isActive:true,
                class:"slds-context-bar__item slds-is-active",
                classVisibility:"slds-show slds-full-height",
                isFullHeight:settings.isFullHeight,
                isDeletable:settings.isDeletable,
                requireConnection:!settings.isOfflineAvailable,
                isTabVisible:settings.isTabVisible,
                attributes:{
                    //connector:this.connector
                }
            };
            let _applications = this.applicationPreFormatted;
            if(isFirst){
                _applications.unshift(application);
            }else{
                _applications.push(application);
            }
                
            this.applications = _applications;
            this.currentApplicationId = application.id;
        }
        
    };
}
