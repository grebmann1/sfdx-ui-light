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
        isElectronOnly:false,
        isLoggedInRequired:true
    },
    {
        id:"metadata",
        name:"Metadata Explorer",
        shortName:"ME",
        component:"metadata/app",
        description:"Explorer Metadata from the Org",
        isDeletable:true,
        isElectronOnly:false,
        isLoggedInRequired:true
    },
    {
        id:"code",
        name:"Code Toolkit",
        shortName:"CT",
        component:"code/app",
        description:"Create VSCode project, Review metadata, etc",
        isDeletable:true,
        isElectronOnly:true,
        isLoggedInRequired:true
    },
    {
        id:"sarif",
        name:"Sarif Viewer",
        shortName:"SW",
        component:"sarif/app",
        description:"Read Sarif(json) file and display them (Code Analyser)",
        isDeletable:true,
        isElectronOnly:false,
        isLoggedInRequired:false
    }
]

export default class Launcher extends LightningModal {
    
    @api isUserLoggedIn;

    
    /** events **/
    selectApplication = (e) => {
        let application = application_mapping.find(x => x.id === e.currentTarget.dataset.key);
        if(application){
            if(application.isLoggedInRequired && !this.isUserLoggedIn){
                window.alert('You need to be connected ! ');
            }else{
                this.dispatchEvent(new CustomEvent("select",{detail:application}));
            }
            
        }
    }

    /** getters */

    get allApplications(){
        let records = application_mapping;
        if(!isElectronApp()){
            records = records.filter(x => !x.isElectronOnly);
        }
        return records;
    }

    get onlineApplications(){
        return this.allApplications.filter(x => x.isLoggedInRequired);
    }

    get offlineApplications(){
        return this.allApplications.filter(x => !x.isLoggedInRequired);
    }

}