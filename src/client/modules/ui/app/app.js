import { LightningElement,track,api} from "lwc";
import {guid,isNotUndefinedOrNull,isElectronApp} from "shared/utils";
import { getExistingSession,saveSession,removeSession,directConnect,connect } from "connection/utils";

/** Apps  **/
import {KNOWN_TYPE,APP_MAPPING,DIRECT_LINK_MAPPING} from './modules';

const LIMITED = 'limited';

export default class App extends LightningElement {

    @api mode;
    // for Extension (Limited Mode)
    @api sessionId;
    @api serverUrl;
    // for Electron (Limited Mode)
    @api alias;


    isSalesforceCliInstalled = false;
    isJavaCliInstalled = false;
    isCommandCheckFinished = false;




    connector;
    currentApplicationId;
    @track applications = [];

    async connectedCallback(){
        if(isElectronApp()){
            await this.initElectron();
            this.isCommandCheckFinished = true;
        }
        this.initMode();
        
    }

    /** Events */

    handleOpenApplication = async (e) => {
        const component = e.detail.component;
        const name = e.detail.name;
        this.connector = e.detail.connector || this.connector;
        if(this.applications.filter(x => x.componentName === component).length == 0){
            await this.loadModule({
                component,
                name,
                isDeletable:true,
            });
        }else{
            this.loadSpecificTab(component);
        }
    }

    handleLogin = async (e) => {
        console.log('handleLogin',e.detail.value);
        this.connector = e.detail.value;
        const { instanceUrl,accessToken,version,refreshToken } = this.connector.conn;
        saveSession({
            ...this.connector.header,
            instanceUrl,
            accessToken,
            instanceApiVersion:version,
            refreshToken
        });
        // Reset first
        console.log('this.applications',this.applications);
        this.applications = this.applications.filter(x => x.componentName == 'connection/app');

        // Add new module
        if(this.applications.filter(x => x.componentName == 'org/app').length == 0){
            await this.loadModule({
                component:'org/app',
                name:"Org",
                isDeletable:false,
            });
        }
    }

    handleLogout = (e) => {
        e.preventDefault();
        removeSession();
        this.initMode();
        //location.reload();
    }

    handleTabChange = (e) => {
        let applicationId = e.detail.id;
        this.loadSpecificTab(applicationId);
    }

    handleTabDelete = (e) => {
        let applicationId = e.detail.id;
        let currentIndex = this.applications.findIndex(x => x.id == applicationId);
        this.applications = this.applications.filter(x => x.id != applicationId);

        // Select other
        let newApplicationId = this.applications[currentIndex - 1].id;
        this.loadSpecificTab(newApplicationId);
    }

    handleNewApp = async (e) => {
        await this.loadModule(e.detail);
    };


    /** Methods  */
    
    initElectron = async () => {
        console.log('Init Electron App');

        let {error, result} = await window.electron.ipcRenderer.invoke('util-checkCommands');
        if (error) {
            throw decodeError(error);
        }

        this.isSalesforceCliInstalled   = result.sfdx;
        this.isJavaCliInstalled         = result.java;
        console.log('result',result);
    }

    initMode = () => {

        this.connector      = null;
        this.applications   = [];
        this.applicationId  = null;

        if(this.isLimitedMode){
            this.load_limitedMode();
        }else{
            this.load_fullMode();
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
        
        await this.loadModule({
            component:'org/app',
            name:"Org",
            isDeletable:false,
        });
    }

    /** Website & Electron **/
    load_fullMode = async () => {
        this.connector = await getExistingSession();
        // Default Mode
        await this.loadModule({
            component:'connection/app',
            name:"Home",
            isDeletable:false,
        });

        if(this.isUserLoggedIn){
            await this.loadModule({
                component:'org/app',
                name:"Org",
                isDeletable:false,
            });
        }
        
        /** DEV MODE  */

        if(process.env.NODE_ENV === 'dev' && this.isUserLoggedIn /*&& isElectronApp() && this.isUserLoggedIn*/){
            /*await this.loadModule({
                component:'soql/app',
                name:"SOQL Explorer",
                isDeletable:true
            });*/
            await this.loadModule({
                component:'soql/app',
                name:"SOQL Builder",
                isDeletable:true
            });
        }

        /** Direct Opening Mode */
        const hash = (window.location.hash || '').replace('#','');
        console.log('hash -> ',hash);
        if(DIRECT_LINK_MAPPING.hasOwnProperty(hash)){
            await this.loadModule(DIRECT_LINK_MAPPING[hash]);
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


    get applicationPreFormatted(){
        return this.applications.map(x => ({...x,...{
            isActive:false,
            class:"slds-context-bar__item",
            classVisibility:"slds-hide slds-full-height",
        }}));
    }

    /** Dynamic Loading */
    

    loadModule = async (data) => {
        
        if (!KNOWN_TYPE.has(data.component)) {
            console.warn(`Unknown app type: ${data.component}`);
        }
        //let { default: appConstructor } = await APP_MAPPING[app_key]()
        let newApplication = {
            componentName:data.component,
            constructor:APP_MAPPING[data.component].module,
            id:guid(),
            name:data.name,
            isActive:true,
            class:"slds-context-bar__item slds-is-active",
            classVisibility:"slds-show slds-full-height",
            isFullHeight:APP_MAPPING[data.component].isFullHeight,
            isDeletable:data.isDeletable,
            attributes:{
                connector:this.connector
            }
        };
        let _applications = this.applicationPreFormatted;
            _applications.push(newApplication);
        this.applications = _applications;
        this.currentApplicationId = newApplication.id;
    };
}
