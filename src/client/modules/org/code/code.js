import { LightningElement,api} from "lwc";
import { isEmpty,formatBytes,isUndefinedOrNull } from 'shared/utils';


export default class Code extends LightningElement {

    @api connector;

    @api apex_data;

    async connectedCallback(){
        this.load_apexClass();
    }

    /** Methods */

    


    load_apexClass = async () => {
        let query = this.connector.conn.query("SELECT Id,ApiVersion,NamespacePrefix,LengthWithoutComments,Status FROM ApexClass");
        let records = await query.run({ responseTarget:'Records',autoFetch : true, maxFetch : 10000 }) || [];

        let data = {
            "records":[],
            "ApiVersion":{},
            "NamespacePrefix":{},
            "totalLength":0
        }

        records.forEach(item => {
            // ApiVersion
            if(!data.ApiVersion.hasOwnProperty(item.ApiVersion)){
                data.ApiVersion[item.ApiVersion] = 1;
            }else{
                data.ApiVersion[item.ApiVersion]++;
            }

            // NamespacePrefix
            if(!data.NamespacePrefix.hasOwnProperty(item.NamespacePrefix)){
                data.NamespacePrefix[item.NamespacePrefix] = 1;
            }else{
                data.NamespacePrefix[item.NamespacePrefix]++;
            }

            // totalLength
            if(item.LengthWithoutComments > 0){
                data.totalLength += item.LengthWithoutComments
            }

            data.records.push(item);
        });
        this.apex_data = data;
        console.log('data',data);
    }

    getCurrentRank = (mapping,check) => {
        for (let i = 0; i < mapping.length; i++) {
            if(check(mapping[i])){
                return i;
            }
        }
        return mapping.length - 1;
    }

   


    /** Getters */

    get apex_totalApexClasses(){
        if(isUndefinedOrNull(this.apex_data)){
            return 0;
        }
        return this.apex_data.records.length;
    }

    get apex_totalApexClassesInMB(){
        if(isUndefinedOrNull(this.apex_data)){
            return '0 MB';
        }
        return formatBytes(this.apex_data.totalLength,0);
    }

    get apex_totalNamespaces(){
        if(isUndefinedOrNull(this.apex_data)){
            return 0;
        }
        return Object.keys(this.apex_data.NamespacePrefix).length;
    }

    get apex_totalApiVersions(){
        if(isUndefinedOrNull(this.apex_data)){
            return 0;
        }
        return Object.keys(this.apex_data.ApiVersion).length;
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

    
 

    /** Events */

  
    

}