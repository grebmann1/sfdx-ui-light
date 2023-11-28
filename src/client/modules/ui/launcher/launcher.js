import LightningModal from 'lightning/modal';
import { api } from "lwc";

const application_mapping = [
    {
        id:"accessAnalyzer",
        name:"Access Analyzer",
        shortName:"AA",
        component:"accessAnalyzer/app",
        description:"Analyze access provided by profiles and permission sets",
        isDeletable:true
    }
]

export default class Launcher extends LightningModal {
    
    @api isUserLoggedIn;

    
    /** events **/
    selectApplication = (e) => {
        let application = application_mapping.find(x => x.id === e.currentTarget.dataset.key);
        if(application){
            this.dispatchEvent(new CustomEvent("select",{detail:application}));
        }
    }

    /** getters */

    get applications(){
        return application_mapping;
    }
}