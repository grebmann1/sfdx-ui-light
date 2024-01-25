import { api} from "lwc";
import FeatureElement from 'element/featureElement';
import { isEmpty,isElectronApp,classSet,isNotUndefinedOrNull,runActionAfterTimeOut } from 'shared/utils';
import jsonview from '@pgrabovets/json-view';
import Toast from 'lightning/toast';


export default class App extends FeatureElement {

    isLoading = false;
    selectedMetadataType;
    selectedMetadataRecordName;

    metadataType_list = [];
    metadata_list = [];
    metadata_record;

    async connectedCallback(){
        this.load_metadataGlobal();
    }

    /** Events */

    handleMetadataTypeSelection = (e) => {
        e.stopPropagation();
        this.selectedMetadataType = e.detail.name;
        this.load_specificMetadata();
    }

    handleMetadataSelection = (e) => {
        e.stopPropagation();
        this.metadata_record = null;
        console.log('handleMetadataSelection');
        this.selectedMetadataName = e.detail.name;
        this.load_specificMetadataRecord();
    }

    unselectMetadata = () => {
        this.selectedMetadataName = null;
        this.selectedMetadataType = null;
        this.metadata_record = null;
        this.metadata_list = [];
    }
    

    /** Methods */

    load_metadataGlobal = async () => {
        this.isLoading = true;
        let sobjects = (await this.connector.conn.tooling.describeGlobal()).sobjects.map(x => x.name);
        //console.log('sobjects',sobjects);
        let result = await this.connector.conn.metadata.describe(this.connector.conn.version);
            result = (result?.metadataObjects || []).sort((a, b) => a.xmlName.localeCompare(b.xmlName));
            result = result.filter(x => sobjects.includes(x.xmlName));
        this.metadataType_list = result;
        this.isLoading = false;
    }

    load_specificMetadata = async () => {
        this.isLoading = true;
        var type = this.selectedMetadataType; // Single type
        const metadataConfig = await this.connector.conn.tooling.sobject(type).describe() || [];
        const fields = metadataConfig.fields.map(x => x.name).filter(x => !['FullName','Metadata'].includes(x));
        let query = `SELECT ${fields.join(',')} FROM ${type}`;
        //console.log('query',query);
        let result = (await this.connector.conn.tooling.query(query)).records || [];
            result = result.map(x => ({
                        ...x,
                        Name:x.Name || x.DeveloperName || x.MasterLabel
                    })).sort((a, b) => a.Name.localeCompare(b.Name));
        console.log('metadata_list',result);
        this.metadata_list = result;
        this.isLoading = false;
    }

    load_specificMetadataRecord = async () => {
        const type = this.selectedMetadataType; // Single type
        var recordId = this.selectedMetadataName;

        //console.log('this.selectedMetadataName',this.selectedMetadataName);
        //console.log('this.metadata_list',this.metadata_list);TableEnumOrId
        const metadataRecord = this.metadata_list.find(x => x.Id == recordId);
        if(metadataRecord.EntityDefinitionId){
            recordId = metadataRecord.EntityDefinitionId
        }
        console.log('search',type,recordId,metadataRecord);
        try{
            let result = await this.connector.conn.request(metadataRecord.attributes.url)
            this.metadata_record = result;
    
            runActionAfterTimeOut(null,async () => {
                this.visualizer = jsonview.create(JSON.stringify(this.metadata_record));
                    jsonview.render(this.visualizer,this.refs.container);
                    jsonview.expand(this.visualizer);
                //this.refs.container.innerHTML = `<json-viewer>${JSON.stringify(this.metadata_record)}</json-viewer>`;
            },{timeout:500});
        }catch(e){
            console.error(e);
            Toast.show({
                message: e.message,
                label: 'API Error',
                variant:'error',
                mode:'dismissible'
            });
        }
        

    }
    


    /** Getters */

    get pageClass(){
        return super.pageClass+' slds-p-around_small';
    }

    get isMetadataListDisplayed(){
        return isEmpty(this.selectedMetadataType);
    }

    get isRecordDisplayed(){
        return isNotUndefinedOrNull(this.metadata_record);
    }

    get displayIfEmpty(){
        return this.metadata_list.length == 0;
    }

    


}