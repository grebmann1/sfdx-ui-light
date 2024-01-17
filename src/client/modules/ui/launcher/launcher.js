import LightningModal from 'lightning/modal';
import { api } from "lwc";
import { isElectronApp } from "shared/utils";

const application_mapping = [
    {
        id:"accessAnalyzer",
        name:"Access Analyzer",
        shortName:"AA",
        component:"accessAnalyzer/app",
        description:"Analyze access provided by profiles and permission sets",
        isDeletable:true,
        isElectronOnly:false
    },
    {
        id:"metadata",
        name:"Metadata Explorer",
        shortName:"ME",
        component:"metadata/app",
        description:"Explorer Metadata from the Org",
        isDeletable:true,
        isElectronOnly:false
    },
    {
        id:"code",
        name:"Code Toolkit",
        shortName:"CT",
        component:"code/app",
        description:"Create VSCode project, Review metadata, etc",
        isDeletable:true,
        isElectronOnly:true
    },
    {
        id:"doc",
        name:"Documentation Explorer",
        shortName:"DE",
        component:"doc/app",
        description:"Explore Salesforce Documentation",
        isDeletable:true,
        isElectronOnly:false,
        isOfflineAvailable:true
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

    get onlineApplication(){
        return this.applications.filter(x => !x.isOfflineAvailable);
    }

    get offlineApplications(){
        return this.applications.filter(x => x.isOfflineAvailable);
    }
}