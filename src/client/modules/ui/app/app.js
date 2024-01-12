import { LightningElement,track,api} from "lwc";
import {guid,isNotUndefinedOrNull,isElectronApp} from "shared/utils";
import { getExistingSession,saveSession,removeSession,directConnection } from "connection/utils";

/** Apps  **/
import connection_app from "connection/app";
import accessAnalyzer_app from "accessAnalyzer/app";
import code_app from "code/app";
import metadata_app from "metadata/app";
import extension_app from "extension/app";
import org_app from "org/app";
import sarif_app from "sarif/app";

const KNOWN_TYPE = new Set(["connection/app", "accessAnalyzer/app","extension/app","org/app","code/app","metadata/app","sarif/app"]);
const APP_MAPPING = {
    "connection/app": connection_app,
    "accessAnalyzer/app": accessAnalyzer_app,
    "code/app":code_app,
    "extension/app":extension_app,
    "org/app":org_app,
    "metadata/app":metadata_app,
    "sarif/app":sarif_app
};

export default class App extends LightningElement {

    @api mode;
    // for extension
    @api sessionId;
    @api serverUrl;




    connector;
    currentApplicationId;
    @track applications = [];

    async connectedCallback(){
        this.initMode();
    }

    /** Events */

    handleOpenApplication = async (e) => {
        const component = e.detail.component;
        const name = e.detail.name;
        this.connector = e.detail.value;
        if(this.applications.filter(x => x.component === component).length == 0){
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
        this.applications = this.applications.filter(x => x.component == 'connection/app');

        // Add new module
        if(this.applications.filter(x => x.component == 'org/app').length == 0){
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

    initMode = () => {

        this.connector      = null;
        this.applications   = [];
        this.applicationId  = null;

        if(this.isLightMode){
            this.load_lightMode();
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
                    x.classVisibility = "slds-show";
                }
            })
        this.applications = _applications;
    }

    /** Extension  **/
    load_lightMode = async () => {
        this.connector = await directConnection(this.sessionId,this.serverUrl);
        // Default Mode
        await this.loadModule({
            component:'extension/app',
            name:"Apps",
            isDeletable:false,
        });
        
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

        if(process.env.NODE_ENV === 'dev' /*&& isElectronApp() && this.isUserLoggedIn*/){
            /**await this.loadModule({
                component:'sarif/app',
                name:"Sarif Viewer",
                isDeletable:true
            });**/
        }
    }


    /** Getters */

    get isLightMode(){
        return this.mode === 'light';
    }

    get dynamicAppContainerClass(){
        return this.isUserLoggedIn?'app-container-logged-in':'app-container';
    }

    get isLogoutDisplayed(){
        return !this.isLightMode;
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
            classVisibility:"slds-hide",
        }}));
    }

    /** Dynamic Loading */
    

    loadModule = async (data) => {

        if (!KNOWN_TYPE.has(data.component)) {
            console.warn(`Unknown app type: ${data.component}`);
        }
    
        //let { default: appConstructor } = await APP_MAPPING[app_key]()
        let newApplication = {
            constructor:APP_MAPPING[data.component],
            id:guid(),
            name:data.name,
            isActive:true,
            class:"slds-context-bar__item slds-is-active",
            classVisibility:"slds-show",
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
