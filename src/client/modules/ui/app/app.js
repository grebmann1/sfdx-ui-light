import { LightningElement,track,api,wire } from "lwc";
import LightningAlert from 'lightning/alert';
import { guid,isNotUndefinedOrNull,isElectronApp,classSet,isUndefinedOrNull } from "shared/utils";
import { getExistingSession,saveSession,removeSession,directConnect,connect } from "connection/utils";
import { NavigationContext,CurrentPageReference,navigate } from 'lwr/navigation';
/** Apps  **/
import {APP_MAPPING,APP_LIST,DIRECT_LINK_MAPPING} from './modules';
/** Store **/
import { connectStore,store,store_application } from 'shared/store';

const LIMITED = 'limited';

export * as CONFIG from './modules';

export default class App extends LightningElement {
    @wire(NavigationContext)
    navContext;

    @api mode;
    @api redirectUrl;
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
    _isFullAppLoading = false;

    @track applications = [];

    currentApplicationId;


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
        console.log('pageRef',pageRef);
        switch(type){
            case 'home':
            case 'application':
                const formattedApplicationName = (attributes.applicationName || '').toLowerCase();
                const target = APP_LIST.find(x => x.path === formattedApplicationName);
                //console.log('handleNavigation',target,pageRef)
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
        this.initDragDrop();
    }

    /** Events */

    handleStartLogin = () => {
        console.log('handleStartLogin');
        this._isFullAppLoading = true;
    }

    handleStopLoading = () => {
        console.log('handleStopLoading');
        this._isFullAppLoading = false;
    }
    
    handleLogin = async (connector) => {
        if(isUndefinedOrNull(connector)){
            this._isFullAppLoading = false;
            return;
        }

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
        this._isFullAppLoading = false;
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
    

    handleRedirection = async (application) => {
        let url = application.redirectTo || '';

        if(url.startsWith('sftoolkit:')){
            /* Inner Navigation */
            const navigationConfig = url.replace('sftoolkit:','');
            navigate(this.navContext,JSON.parse(navigationConfig));
            return;
        }
        
        
        if(this.isUserLoggedIn && !url.startsWith('http')){
            // to force refresh in case it's not valid anymore : 
            await this.connector.conn.identity();
            console.log('this.connector.frontDoorUrl',this.connector);
            url = `${this.connector.frontDoorUrl}&retURL=${encodeURI(url)}`;
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

    initDragDrop = () => {
        window.addEventListener("dragover",function(e){e.preventDefault();},false);
        window.addEventListener("drop",function(e){e.preventDefault();},false);
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
        try{
            if(isElectronApp()){
                this.connector = await connect({alias:this.alias});
            }else{
                this.connector = await directConnect(this.sessionId,this.serverUrl);
            }

            if(this.redirectUrl){
                // Temporary solution, only used to open application for now. Might need to be improved to consider more functionalities.
                navigate(this.navContext,{type:'application',attributes:{applicationName:this.redirectUrl}});
            }else{
                navigate(this.navContext,{type:'application',attributes:{applicationName:'org'}}); // org is the default
            }
        }catch(e){
            await LightningAlert.open({
                message: e.message,//+'\n You might need to remove and OAuth again.',
                theme: 'error', // a red theme intended for error states
                label: 'Error!', // this is the header text
            });
        }
        
        // Default Mode
        /*await this.loadModule({
            component:'extension/app',
            name:"Apps",
            isDeletable:false,
        });*/

        // Should be loaded via login !
        //this.openSpecificModule('org/app'); 
        //this.openSpecificModule('code/app'); 
        this.pageHasLoaded = true;
        if(this.targetPage){
            console.log('targetPage',this.targetPage);
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

    get isFullAppLoading(){
        return this._isFullAppLoading || !this.pageHasLoaded;
    }
    
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

    get formattedAlias(){
        if(this.connector.header?.username == this.connector.header?.alias || isUndefinedOrNull(this.connector.header?.alias)){
            return 'No Alias'
        }
        return this.connector.header?.alias;
    }

    get loggedInMessage(){
        const isAliasMissing = this.connector.header?.username == this.connector.header?.alias || isUndefinedOrNull(this.connector.header?.alias);
        return `Logged in as ${this.connector.header?.userInfo?.display_name || 'User'} (${this.formattedAlias} : ${this.connector.header?.username}). `;
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
