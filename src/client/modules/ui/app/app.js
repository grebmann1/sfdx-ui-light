import { LightningElement,track } from "lwc";
import {guid} from "shared/utils";
import connection_app from "connection/app";
import accessAnalyzer_app from "accessAnalyzer/app";
const KNOWN_TYPE = new Set(["connection/app", "accessAnalyzer/app"]);
const APP_MAPPING = {
    "connection/app": connection_app,
    "accessAnalyzer/app": accessAnalyzer_app,
};

export default class App extends LightningElement {

    @track applications = [];
    @track currentApplicationId;

    async connectedCallback(){
        /** Home App */
        await this.loadModule({
            component:'connection/app',
            name:"Home",
            isDeletable:false
        });
        if(process.env.NODE_ENV === 'development'){
            await this.loadModule({
                component:'accessAnalyzer/app',
                name:"Access Analyzer",
                isDeletable:false
            });
        }
        
    }

    /** Events */

    handleTabChange = (e) => {
        let applicationId = e.detail.id;
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

    handleNewApp = async (e) => {
        await this.loadModule(e.detail);
    };

    /** Dynamic Loading */

    get applicationPreFormatted(){
        return this.applications.map(x => ({...x,...{
            isActive:false,
            class:"slds-context-bar__item",
            classVisibility:"slds-hide",
        }}));
    }

    

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
            classVisibility:"slds-show"
        };
        let _applications = this.applicationPreFormatted;
            _applications.push(newApplication);
        this.applications = _applications;
        this.currentApplicationId = newApplication.id;
    };
}
