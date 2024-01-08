import { LightningElement,api,track} from "lwc";
import { isEmpty,formatBytes,isUndefinedOrNull,isNotUndefinedOrNull } from 'shared/utils';

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
        visualforceComponent:[],
        flow:[]
    };

    // Data
    @api data = {
        apex:null,
        trigger:null,
        visualforcePage:null,
        visualforceComponent:null,
        aura:null,
        lwc:null,
        flow:null
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
            ),
            this.load_data(
                "SELECT Id,NamespacePrefix,Description,FullName,DeveloperName,ActiveVersion.ApiVersion,ManageableState FROM FlowDefinition",
                "flow",
                this.process_flow
            )
        ]);

        // Clone data object to force refresh;
        let temp = this.data;
        this.data = null;
        this.data = temp;
    }

    process_apex = (key = 'apex') => {
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

        // Extra
        data['totalApiVersions'] = Object.keys(data.apiVersion).length;
        data['totalApiVersionsStepFormatted'] = this.calculateTotalApiVersionsStepFormatted(data['totalApiVersions']);

        this.data[key] = data;
        
    }
    

    process_lwc = (key = 'lwc') => {
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

        // Extra
        data['totalApiVersions'] = Object.keys(data.apiVersion).length;
        data['totalApiVersionsStepFormatted'] = this.calculateTotalApiVersionsStepFormatted(data['totalApiVersions']);
        
        this.data[key] = data;
    }

    process_aura = (key = 'aura') => {
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

        // Extra
        data['totalApiVersions'] = Object.keys(data.apiVersion).length;
        data['totalApiVersionsStepFormatted'] = this.calculateTotalApiVersionsStepFormatted(data['totalApiVersions']);

        
        this.data[key] = data;
    }

    process_flow = (key = 'flow') => {
        let records = this.filterRecords(key);
        
        let data = {
            "records":records,
            "apiVersion":{},
        }

        records.forEach(item => {
            // ActiveVersion -> API Version (not the definition ApiVersion)
            console.log('item.ActiveVersion.ApiVersion',item.ActiveVersion.ApiVersion);
            if(!data.apiVersion.hasOwnProperty(item.ActiveVersion.ApiVersion)){
                data.apiVersion[item.ActiveVersion.ApiVersion] = 1;
            }else{
                data.apiVersion[item.ActiveVersion.ApiVersion]++;
            }
        });

        // Extra
        data['totalApiVersions'] = Object.keys(data.apiVersion).length;
        data['totalApiVersionsStepFormatted'] = this.calculateTotalApiVersionsStepFormatted(data['totalApiVersions']);
        
        this.data[key] = data;
    }

    calculateTotalApiVersionsStepFormatted = (totalApiVersions) => {
        const ranking = [6,3,0];
        let currentRank = this.getCurrentRank(ranking,(item) => {
            return totalApiVersions > item;
        });
        return currentRank + 1;
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
        this.process_apex();
        this.process_apex('trigger');
        this.process_apex('visualforcePage');
        this.process_apex('visualforceComponent');
        this.process_lwc();
        this.process_aura();
        this.process_flow();
    }

   


    /** Getters */

    get isDataAvailable(){
        return isNotUndefinedOrNull(this.data.apex) // We just need to check the first (Apex)
    }

    // General

    get total_namespace(){
        return [...this.namespaces].length + 1;
    }

    get totalApiVersionsMarkDescription(){
        const descriptions = [' > 6 versions',' > 3 versions',' < 3 versions'];
        return descriptions[this.lwc_totalApiVersionsStep];
    }

    // Apex

    get apex_totalApexClassesInMB(){
        if(isUndefinedOrNull(this.data.apex)){
            return '0 MB';
        }
        return formatBytes(this.data.apex.totalLength,0);
    }

    // LWC 

    // Aura

    // Triggers

    // Visualforce Page

    // Visualforce Component

    // Flow


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