import { LightningElement,track,api,wire } from "lwc";
import LightningAlert from 'lightning/alert';
import { guid,isNotUndefinedOrNull,isElectronApp,classSet,isUndefinedOrNull,forceVariableSave,isChromeExtension } from "shared/utils";
import { getExistingSession,saveSession,removeSession,directConnect,connect } from "connection/utils";
import { NavigationContext,CurrentPageReference,navigate } from 'lwr/navigation';
import { handleRedirect } from './utils';
/** Apps  **/
import {APP_LIST} from './modules';

/** Store **/
import { store as legacyStore } from 'shared/store';
import { connectStore,store,DOCUMENT,APPLICATION } from 'core/store';

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
    _isLoggedIn = false;

    // Full App Loading
    _isFullAppLoading = false;
    _fullAppLoadingMessage;

    @track applications = [];

    currentApplicationId;

   /* @api 
    get connector(){
        return window.connector;
    }
    set connector(value){
        window.connector = value;
    }*/


    @wire(connectStore, { store:legacyStore })
    applicationChange({application}) {
        console.log('application',application)
        // Open Application
        if(application.isOpen){
            const {target} = application;
            this.handleApplicationSelection(target);
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

    @wire(connectStore,{store})
    storeChange({application}){
        this._isFullAppLoading = application.isLoading;
        this._fullAppLoadingMessage = application.isLoadingMessage;

        if(this._isLoggedIn != application.isLoggedIn){
            this._isLoggedIn = application.isLoggedIn;
            if(application.isLoggedIn){
                this.handleLogin(application.connector);
            }else if(!application.isLoggedIn){
                this.handleLogout();
            }
        }
        
    }

    @wire(CurrentPageReference)
    handleNavigation(pageRef){
        this.targetPage = pageRef;
        if(!this.pageHasLoaded) return;
        const {type, state} = pageRef;
        switch(type){
            case 'home':
            case 'application':
                const formattedApplicationName = (state.applicationName || '').toLowerCase();
                const target = APP_LIST.find(x => x.path === formattedApplicationName);
                console.log('handleNavigation',target);
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

    handleLogin = async (connector) => {
        console.log('#### handleLogin ####');
        if(isUndefinedOrNull(connector)){
            store.dispatch(APPLICATION.reduxSlice.actions.stopLoading());
            return;
        }

        const { instanceUrl,accessToken,version,refreshToken } = connector.conn;
        saveSession({
            ...connector.configuration,
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
        store.dispatch(APPLICATION.reduxSlice.actions.stopLoading());

        // Load Cached data
        store.dispatch(DOCUMENT.reduxSlices.RECENT.actions.loadFromStorage({
            alias:this.connector.configuration.alias
        }));
    }

    handleLogout = () => {
        // Reset Applications
        this.applications = this.applications.filter(x => x.name == 'home/app');
        navigate(this.navContext,{type:'application',state:{applicationName:'home'}});
    }

    handleLogoutClick = async (e) => {
        e.preventDefault(); // currentApplication
        
        await store.dispatch(APPLICATION.reduxSlice.actions.logout());
        await removeSession();
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
            url = `${this.connector.frontDoorUrl}&retURL=${encodeURI(url)}`;
        }

        if(isElectronApp()){
            window.location = url;
        }else{
            window.open(url,'_blank');
        }
    }

    handleApplicationSelection = async (target) => {
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
        let url = isChromeExtension()?'/manifest.json':'/version';
        const data = await (await fetch(url)).json();
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
        window.isLimitedMode = this.isLimitedMode; // To hide 

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
                    x.attributes.isActive = true;
                    // Update the store
                    store.dispatch(APPLICATION.reduxSlice.actions.updateCurrentApplication({
                        application:x.name
                    }));
                }else{
                    x.attributes.isActive = false;
                }
            })
        this.applications = _applications;
    }

    /** Extension & Electron Org Window  **/
    load_limitedMode = async () => {
        try{
            if(isElectronApp()){
                await connect({alias:this.alias});
            }else{
                await directConnect(this.sessionId,this.serverUrl);
            }

            if(this.redirectUrl){
                // This method use LWR redirection or window.location based on the url ! 
                handleRedirect(this.navContext,this.redirectUrl);
            }else{
                navigate(this.navContext,{type:'application',state:{applicationName:'org'}}); // org is the default
            }
        }catch(e){
            console.error(e);
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
            this.handleNavigation(this.targetPage);
        }
    }
    

    /** Website & Electron **/
    load_fullMode = async () => {
        if(isNotUndefinedOrNull(this.sessionId) && isNotUndefinedOrNull(this.serverUrl)){
            await directConnect(this.sessionId,this.serverUrl);
        }else{
            await getExistingSession(); // await connect({alias:'acet-dev'})//
        }
        
        if(this.redirectUrl){
            // This method use LWR redirection or window.location based on the url ! 
            handleRedirect(this.navContext,this.redirectUrl);
        }else{
            // Default Mode
            this.loadModule('home/app',true);

        }

        this.pageHasLoaded = true;
        if(this.targetPage){
            this.handleNavigation(this.targetPage);
        }
    }


    /** Getters */

    get connector(){
        return store.getState()?.application?.connector;
    }

    get isFullAppLoading(){
        return this._isFullAppLoading || !this.pageHasLoaded;
    }

    get fullAppLoadingMessageFormatted(){
        return this._fullAppLoadingMessage || null;
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
        if(isUndefinedOrNull(this.connector?.configuration?.alias)){
            return 'No Alias : '
        }else if(this.connector?.configuration?.username == this.connector?.configuration?.alias){
            return '';
        }else{
            return `${this.connector.configuration?.alias} : `;
        }
    }

    get loggedInMessage(){
        return `Logged in as ${this.connector?.configuration?.userInfo?.display_name || 'User'} (${this.formattedAlias}${this.connector?.configuration?.username}). `;
    }

    get isUserLoggedIn(){
        return this._isLoggedIn;
    }

    get menuClass(){
        return classSet('l-cell-content-size home__navigation slds-show_small slds-is-relative')
        .add({
            'slds-hide':this.isMenuHidden,
            'slds-menu-collapsed':this.isMenuCollapsed
        })
        .toString()
    }


    get applicationPreFormatted(){
        return this.applications.map(x => ({
            ...x,
            ...{
                isActive:false,
                class:"slds-context-bar__item",
                classVisibility:"slds-hide slds-full-height",
            }
        }));
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
                    applicationName:settings.name,
                    //connector:this.connector
                    isActive:true
                }
            };
            // Store current Application in the store
            store.dispatch(APPLICATION.reduxSlice.actions.updateCurrentApplication({
                application:settings.name
            }));
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
