import LightningModal from 'lightning/modal';
import { api } from "lwc";
import {guid,isNotUndefinedOrNull,isElectronApp} from "shared/utils";

const application_mapping = [
    {
        id:"accessAnalyzer",
        name:"Access Analyzer",
        shortName:"AA",
        component:"accessAnalyzer/app",
        description:"Analyze access provided by profiles and permission sets",
        isDeletable:true
    },
    {
        id:"metadata",
        name:"Metadata",
        shortName:"AA",
        component:"metadata/app",
        description:"Create VSCode project, Review metadata, etc",
        isDeletable:true,
        isElectronOnly:true
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
        if(isElectronApp()) return application_mapping;

        return application_mapping.filter(x => !x.isElectronOnly);
    }
}