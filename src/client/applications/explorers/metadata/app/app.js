import { api,wire,track} from "lwc";
import ToolkitElement from 'core/toolkitElement';
import { isEmpty,isElectronApp,isSalesforceId,classSet,isUndefinedOrNull,isNotUndefinedOrNull,runActionAfterTimeOut,formatFiles,sortObjectsByField,removeDuplicates } from 'shared/utils';
import jsonview from '@pgrabovets/json-view';
import Toast from 'lightning/toast';
import jszip from 'jszip';
import { CurrentPageReference,NavigationContext, generateUrl, navigate } from 'lwr/navigation';

const METADATA_EXCLUDE_LIST = ['Flow','FlowDefinition'];

export default class App extends ToolkitElement {
    @wire(NavigationContext)
    navContext;

    isLoading = false;
    isNoRecord = false;
    isGlobalMetadataLoaded = false;

    @track selection = [];
    @track metadata  = [{records:[],label:'Metadata'}];
    currentLevel = 0;
    @track selectedRecord;
    @track selectedRecordLoading = false;

    //@track selection = {};
    //@track items = {}
    isEditorDisplayed = false;

    // Filters
    @track menuItems = [];
    keepFilter = false;

    currentMetadata;
    param1;
    param2;
    label1;
    label2;

    // Menu

    // Mode
    advancedMode = false;

    _pageRef;
    @wire(CurrentPageReference)
    handleNavigation(pageRef){
        if(isUndefinedOrNull(pageRef)) return;
        //if(JSON.stringify(this._pageRef) == JSON.stringify(pageRef)) return;
        
        if(pageRef?.attributes?.applicationName == 'metadata'){
            this._pageRef = pageRef;
            this.loadFromNavigation(pageRef);
        }
    }

    loadFromNavigation = async ({state, attributes}) => {
        const { applicationName }  = attributes;
        let { param1,label1,param2,label2,sobject } = state;
        if(applicationName != 'metadata') return; // Only for metadata

        if(!this.isGlobalMetadataLoaded){
           await this.load_metadataGlobal();
        }
        this.isNoRecord = false;

        const exceptionMetadata = sobject?this.exceptionMetadataList.find(x => x.name === sobject):null;
        if(sobject && this.currentMetadata != sobject){
            // Metadata
            this.currentLevel = 1;
            this.currentMetadata = sobject;
            if(exceptionMetadata){
                await this.load_specificMetadataException(exceptionMetadata,null,1);
            }else{
                await this.load_specificMetadata(sobject);
            }
        }
        if(param1 && this.param1 != param1){
            this.keepFilter = true; // Avoid menu search refresh !
            this.param1 = param1;
            this.label1 = label1;
            //this.selectedRecordLoading = true;
            if(exceptionMetadata && exceptionMetadata.hasLvl2){
                let metadataRecord = this.metadata[this.metadata.length - 1].records.find(x => x.key == param1);

                // Advanced with Extra lvl
                this.currentLevel = 2;
                const lvl2ExceptionMetadata = this.exceptionMetadataList.find(x => x.name === exceptionMetadata.lvl2Type);
                await this.load_specificMetadataException(lvl2ExceptionMetadata,param1,2);
                if(isUndefinedOrNull(param2) && exceptionMetadata.selectDefaultFunc){
                    param2 = exceptionMetadata.selectDefaultFunc(metadataRecord);
                    label2 = exceptionMetadata.selectDefaultLabelFunc(metadataRecord);
                }
            }else{
                // Basic
                await this.load_specificMetadataRecord(this.param1);
            }
        }

        if(param2 && this.param2 != param2){
            this.param2 = param2;
            this.label2 = label2;
            await this.load_specificMetadataRecord(this.param2);
            //this.currentLevel = 2;
        }
        // At the end to avoid multiple refresh
        this.setMenuItems();
    }


    connectedCallback(){
        //this.load_metadataGlobal();
    }

    /** Events */
    
    handleMenuSelection = (e) => {

        const {name,label} = e.detail;
        switch(this.currentLevel){
            case 0:
                // Metadata Type selection
                //this.load_specificMetadata({name,label});
                this.currentMetadata = null;
                this.param1 = null;
                this.param2 = null;
                this.currentLevel = 1;
                navigate(this.navContext,{type:'application',
                    attributes:{
                        applicationName:'metadata',
                    },
                    state:{
                        sobject:name,
                        label1:label
                    }
                });
            break;
            case 1:
                // Metadata Record selection
                this.selectedRecord = null;
                this.selectedRecordLoading = true;
                this.param1 = null;
                this.param2 = null;
                navigate(this.navContext,{type:'application',
                    attributes:{
                        applicationName:'metadata',
                    },
                    state:{
                        sobject:this.currentMetadata,
                        param1:name,
                        label1:label
                    }
                });
                
                //this.currentLevel = 2; // Only for the flows
            break;
            case 2:
                this.param2 = null;
                navigate(this.navContext,{type:'application',
                    attributes:{
                        applicationName:'metadata',
                    },
                    state:{
                        sobject:this.currentMetadata,
                        param1:this._pageRef.state.param1,
                        label1:this._pageRef.state.label1,
                        param2:name,
                        label2:label
                    }
                });
                // Only work for items such as flows
            break;
        }
    }

    handleMenuBack = () => {
        this.keepFilter = false;
        this.hideEditor();
        this.hideJsonViewer();
        this.selectedRecord = null;

        if(this.currentLevel > 0){
            this.currentLevel--;
        }else{
            this.currentLevel = 0;
        }

        this.metadata = this.metadata.slice(0,this.currentLevel+1);
        
        if(this.currentLevel == 2){
            this.param2 = null;
            navigate(this.navContext,{type:'application',
                attributes:{
                    applicationName:'metadata'
                },
                state:{
                    sobject:this.currentMetadata,
                    param1:this.param1,
                    label1:this.label1
                }
            });
        }else if(this.currentLevel == 1){
            this.param1 = null;
            this.param2 = null;
            navigate(this.navContext,{type:'application',
                attributes:{
                    applicationName:'metadata',
                },
                state:{
                    sobject:this.currentMetadata,
                }
            });
        }else if(this.currentLevel == 0){
            this.currentMetadata = null;
            this.param1 = null;
            this.param2 = null;
            navigate(this.navContext,{type:'application',attributes:{
                applicationName:'metadata'
            }});
        } 
    }
    
    goToMetadata = (e) => {
        this.hideEditor();
        this.hideJsonViewer();
        this.currentLevel = 0;
        this.metadata   = this.metadata.slice(0,1);
        this.handleMenuSelection({detail:{
            name:e.currentTarget.dataset.name,
            label:e.currentTarget.dataset.name
        }});
    }

    /** Methods */


    load_metadataGlobal = async () => {
        //console.log('load_metadataGlobal');
        this.isLoading = true;
        let sobjects = (await this.connector.conn.tooling.describeGlobal()).sobjects.map(x => x.name);
        let result = await this.connector.conn.metadata.describe(this.connector.conn.version);
            result = (result?.metadataObjects || [])
            result = result.filter(x => sobjects.includes(x.xmlName)).map(x => ({...x,...{name:x.xmlName,label:x.xmlName,key:x.xmlName}}));
            result = result.filter(x => !METADATA_EXCLUDE_LIST.includes(x.name));
            result = [].concat(result,this.exceptionMetadataList.filter(x => x.isSearchable));
            result = result.sort((a, b) => a.name.localeCompare(b.name));
        this.metadata[0] = {records:result,label:'Metadata'};
        this.isLoading = false;
        this.isGlobalMetadataLoaded = true;
    }

    load_specificMetadataException = async (exceptionMetadata,recordId,level) => {
        //console.log('load_specificMetadataException');
        const { name,label,queryFields,queryObject,labelFunc,field_id,manualFilter,badgeFunc,compareFunc,filterFunc } = exceptionMetadata;
        const newCompare = compareFunc?compareFunc:(a, b) => (a.label || '').localeCompare(b.label);

        this.isLoading = true;
        const metadataConfig = await this.connector.conn.tooling.sobject(queryObject).describe() || [];
        const fields = [].concat(metadataConfig.fields.map(x => x.name).filter(x => ['Id','Name','DeveloperName','MasterLabel','NamespacePrefix'].includes(x)),queryFields);
        try{
            let queryExec = this.connector.conn.tooling.query(`SELECT ${fields.join(',')} FROM ${queryObject} ${filterFunc(recordId)}`);
            let result = (await queryExec.run({ responseTarget:'Records',autoFetch : true, maxFetch : 10000 })) || [];
                result = result.filter(x => manualFilter(x))
            
                result = result.map(x => {
                    const badge = badgeFunc(x);
                    return {
                        ...x,
                        name:x[field_id],
                        label:labelFunc(x),
                        key:x[field_id],
                        badgeLabel:badge?badge.label:null,
                        badgeClass:badge?badge.class:null
                    }
                }).sort(newCompare);
            
            
            if(this.metadata.length <= level){
                this.metadata.push(null)
            }
            this.metadata[level] = {records:result,label};
        }catch(e){
            console.error(e); // We still show the menu
        }
        this.isLoading = false;
    }

    load_specificMetadata = async (name) => {
        //console.log('load_specificMetadata');
        this.isLoading = true;
        const metadataConfig = await this.connector.conn.tooling.sobject(name).describe() || [];
        const fields = metadataConfig.fields.map(x => x.name).filter(x => ['Id','Name','DeveloperName','MasterLabel','NamespacePrefix'].includes(x));
        try{
            let queryExec = this.connector.conn.tooling.query(`SELECT ${fields.join(',')} FROM ${name}`);
            let result = (await queryExec.run({ responseTarget:'Records',autoFetch : true, maxFetch : 10000 })) || [];
                result = result.map(x => {
                    const _tempName = this.formatName(x);
                    return {
                        ...x,
                        name:x.Id,
                        label:_tempName,
                        key:x.Id,
                    }
                }).sort((a, b) => (a.label || '').localeCompare(b.label));

            if(this.metadata.length <= 1){
                this.metadata.push(null)
            }
            this.metadata[1] = {records:result,label:name};
        }catch(e){
            console.error(e); // We still show the menu
        }
        this.isLoading = false;
    }

    load_recordFromRestAPI = async (recordId) => {
        const urlQuery = `/services/data/v${this.connector.conn.version}/tooling/sobjects/${this.currentMetadata}/${recordId}`;
        return await this.connector.conn.request(urlQuery);
    }

    load_specificMetadataRecord = async (key) => {
        //console.log('load_specificMetadataRecord');
        this.isLoading = true;
        /*
        this.currentMetadata
        const metadataRecord = this.metadata[this.metadata.length - 1].records.find(x => x.key == key);
        if(isUndefinedOrNull(metadataRecord)){
            this.isNoRecord = true;
            this.selectedRecordLoading = false;
            return;
        }
            */

        //recordId = metadataRecord.EntityDefinitionId
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
                default:
                    this.selectedRecord = await this.load_recordFromRestAPI(key);
            }
            this.selectedRecordLoading = false
            this.isLoading = false;
        }catch(e){
            console.error(e);
            Toast.show({
                message: e.message,
                label: 'API Error',
                variant:'error',
                mode:'dismissible'
            });
            this.isNoRecord = true;
            this.selectedRecordLoading = false
        }
    }

    formatName = (x) => {
        const name = x.MasterLabel || x.Name || x.DeveloperName || x.Id;
        return x.NamespacePrefix ? `${x.NamespacePrefix}__${name}` : name;
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
        })));

        // Added from Extension redirection
        if(resources.length > 0){
            this.label1 = resources[0].LightningComponentBundle.MasterLabel;
        }
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
        }));
        return sortObjectsByField(files,'extension',['cmp','html','js','css','xml'])
    }

    checkIfPresent = (a,b) => {
        return (a || '').toLowerCase().includes((b||'').toLowerCase());
    }
    
    displayEditor = (files) => {
        this.refs.editor.displayFiles(this.metadata[this.metadata.length - 1].label,files);
        this.isEditorDisplayed = true;
    }

    hideEditor = () => {
        //this.refs.editor.displayFiles(files);
        this.isEditorDisplayed = false;
    }

    hideJsonViewer = () => {
        if(this.visualizer){
            try{
                jsonview.destroy(this.visualizer);
            }catch(e){console.error(e)}
        }
    }

    setMenuItems = () => {
        // Doesn't work all the time if param1 isn't the recordId !!! (Example LWC)
        //console.log('this.metadata',this.metadata);
        if(this.metadata.length == 0){
            this.menuItems = [];
        }else{
            this.menuItems = this.metadata[this.metadata.length - 1].records.map(x => ({
                ...x,
                isSelected:this.selectedItem == x.key
            }));
        }
    }


    /** Getters */

    get exceptionMetadataList(){
        return [
            {
                isSearchable:true,
                name:'Flow',
                label:'Flow',
                key:'Flow',
                isException:true,
                hasLvl2:true,
                lvl2Type:'FlowVersion',
                queryObject:'FlowDefinition',
                queryFields:['ActiveVersion.ProcessType','ActiveVersion.Status','ActiveVersionId'],
                labelFunc:this.formatName,
                filterFunc:(x) => " WHERE ActiveVersion.ProcessType <> 'Workflow'",
                field_id:'Id',
                selectDefaultFunc:(x) => x.ActiveVersionId,
                selectDefaultLabelFunc:(x) => 'Active',
                badgeFunc:(x) => {
                    return x.ActiveVersion?.Status?{
                        label:'Active',
                        class:'slds-theme_success'
                    }:{
                        label:'Inactive',
                        class:''
                    }
                },
                manualFilter:(x) => { return x.ActiveVersion?.ProcessType !== 'Workflow'}
                
                
            },
            {
                isSearchable:true,
                name:'WorkFlow',
                label:'WorkFlow',
                key:'WorkFlow',
                isException:true,
                hasLvl2:true,
                lvl2Type:'FlowVersion',
                queryObject:'FlowDefinition',
                queryFields:['ActiveVersion.ProcessType','ActiveVersion.Status','ActiveVersionId'],
                labelFunc:this.formatName,
                filterFunc:(x) => " WHERE ActiveVersion.ProcessType = 'Workflow'",
                field_id:'Id',
                selectDefaultFunc:(x) => x.ActiveVersionId,
                selectDefaultLabelFunc:(x) => 'Active',
                badgeFunc:(x) => {
                    return x.ActiveVersion?.Status?{
                        label:'Active',
                        class:'slds-theme_success'
                    }:{
                        label:'Inactive',
                        class:''
                    }
                },
                manualFilter:(x) => {return x.ActiveVersion?.ProcessType === 'Workflow'}
            },
            {
                isSearchable:false,
                name:'FlowVersion',
                label:'FlowVersion',
                key:'FlowVersion',
                isException:true,
                hasLvl2:false,
                queryObject:'Flow',
                queryFields:['ProcessType','Status','VersionNumber'],
                labelFunc:(x) => `Version ${x.VersionNumber}`,
                filterFunc:(x) => ` WHERE Definition.Id = '${x}'`,
                field_id:'Id',
                badgeFunc:(x) => {
                    return x.Status === 'Active'?{
                        label:'Active',
                        class:'slds-theme_success'
                    }:{
                        label:x.Status,
                        class:''
                    }
                },
                manualFilter:(x) => { return true;},
                compareFunc:(a, b) => (a.Status || '').localeCompare(b.Status)
            }
        ]
    }

    get noRecordMessage(){
        return `This record wasn't found in your metadata.`;
    }
    
    /*get menuItems(){
        if(this.metadata.length == 0) return [];
        return this.metadata[this.metadata.length - 1].records.map(x => ({
            ...x,
            isSelected:this.selectedItem == x.key
        }));
    }*/

    get selectedItem(){
        if(this.currentLevel == 2){
            return this.param2;
        }else if(this.currentLevel == 1){
            return this.param1;
        } else if(this.currentLevel == 0){
            return this.currentMetadata;
        }else{
            return null;
        }
    }

    get menuBackTitle(){
    
        if(this.currentLevel == 2){
            return this.label1;
        }else if(this.currentLevel == 1){
            return this.currentMetadata;
        } else if(this.currentLevel == 0){
            return '';
        }
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

    get isMetadataViewerDisplayed(){
        return isNotUndefinedOrNull(this.selectedRecord);
    }

}