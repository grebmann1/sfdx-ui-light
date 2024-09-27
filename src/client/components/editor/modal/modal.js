import { api,wire,track} from "lwc";
import LightningModal from 'lightning/modal';
import { isEmpty,isElectronApp,isSalesforceId,classSet,isUndefinedOrNull,isNotUndefinedOrNull,runActionAfterTimeOut,formatFiles,sortObjectsByField,removeDuplicates } from 'shared/utils';
import Toast from 'lightning/toast';
import { CurrentPageReference,NavigationContext, generateUrl, navigate } from 'lwr/navigation';
import { store } from 'core/store';

export default class Modal extends LightningModal {

    isLoading = false;

    @api title;
    @api currentMetadata;
    @api recordId;
    @api isFooterDisplayed = false;

    // Editor Specific
    @api isCoverageEnabled = false;
    @api isReadOnly = false;

    // Editor Change Tracker
    isEditMode = false;

    connectedCallback(){
        this.init();
    }
    /** Events **/

    handleEditorChange = (e) => {
        console.log('new value',e.detail);
        this.isEditMode = e.detail.isEditMode;
    }

    handleMonacoLoaded = () => {
        this.load_specificMetadataRecord(this.recordId);
    }

    handleCloseClick() {
        this.close();
    }

    handleSaveClick = () => {

    }

    /** Methods */

    init = () => {
        console.log('Initialize Editor');
        //this.load_specificMetadataRecord(this.recordId);
    }

    displayEditor = (files) => {
        this.refs.editor.displayFiles(this.currentMetadata,files);
        this.isEditorDisplayed = true;
    }



    /** Getters **/

    // Couldn't use the toolkitElement
    get connector(){
        return store.getState()?.application?.connector;
    }

    get isSaveDisplayed(){
        return this.isEditMode;
    }

    get isSaveDisabled(){
        return !this.isSaveDisplayed;
    }


    /** Editor based on record Ids **/

    load_recordFromRestAPI = async (recordId) => {
        const urlQuery = `/services/data/v${this.connector.conn.version}/tooling/sobjects/${this.currentMetadata}/${recordId}`;
        return await this.connector.conn.request(urlQuery);
    }

    load_specificMetadataRecord = async (key) => {
        //console.log('load_specificMetadataRecord');
        this.isLoading = true;
        try{
            switch(this.currentMetadata){
                case "LightningComponentBundle":
                    this.displayEditor(await this.handle_LWC(key)); // Only LWC supporting extra
                    break;
                case "ApexClass":
                    this.displayEditor(await this.handle_APEX(await this.load_recordFromRestAPI(key)));
                    break;
                case "AuraDefinitionBundle":
                    this.displayEditor(await this.handle_AURA(await this.load_recordFromRestAPI(key)));
                    break;
                case "ApexTrigger":
                    this.displayEditor(await this.handle_APEX(await this.load_recordFromRestAPI(key),'trigger')); // Similar to APEX
                    break;
                case "ApexPage":
                    this.displayEditor(await this.handle_APEX(await this.load_recordFromRestAPI(key),'page','Markup')); // Similar to APEX
                    break;
                case "ApexComponent":
                    this.displayEditor(await this.handle_APEX(await this.load_recordFromRestAPI(key),'page','Markup')); // Similar to APEX
                    break;
            }
            this.isLoading = false;
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


    handle_LWC = async (key) => {
        var queryString = `SELECT LightningComponentBundleId,LightningComponentBundle.MasterLabel,Format,FilePath,Source FROM LightningComponentResource WHERE `;
        if(isSalesforceId(key)){
            queryString += `LightningComponentBundleId = '${key}'`;
        }else{
            queryString += `LightningComponentBundle.DeveloperName = '${key}'`;
        }
        let resources = (await this.connector.conn.tooling.query(queryString)).records || [];
        let files = formatFiles(resources.map(x => ({
            path:x.FilePath,
            name:x.FilePath.split('/').pop(),
            body:x.Source,
            apiVersion:x.ApiVersion,
            metadata:this.currentMetadata,
            id:x.LightningComponentBundleId,
            _source:x
        })),'js');
        return sortObjectsByField(files,'extension',['html','js','css','xml'])
    }

    handle_APEX = async (data,extension = 'cls',bodyField = 'Body') => {
        return formatFiles([{
            path:`${data.FullName || data.Name}.${extension}`,
            name:`${data.FullName || data.Name}.${extension}`,
            body:data[bodyField],
            apiVersion:data.ApiVersion,
            metadata:this.currentMetadata,
            id:data.Id,
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
        let resources = (await this.connector.conn.tooling.query(`SELECT AuraDefinitionBundleId,Format,DefType,Source FROM AuraDefinition WHERE AuraDefinitionBundleId = '${data.Id}'`)).records || [];
        let files = formatFiles(resources.map(x => {
            let _name = this._auraNameMapping(data.FullName,x.DefType);
            return {
                path:_name,
                name:_name,
                body:x.Source,
                apiVersion:data.ApiVersion,
                metadata:this.currentMetadata,
                id:data.Id,
                _source:x
            }
        }),'css');
        return sortObjectsByField(files,'extension',['cmp','html','js','css','xml'])
    }

}