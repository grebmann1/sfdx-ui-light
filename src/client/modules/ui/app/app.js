import { LightningElement,track } from "lwc";
import {guid} from "shared/utils";
export default class App extends LightningElement {

    @track applications = [];
    @track currentApplicationId;

    async connectedCallback(){
        /** Home App */
        await this.loadModule({
            component:'org/App',
            name:"Home",
            isDeletable:false
        });
        await this.loadModule({
            component:'application/AccessAnalyzer',
            name:"Access Analyzer",
            isDeletable:false
        });
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
        const { default: DynamicImport } = await import(data.component);
        let newApplication = {
            constructor:DynamicImport,
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
