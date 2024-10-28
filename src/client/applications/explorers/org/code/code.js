import { LightningElement,api,track} from "lwc";
import ToolkitElement from 'core/toolkitElement';

import { isEmpty,formatBytes,isUndefinedOrNull,isNotUndefinedOrNull } from 'shared/utils';


const DEFAULT_NAMESPACE = 'Default';
const ALL_NAMESPACE     = 'All';

export default class Code extends ToolkitElement {

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

    connectedCallback(){
        this.load_allData();
    }

    /** Methods */

    load_data = async (query,key,callback,useTooling = false) => {
        try{
            const conn = useTooling?this.connector.conn.tooling:this.connector.conn;
            let queryExec = conn.query(query);
            this.records[key] = await queryExec.run({ responseTarget:'Records',autoFetch : true, maxFetch : 10000 }) || [];
            
            // Add namespace
            this.records[key].forEach(x => {
                this.namespaces.add(x.NamespacePrefix || DEFAULT_NAMESPACE);
            });
        }catch(e){
            console.error(e);
            this.records[key] = [];
        }
        

        callback(key);
    }
    


    load_allData = async () => {
        await Promise.all([
            this.load_data(
                "SELECT Id,ApiVersion,NamespacePrefix,LengthWithoutComments,Status FROM ApexClass",
                "apex",
                this.process_apex,
                true
            ),
            this.load_data(
                "SELECT Id,ApiVersion,NamespacePrefix FROM ApexPage",
                "visualforcePage",
                this.process_apex,
                true
            ),
            this.load_data(
                "SELECT Id,ApiVersion,NamespacePrefix FROM ApexComponent",
                "visualforceComponent",
                this.process_apex,
                true
            ),
            this.load_data(
                "SELECT Id,ApiVersion,NamespacePrefix,Status FROM ApexTrigger",
                "trigger",
                this.process_apex,
                true
            ),
            this.load_data(
                "SELECT Id,ApiVersion,NamespacePrefix,ManageableState FROM LightningComponentBundle",
                "lwc",
                this.process_lwc,
                true
            ),
            this.load_data(
                "SELECT Id,ApiVersion,NamespacePrefix FROM AuraDefinitionBundle",
                "aura",
                this.process_aura,
                true
            ),
            this.load_data(
                "SELECT Id,DurableId,ApiName,Label,Description,ProcessType,NamespacePrefix,TriggerType,IsActive,VersionNumber,ApiVersion FROM FlowDefinitionView",
                "flow",
                this.process_flow,
            ),
            this.load_data(
                "SELECT Id, CreatedDate, NumLinesCovered, NumLinesUncovered, CoverageLastModifiedDate FROM ApexCodeCoverageAggregate",
                "apexCodeCoverage",
                this.process_apex_coverage,
                true
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
        this.generateTotalApiVersion(data);

        this.data[key] = data;
        
    }

    process_apex_coverage = (key = 'apexCodeCoverage') => {
        let records = this.filterRecords(key);
        let data = {
            "totalLinesCovered":0,
            "totalLinesUncovered":0,
            "totalLines":0,
            "coveragePercentage":0,
            "coveragePercentageFormatted":null
        }

        data.totalLinesCovered = records.reduce((acc, record) => acc + record.NumLinesCovered, 0);
        data.totalLinesUncovered = records.reduce((acc, record) => acc + record.NumLinesUncovered, 0);
        data.totalLines = data.totalLinesCovered + data.totalLinesUncovered;
        data.coveragePercentage = (isNotUndefinedOrNull(data.totalLines) && data.totalLines != 0)?(data.totalLinesCovered / data.totalLines) * 100:0;
        data.coveragePercentageFormatted = `${data.coveragePercentage.toFixed(0)}%`;

        data.coverageStep = this.generateCoverageStep(data.coveragePercentage);
        data.coverageStepFormatted = data.coverageStep + 1;
        data.coverageMarkDescription = this.calculateCoverageMarkDescription(data.coverageStep);

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
        this.generateTotalApiVersion(data);
        
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
        this.generateTotalApiVersion(data);

        
        this.data[key] = data;
    }

    process_flow = (key = 'flow') => {
        let records = this.filterRecords(key);
        
        let data = {
            "records":records,
            "apiVersion":{},
            "processType":{}
        }

        records.forEach(item => {
            // ActiveVersion -> API Version (not the definition ApiVersion)
            if(item.ApiVersion){
                if(!data.apiVersion.hasOwnProperty(item.ApiVersion)){
                    data.apiVersion[item.ApiVersion] = 1;
                }else{
                    data.apiVersion[item.ApiVersion]++;
                }
            }

            if(item.ProcessType){
                if(!data.processType.hasOwnProperty(item.ProcessType)){
                    data.processType[item.ProcessType] = 1;
                }else{
                    data.processType[item.ProcessType]++;
                }
            }
            
        });

        // Extra
        this.generateTotalApiVersion(data);
        
        this.data[key] = data;
    }

    generateTotalApiVersion = (data) => {
        data.totalApiVersions = Object.keys(data.apiVersion).length;
        data.totalApiVersionsStep = this.generateTotalApiVersionStep(data.totalApiVersions);
        data.totalApiVersionsStepFormatted = data.totalApiVersionsStep + 1;
        data.totalApiVersionsMarkDescription = this.calculateTotalApiVersionMarkDescription(data.totalApiVersionsStep);
    }

    generateTotalApiVersionStep = (totalApiVersions) => {
        const ranking = [6,3,0];
        let currentRank = this.getCurrentRank(ranking,(item) => {
            return totalApiVersions > item;
        });
        return currentRank;
    }

    calculateTotalApiVersionMarkDescription = (step) => {
        const descriptions = [' > 6 versions',' > 3 versions',' < 3 versions'];
        return descriptions[step];
    }

    generateCoverageStep = (coverage) => {
        const ranking = [75,90,100];
        let currentRank = this.getCurrentRank(ranking,(item) => {
            return coverage < item;
        });
        return currentRank;
    }

    calculateCoverageMarkDescription = (step) => {
        const descriptions = [' < 75%',' < 90%',' > 90%'];
        return descriptions[step];
    }

    filterRecords = (key) => {
        if(!this.records.hasOwnProperty(key)) return [];
        return [...this.records[key]].filter(x => isEmpty(x.NamespacePrefix) && this.namespaceFiltering_value === DEFAULT_NAMESPACE || this.namespaceFiltering_value === x.NamespacePrefix || this.namespaceFiltering_value === ALL_NAMESPACE);
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

    get flow_allProcessType(){
        let items = this.data?.flow?.processType || {};
        const mapping = {'Flow':'ScreenFlow','AutoLaunchedFlow':'AutolaunchedFlow'};
        
        const result = {};
        Object.keys(items).forEach(key => {
            const newKey = mapping.hasOwnProperty(key)?mapping[key]:'Other';
            const value = result.hasOwnProperty(newKey)? result[newKey].value + items[key]: items[key];

            result[newKey] = {
                key:newKey,
                label:newKey.split(/(?=[A-Z])/).join(' '),
                value
            }
        });

        return Object.values(result);
    }


    /** Events */

  
    
    /** Filters */
    

    get namespaceFiltering_options(){
        return [...this.namespaces].map(x => ({label:x,value:x})).concat([{label:ALL_NAMESPACE,value:ALL_NAMESPACE}]);
    }

    namespaceFiltering_handleChange = (e) => {
        this.namespaceFiltering_value = e.detail.value;
        this.process_all();
    }

}