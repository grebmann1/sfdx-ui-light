import { LightningElement,api,track} from "lwc";
import { isEmpty,formatBytes,isUndefinedOrNull } from 'shared/utils';

const DEFAULT_NAMESPACE = '__default__';

export default class Code extends LightningElement {

    @api connector;
    @api namespaceFiltering_value = DEFAULT_NAMESPACE;

    // Records
    @track records = {
        apex:[],
        trigger:[],
        lwc:[],
        aura:[],
        visualforcePage:[],
        visualforceComponent:[]
    };

    // Data
    @api data = {
        apex:null,
        trigger:null,
        visualforcePage:null,
        visualforceComponent:null,
        aura:null,
        lwc:null
    };
    namespaces = new Set();

    async connectedCallback(){
        this.load_allData();
    }

    /** Methods */


    load_data = async (query,key,callback) => {
        let queryExec = this.connector.conn.tooling.query(query);
        this.records[key] = await queryExec.run({ responseTarget:'Records',autoFetch : true, maxFetch : 10000 }) || [];
        
        // Extract namespace
        this.records[key].forEach(x => {
            this.namespaces.add(x.NamespacePrefix);
        });

        callback(key);
    }
    


    load_allData = async () => {
        let results = await Promise.all([
            this.load_data(
                "SELECT Id,ApiVersion,NamespacePrefix,LengthWithoutComments,Status FROM ApexClass",
                "apex",
                this.process_apex
            ),
            this.load_data(
                "SELECT Id,ApiVersion,NamespacePrefix FROM ApexPage",
                "visualforcePage",
                this.process_apex
            ),
            this.load_data(
                "SELECT Id,ApiVersion,NamespacePrefix FROM ApexComponent",
                "visualforceComponent",
                this.process_apex
            ),
            this.load_data(
                "SELECT Id,ApiVersion,NamespacePrefix,Status FROM ApexTrigger",
                "trigger",
                this.process_apex
            ),
            this.load_data(
                "SELECT Id,ApiVersion,NamespacePrefix,ManageableState FROM LightningComponentBundle",
                "lwc",
                this.process_lwc
            ),
            this.load_data(
                "SELECT Id,ApiVersion,NamespacePrefix FROM AuraDefinitionBundle",
                "aura",
                this.process_aura
            )
        ]);

        // Clone data object to force refresh;
        let temp = this.data;
        this.data = null;
        this.data = temp;
    }

    process_apex = (key) => {
        let records = this.filterRecords(key);
        let data = {
            "records":records,
            "apiVersion":{},
            "totalLength":0
        }

        records.forEach(item => {
            // ApiVersion
            if(!data.apiVersion.hasOwnProperty(item.ApiVersion)){
                data.apiVersion[item.ApiVersion] = 1;
            }else{
                data.apiVersion[item.ApiVersion]++;
            }

            // totalLength
            if(item.LengthWithoutComments > 0){
                data.totalLength += item.LengthWithoutComments
            }
        });        

        this.data[key] = data;
    }
    

    process_lwc = (key) => {
        let records = this.filterRecords(key);
        
        let data = {
            "records":records,
            "apiVersion":{},
            "manageableState":{},
        }

        records.forEach(item => {
            // ApiVersion
            if(!data.apiVersion.hasOwnProperty(item.ApiVersion)){
                data.apiVersion[item.ApiVersion] = 1;
            }else{
                data.apiVersion[item.ApiVersion]++;
            }
            // ManageableState
            if(!data.manageableState.hasOwnProperty(item.ManageableState)){
                data.manageableState[item.ManageableState] = 1;
            }else{
                data.manageableState[item.ManageableState]++;
            }
        });

        
        this.data[key] = data;
    }

    process_aura = (key) => {
        let records = this.filterRecords(key);
        
        let data = {
            "records":records,
            "apiVersion":{},
        }

        records.forEach(item => {
            // ApiVersion
            if(!data.apiVersion.hasOwnProperty(item.ApiVersion)){
                data.apiVersion[item.ApiVersion] = 1;
            }else{
                data.apiVersion[item.ApiVersion]++;
            }
        });

        
        this.data[key] = data;
    }

    filterRecords = (key) => {
        if(!this.records.hasOwnProperty(key)) return [];

        let records = [...this.records[key]];
        if(this.namespaceFiltering_value != DEFAULT_NAMESPACE){
            records = records.filter(x => x.NamespacePrefix === this.namespaceFiltering_value)
        } 
        return records;
    }

    getCurrentRank = (mapping,check) => {
        for (let i = 0; i < mapping.length; i++) {
            if(check(mapping[i])){
                return i;
            }
        }
        return mapping.length - 1;
    }

    process_all = () => {
        this.process_apex('apex');
        this.process_apex('trigger');
        this.process_apex('visualforcePage');
        this.process_apex('visualforceComponent');
        this.process_lwc('lwc');
        this.process_aura('aura');
    }

   


    /** Getters */

    // General

    get total_namespace(){
        return [...this.namespaces].length + 1;
    }

    // Apex

    get apex_totalApexClasses(){
        if(isUndefinedOrNull(this.data.apex)){
            return 0;
        }
        return this.data.apex.records.length;
    }

    get apex_totalApexClassesInMB(){
        if(isUndefinedOrNull(this.data.apex)){
            return '0 MB';
        }
        return formatBytes(this.data.apex.totalLength,0);
    }

    get apex_totalApiVersions(){
        if(isUndefinedOrNull(this.data.apex)){
            return 0;
        }
        return Object.keys(this.data.apex.apiVersion).length;
    }

    get apex_totalApiVersionsStep(){
        const ranking = [6,3,0];
        let currentRank = this.getCurrentRank(ranking,(item) => {
            return this.apex_totalApiVersions > item;
        });

        return currentRank;
    }

    get apex_totalApiVersionsStepFormatted(){
        return this.apex_totalApiVersionsStep + 1;
    }
    

    get apex_totalApiVersionsMark(){
        return this.apex_totalApiVersions;
    }

    get apex_totalApiVersionsMarkDescription(){
        const descriptions = [' > 6 versions',' > 3 versions',' < 3 versions'];
        return descriptions[this.apex_totalApiVersionsStep];
    }

    // LWC 

    get lwc_totalComponents(){
        if(isUndefinedOrNull(this.data.lwc)){
            return 0;
        }
        return this.data.lwc.records.length;
    }

    get lwc_totalApiVersions(){
        if(isUndefinedOrNull(this.data.lwc)){
            return 0;
        }
        return Object.keys(this.data.lwc.apiVersion).length;
    }

    get lwc_totalApiVersionsStep(){
        const ranking = [6,3,0];
        let currentRank = this.getCurrentRank(ranking,(item) => {
            return this.lwc_totalApiVersions > item;
        });

        return currentRank;
    }

    get lwc_totalApiVersionsStepFormatted(){
        return this.lwc_totalApiVersionsStep + 1;
    }
    

    get lwc_totalApiVersionsMark(){
        return this.lwc_totalApiVersions;
    }

    get lwc_totalApiVersionsMarkDescription(){
        const descriptions = [' > 6 versions',' > 3 versions',' < 3 versions'];
        return descriptions[this.lwc_totalApiVersionsStep];
    }

    // Aura

    get aura_totalComponents(){
        if(isUndefinedOrNull(this.data.aura)){
            return 0;
        }
        return this.data.aura.records.length;
    }

    // Triggers

    get triggers_totalComponents(){
        if(isUndefinedOrNull(this.data.trigger)){
            return 0;
        }
        return this.data.trigger.records.length;
    }

    // Visualforce Page

    get visualforcePage_totalComponents(){
        if(isUndefinedOrNull(this.data.visualforcePage)){
            return 0;
        }
        return this.data.visualforcePage.records.length;
    }

    // Visualforce Component

    get visualforceComponent_totalComponents(){
        if(isUndefinedOrNull(this.data.visualforceComponent)){
            return 0;
        }
        return this.data.visualforceComponent.records.length;
    }

    
    
 

    /** Events */

  
    
    /** Filters */
    

    get namespaceFiltering_options(){
        return [...this.namespaces].map(x => ({label:x,value:x})).concat([{label:'Default',value:DEFAULT_NAMESPACE}]);
    }

    namespaceFiltering_handleChange = (e) => {
        this.namespaceFiltering_value = e.detail.value;
        this.process_all();
    }

}