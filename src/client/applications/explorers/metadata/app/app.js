import { api} from "lwc";
import FeatureElement from 'element/featureElement';
import { isEmpty,isElectronApp,classSet,isNotUndefinedOrNull,runActionAfterTimeOut,formatFiles,sortObjectsByField } from 'shared/utils';
import jsonview from '@pgrabovets/json-view';
import Toast from 'lightning/toast';


export default class App extends FeatureElement {

    isLoading = false;
    selectedMetadataType;
    selectedMetadataRecordName;

    metadataType_list = [];
    metadata_list = [];
    metadata_record;

    isEditorDisplayed = false;

    // Filters
    metadataFilter;
    metadataTypeFilter;

    async connectedCallback(){
        this.load_metadataGlobal();
    }

    /** Events */
    
    goToMetadata = (e) => {
        this.unselectMetadata();
        this.selectedMetadataType = e.currentTarget.dataset.name;
        this.load_specificMetadata();
    }
    
    handleMetadataSearch = (e) => {
        runActionAfterTimeOut(e.detail.value,(newValue) => {
            this.metadataFilter = newValue;
        });
    }

    handleMetadataTypeSearch = (e) => {
        runActionAfterTimeOut(e.detail.value,(newValue) => {
            this.metadataTypeFilter = newValue;
        });
    }

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
        this.hideEditor();
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
        //console.log('metadataConfig.fields.map(x => x.name)',metadataConfig.fields.map(x => x.name));
        const fields = metadataConfig.fields.map(x => x.name).filter(x => ['Id','Name','DeveloperName','MasterLabel','NamespacePrefix'].includes(x));
        let query = `SELECT ${fields.join(',')} FROM ${type}`;
        //console.log('query',query);
        let queryExec = this.connector.conn.tooling.query(query);
        let result = (await queryExec.run({ responseTarget:'records',autoFetch : true, maxFetch : 10000 })).records || [];
            result = result.map(x => ({
                        ...x,
                        Name:this.generateName(x)
                    })).sort((a, b) => a.Name.localeCompare(b.Name));
        console.log('metadata_list',result);
        this.metadata_list = result;
        this.isLoading = false;
    }

    generateName = (x) => {
        const name = x.Name || x.DeveloperName || x.MasterLabel;
        if(x.NamespacePrefix){
            return `${x.NamespacePrefix}__${name}`;
        }

        return name;
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
            let result = await this.connector.conn.request(metadataRecord.attributes.url);
            console.log('result',result);
            this.metadata_record = result;

            switch(result.attributes.type){
                case "LightningComponentBundle":
                    this.displayEditor(await this.handle_LWC(result));
                break;
                case "ApexClass":
                    this.displayEditor(await this.handle_APEX(result));
                break;
                case "AuraDefinitionBundle":
                    this.displayEditor(await this.handle_AURA(result));
                break;
                case "ApexTrigger":
                    this.displayEditor(await this.handle_APEX(result,'trigger')); // Similar to APEX
                break;
                case "ApexPage":
                    this.displayEditor(await this.handle_APEX(result,'page','Markup')); // Similar to APEX
                break;
                case "ApexComponent":
                    this.displayEditor(await this.handle_APEX(result,'page','Markup')); // Similar to APEX
                break;
                default:
                    runActionAfterTimeOut(null,async () => {
                        this.visualizer = jsonview.create(JSON.stringify(this.metadata_record));
                            jsonview.render(this.visualizer,this.refs.container);
                            jsonview.expand(this.visualizer);
                        //this.refs.container.innerHTML = `<json-viewer>${JSON.stringify(this.metadata_record)}</json-viewer>`;
                    },{timeout:500});
            }
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

    handle_LWC = async (data) => {

        let resources = (await this.connector.conn.tooling.query(`SELECT LightningComponentBundleId,Format,FilePath,Source FROM LightningComponentResource WHERE LightningComponentBundleId = '${data.Id}'`)).records || [];
        let files = formatFiles(resources.map(x => ({
            path:x.FilePath,
            name:x.FilePath.split('/').pop(),
            body:x.Source,
            apiVersion:x.ApiVersion
        })));

        return sortObjectsByField(files,'extension',['html','js','css','xml'])
    }

    handle_APEX = async (data,extension = 'cls',bodyField = 'Body') => {
        return formatFiles([{
            path:`${data.FullName || data.Name}.${extension}`,
            name:`${data.FullName || data.Name}.${extension}`,
            body:data[bodyField],
            apiVersion:data.ApiVersion
        }]);
    }

    _auraNameMapping = (name,type) => {
        switch(type){
            case 'COMPONENT':
                return `${name}.cmp`;
            case 'CONTROLLER':
                return `${name}Controller.js`;
            case 'HELPER':
                return `${name}Helper.js`;
            case 'RENDERER':
                return `${name}Renderer.js`;
            case 'DOCUMENTATION':
                return `${name}.auradoc`;
            case 'DESIGN':
                return `${name}.design`;
            case 'SVG':
                return `${name}.svg`;
            default:
                return name;
        }
    }

    handle_AURA = async (data) => {
        console.log('data',data);
        let resources = (await this.connector.conn.tooling.query(`SELECT AuraDefinitionBundleId,Format,DefType,Source FROM AuraDefinition WHERE AuraDefinitionBundleId = '${data.Id}'`)).records || [];
        console.log('resources',resources);
        let files = formatFiles(resources.map(x => {
            let _name = this._auraNameMapping(data.FullName,x.DefType);
            console.log('_name',_name);
            return {
                path:_name,
                name:_name,
                body:x.Source,
                apiVersion:data.ApiVersion
            }     
        }));
        return sortObjectsByField(files,'extension',['cmp','html','js','css','xml'])
    }

    checkIfPresent = (a,b) => {
        return (a || '').toLowerCase().includes((b||'').toLowerCase());
    }
    
    displayEditor = (files) => {
        this.refs.editor.displayFiles(files);
        this.isEditorDisplayed = true;
    }

    hideEditor = () => {
        //this.refs.editor.displayFiles(files);
        this.isEditorDisplayed = false;
    }


    /** Getters */

    get metadataType_filteredList(){
        if(isEmpty(this.metadataTypeFilter)) return this.metadataType_list;
        return this.metadataType_list.filter(x => this.checkIfPresent(x.xmlName,this.metadataTypeFilter));
    }
    
    get metadata_filteredList(){
        if(isEmpty(this.metadataFilter)) return this.metadata_list;
        return this.metadata_list.filter(x => this.checkIfPresent(x.Name,this.metadataFilter));
    }

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
        return !this.isLoading && this.metadata_list.length == 0;
    }

    get editorClass(){
        return classSet("slds-full-height").add({'slds-hide':!this.isEditorDisplayed}).toString();
    }

}