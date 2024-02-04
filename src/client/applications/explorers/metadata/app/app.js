import { api,track} from "lwc";
import FeatureElement from 'element/featureElement';
import { isEmpty,isElectronApp,classSet,isNotUndefinedOrNull,runActionAfterTimeOut,formatFiles,sortObjectsByField } from 'shared/utils';
import jsonview from '@pgrabovets/json-view';
import Toast from 'lightning/toast';


export default class App extends FeatureElement {

    isLoading = false;

    @track selection = [];
    @track metadata  = [];
    currentLevel = 0;

    //@track selection = {};
    //@track items = {}
    isEditorDisplayed = false;

    // Filters
    metadataFilter;
    metadataTypeFilter;

    // Menu

    // Mode
    advancedMode = false;

    connectedCallback(){
        this.load_metadataGlobal();
    }

    /** Events */
    
    handleMenuSelection = (e) => {

        const {itemName,itemLabel, level} = e.detail;

        switch(this.currentLevel){
            case 0:
                // Metadata Type selection
                this.load_specificMetadata({itemName,itemLabel});
                this.currentLevel = 1;
            break;
            case 1:
                // Metadata Record selection
                this.load_specificMetadataRecord({itemName,itemLabel});
                //this.currentLevel = 2; // Only for the flows
            break;
            case 2:
                // Only work for items such as flows
                //console.log('selection lvl 3');
            break;
        }
    }

    handleMenuBack = () => {
        this.hideEditor();
        if(this.currentLevel > 0){
            this.currentLevel--;
        }else{
            this.currentLevel = 0;
        }

        this.selection = this.selection.slice(0,this.currentLevel+1);
        this.metadata = this.metadata.slice(0,this.currentLevel+1);
        
        
    }
    
    goToMetadata = (e) => {
        this.hideEditor();
        this.currentLevel = 0;
        this.selection  = []
        this.metadata   = this.metadata.slice(0,1);
        this.handleMenuSelection({detail:{
            itemName:e.currentTarget.dataset.name,
            itemLabel:e.currentTarget.dataset.name
        }});
    }

    /** Methods */
    
    selectionUpdate = ({itemName,itemLabel}) => {
        if(this.selection.length > this.currentLevel){
            this.selection[this.currentLevel] = {itemName,itemLabel};
        }else{
            this.selection = [].concat(this.selection,[{itemName,itemLabel}]);
        }
        
    }

    load_metadataGlobal = async () => {
        this.isLoading = true;
        let sobjects = (await this.connector.conn.tooling.describeGlobal()).sobjects.map(x => x.name);
        //console.log('sobjects',sobjects);
        let result = await this.connector.conn.metadata.describe(this.connector.conn.version);
            result = (result?.metadataObjects || []).sort((a, b) => a.xmlName.localeCompare(b.xmlName));
            result = result.filter(x => sobjects.includes(x.xmlName)).map(x => ({...x,...{Name:x.xmlName,Label:x.xmlName,Key:x.xmlName}}));
        this.metadata = [].concat(this.metadata,[{records:result,label:'Metadata'}]);
        console.log('this.metadata',this.metadata);
        this.isLoading = false;
    }

    load_specificMetadata = async ({itemName,itemLabel}) => {
        this.isLoading = true;
        this.selectionUpdate({itemName,itemLabel});
        const metadataConfig = await this.connector.conn.tooling.sobject(itemName).describe() || [];
        //console.log('metadataConfig.fields.map(x => x.name)',metadataConfig.fields.map(x => x.name));
        const fields = metadataConfig.fields.map(x => x.name).filter(x => ['Id','Name','DeveloperName','MasterLabel','NamespacePrefix'].includes(x));
        //console.log('query',query);
        let queryExec = this.connector.conn.tooling.query(`SELECT ${fields.join(',')} FROM ${itemName}`);
        let result = (await queryExec.run({ responseTarget:'records',autoFetch : true, maxFetch : 10000 })).records || [];
            result = result.map(x => {
                const _tempName = this.formatName(x);
                return {
                    ...x,
                    Name:x.Id,
                    Label:_tempName,
                    Key:x.Id
                }
            }).sort((a, b) => a.Label.localeCompare(b.Label));
        console.log('metadata_lvl2',result);
        this.metadata = [].concat(this.metadata,[{records:result,label:itemLabel}]);
        
        this.isLoading = false;
    }

    formatName = (x) => {
        const name = x.Name || x.DeveloperName || x.MasterLabel;
        return x.NamespacePrefix ? `${x.NamespacePrefix}__${name}` : name;
    }

    load_specificMetadataRecord = async ({itemName,itemLabel}) => {
        this.selectionUpdate({itemName,itemLabel});
        var recordId = itemName;
        const metadataRecord = this.metadata[1].records.find(x => x.Id == recordId);
        if(metadataRecord.EntityDefinitionId){
            recordId = metadataRecord.EntityDefinitionId
        }
        //console.log('search',this.metadata_lvl1_selection,recordId,metadataRecord);
        try{
            let result = await this.connector.conn.request(metadataRecord.attributes.url);
            console.log('result',result);

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
                        this.visualizer = jsonview.create(JSON.stringify(result));
                            jsonview.render(this.visualizer,this.refs.container);
                            jsonview.expand(this.visualizer);
                        //this.refs.container.innerHTML = `<json-viewer>${JSON.stringify(this.metadata_lvl2_selection)}</json-viewer>`;
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
        let resources = (await this.connector.conn.tooling.query(`SELECT AuraDefinitionBundleId,Format,DefType,Source FROM AuraDefinition WHERE AuraDefinitionBundleId = '${data.Id}'`)).records || [];
        let files = formatFiles(resources.map(x => {
            let _name = this._auraNameMapping(data.FullName,x.DefType);
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
    
    get menuItems(){
        if(this.metadata.length == 0) return [];
        return this.metadata[this.metadata.length - 1].records;
    }

    get menuBackTitle(){
        if(this.metadata.length == 0) return '';
        return this.metadata[this.metadata.length - 1].label;
    }

    get isBackDisplayed(){
        return this.currentLevel > 0;
    }

    get pageClass(){
        return super.pageClass+' slds-p-around_small';
    }

    get editorClass(){
        return classSet("slds-full-height").add({'slds-hide':!this.isEditorDisplayed}).toString();
    }

}