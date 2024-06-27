import { api,track} from "lwc";
import Toast from 'lightning/toast';
import FeatureElement from 'element/featureElement';
import { connectStore,store,store_application } from 'shared/store';
import { DependencyManager } from 'slds/fieldDependencyManager';
import { 
    runActionAfterTimeOut,isEmpty,isNotUndefinedOrNull,isUndefinedOrNull,runSilent,refreshCurrentTab
} from 'shared/utils';
import { 
        getCurrentTab,getCurrentObjectType,fetch_data,fetch_metadata,
        getObjectSetupLink,getObjectFieldsSetupLink,getRecordTypesLink,
        getObjectListLink,getObjectDocLink
} from "extension/utils";

const PAGE_LIST_SIZE    = 70;
const TOOLING = 'tooling';
const SOBJECT = {
    contact : 'Contact'
}

export default class RecordExplorer extends FeatureElement {

    @api versions = [];
    

    tableInstance;
    isLoading = false;

    currentTab;
    currentOrigin;

    // record data
    sobjectName;
    @track metadata;
    record;
    // for table
    data = [];
    filter = '';
    isError = false;

    // Exceptions
    networkMembers = [];

    // Scrolling
    pageNumber = 1;

    // Editing
    isEditMode = false;
    isSaving = false;
    modifiedRows = [];
    isViewChangeFilterEnabled = false;
    fieldErrors = {};
    editingFieldSet = new Set();

    // field & labels
    isLabelDisplayed = false;

    // Info & Details
    isInfoDisplayed = false;
    

    @api
    get recordId(){
        return this._recordId;
    }
    set recordId(value){
        var toRun = this._recordId != value && !isEmpty(value);
        this._recordId = value;
        if(toRun){
            this.initRecordExplorer();
        }
        
    }
    


    connectedCallback(){
        // Load metadata
        //this.getObjects(this.connector.conn,'standard');
        //this.getObjects(this.connector.conn.tooling,'tooling');
        //this.isSaving = true;
    }
    /*
    addEntity = ({entity,api}) => {
        let item = this.entities.get(entity.name);
        if(item){
            if(!item.keyPrefix){ 
                item.keyPrefix = entity.keyPrefix;
            }
        }else{
            item = entity;
            item.availableApis = [];
        }
        if (api) {
            item.availableApis.push(api);
            if (entity.keyPrefix) {
                item.availableKeyPrefix = entity.keyPrefix;
            }
        }
        this.entities.set(item.name,item);
    }
    
    getObjects = (connector,api) =>{
        return connector.describeGlobal().then(describe => {
            for (let entity of describe.sobjects) {
                this.addEntity({entity,api})
            }
        }).catch(err => {
          console.error("list " + api + " sobjects", err);
        });
    }*/

    /** Methods **/

    initRecordExplorer = async () => {
        //console.log('initRecordExplorer');
        try{
            this.isError = false;
            this.isLoading = true;
            
            this.currentTab = await getCurrentTab();
            this.currentOrigin = (new URL(this.currentTab.url)).origin;
            // Get sobjectName (Step 2) // Should be optimized to save 1 API Call [Caching]
            this.sobjectName = await getCurrentObjectType(this.connector.conn,this.recordId);
            // Get Metadata (Step 3) // Should be optimized to save 1 API Call [Caching]
            this.metadata = await fetch_metadata(this.connector.conn,this.sobjectName);
            if(isUndefinedOrNull(this.metadata)){
                // Trying with tooling API
                this.metadata = await fetch_metadata(this.connector.conn.tooling,this.sobjectName);
                if(isNotUndefinedOrNull(this.metadata)){
                    this.metadata._useToolingApi = true;
                }
            }
            // Get data
            if(isNotUndefinedOrNull(this.metadata)){
                const _connector = this.metadata?._useToolingApi?this.connector.conn.tooling:this.connector.conn;
                this.record = await fetch_data(_connector,this.sobjectName,this.recordId);
                //console.log('this.record',this.record);
                //console.log('this.metadata',this.metadata);
                this.updateData(this.formatData());
                
                if(this.sobjectName === SOBJECT.contact){
                    const query = `SELECT Id, MemberId, NetworkId,Network.Name,Network.Status FROM NetworkMember Where Member.ContactId = '${this.recordId}' AND Network.Status = 'Live'`;
                    const networkMembers = await runSilent(async ()=>{return (await this.connector.conn.query(query)).records},[]);
                    console.log('networkMembers',networkMembers);
                    const retUrl = '/';
                    this.networkMembers = networkMembers.map(x => ({
                        ...x,
                        _redirectLink:`${this.connector.conn.instanceUrl}/servlet/servlet.su?oid=${encodeURIComponent(this.connector.header.orgId)}&retURL=${encodeURIComponent(retUrl)}&sunetworkid=${encodeURIComponent(x.NetworkId)}&sunetworkuserid=${encodeURIComponent(x.MemberId)}`
                    }))
                }
            }

            // Initiliaze Picklist Dependencies
            /*this.initDependencyManager({
                dependentFields: this.recordUi.objectInfo.dependentFields,
                picklistValues: filteredPicklistValues
            });*/

    
            
            this.isLoading = false;
        }catch(e){
            console.error(e);
            this.isError = true;
            this.isLoading = false;
        }
    }

    

    refreshData = async () => {
        //console.log('refreshData');
        try{
            this.isError = false;
            this.isLoading = true;
            
            // Get data
            if(isNotUndefinedOrNull(this.metadata)){
                const _connector = this.metadata?._useToolingApi?this.connector.conn.tooling:this.connector.conn;
                this.record = await fetch_data(_connector,this.sobjectName,this.recordId);
                this.updateData(this.formatData());
            }
            
            this.isLoading = false;
        }catch(e){
            console.error(e);
            this.isError = true;
            this.isLoading = false;
        }
    }

    updateData = (newData) => {
        // to force refresh
        this.data = null;
        this.data = newData;
    }

    formatData = () => {
        const formattedData = this.metadata.fields.map( x => {
            let {label,name,type} = x;
            return {
                name,label,type,
                fieldInfo:x,
                isVisible:true,
                value:this.record.hasOwnProperty(name)?this.record[name]:null
            }
        }).sort((a, b) => a.name.localeCompare(b.name));
        return formattedData;
    }



    @api
    updateFilter = (value) => {
        this.filter = value;
        this.scrollToTop();
        //this.pageNumber = 1; // reset not working with edit mode for now !
    }

    scrollToTop = () => {
        window.setTimeout(()=> {
            this.template.querySelector('.tableFixHead').scrollTo({ top: 0, behavior: 'auto' });
        },100);
    }

    filtering = (arr) => {
        //console.log('arr',arr);
        var regex = new RegExp('('+this.filter+')','i');
        var items = arr.map(item => {
            if(typeof item.value == 'object' && item.value !== null){
                item.value = JSON.stringify(item.value, null, 2);
            }
            const _value = this.isInfoDisplayed?item.type:item.value;

            item.isVisible = isEmpty(this.filter) || (this.filter === 'false' && _value === false || this.filter === 'true' && _value === true || this.filter === 'null' && _value === null);
            item.isVisible = item.isVisible || (_value != false && _value != true && regex.test(_value) || regex.test(item.name) || regex.test(item.label));
            return item;
        })
        /** Extra filter */

        if(this.isViewChangeFilterEnabled){
            const allModifiedFields = this.modifiedRows.map(x => x.fieldName);
            items = items.map(item => ({
                ...item,
                isVisible:allModifiedFields.includes(item.name)
            }));
        }
        
    
       return items;
    }

    /*
    initDependencyManager(dependencyInfo) {
        if (!this._depManager) {
            this._depManager = new DependencyManager(dependencyInfo);
        } else {
            this._depManager.registerDependencyInfo(dependencyInfo);
        }
    }*/
    

    saveRecord = async () => {
        this.isSaving = true;
        
        const _connector = this.metadata?._useToolingApi?this.connector.conn.tooling:this.connector.conn;

        const allModifiedRows = [...this.template.querySelectorAll('extension-record-explorer-row')].filter(item => item.isDirty)
        const toUpdate = {
            Id: this.record.Id
        };

        allModifiedRows.forEach(x => {
            toUpdate[x.name] = x.newValue
        });
        

        try{
            
            const res = await _connector.sobject(this.sobjectName).update([toUpdate]);
            const response = res[0];
            console.log('###### response ######',response);
            if (response.success) {
                Toast.show({
                    label: 'Record saved successfully',
                    variant:'success',
                });
                //console.log(`Updated Successfully : ${ret.id}`);
                this.resetEditing();
                refreshCurrentTab();
            }else{
                this.isViewChangeFilterEnabled = true; // To display all the modified fields in case of error.
                const fieldErrorSet = {};
                const fieldErrorGlobal = [];
                // Need to improve in the futur
                response.errors.forEach(error => {
                    error.fields.forEach(field => {
                        fieldErrorSet[field] = error;
                    });
                    if(error.fields.length == 0){
                        fieldErrorGlobal.push(error);
                    }
                });
                this.fieldErrors = fieldErrorSet;
                
                if(fieldErrorGlobal.length > 0){
                    let label = fieldErrorGlobal[0].statusCode?fieldErrorGlobal[0].statusCode:'Update Error';
                    Toast.show({
                        message: fieldErrorGlobal[0].message,
                        label: label,
                        variant: 'error',
                        mode: 'sticky'
                    });
                }
            }
        }catch(e){
            /** Global Errors are handled here **/
            this.isViewChangeFilterEnabled = true; // To display all the modified fields in case of error.
            console.error(e);
            const label = e.errorCode?e.errorCode:'Update Error';
            Toast.show({
                message: e.message,
                label: label,
                variant: 'error',
                mode: 'dismissible'
            });
        }
        

        this.isSaving = false;

    }

    resetEditing = () => {
        this.isEditMode = false;
        this.isSaving = false;
        this.modifiedRows = [];
        this.isViewChangeFilterEnabled = false;
        let rows = this.template.querySelectorAll('extension-record-explorer-row');
            rows.forEach(row => {
                row.disableInputField();
            });
        this.refreshData();
    }

    /** Events **/
    

    handleScroll(event) {
        //console.log('handleScroll');
        const target = event.target;
        const scrollDiff = Math.abs(target.clientHeight - (target.scrollHeight - target.scrollTop));
        const isScrolledToBottom = scrollDiff < 5; //5px of buffer
        if (isScrolledToBottom) {
            // Fetch more data when user scrolls to the bottom
            this.pageNumber++;
        }
    }

    handleCopyId = () => {
        navigator.clipboard.writeText(this.recordId);
        Toast.show({
            label: 'RecordId exported to your clipboard',
            variant:'success',
        });
    }

    redirectDoc = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const params = {
            type:'application',
            attributes:{
                applicationName:'documentation',
                attribute1:this.isUsingToolingApi?'atlas.en-us.api_tooling.meta':'atlas.en-us.object_reference.meta'
            },
            state:{
                name:this.isUsingToolingApi?`tooling_api_objects_${this.sobjectName.toLowerCase()}`:`sforce_api_objects_${this.sobjectName.toLowerCase()}`
            }
        };

        store.dispatch(store_application.fakeNavigate(params));
    }

    handleRefreshClick = () => {
        this.refreshData();
    }

    handleInfoToggle = () => {
        this.isloading = true;
        window.setTimeout(() => {
            this.isInfoDisplayed = !this.isInfoDisplayed;
            this.isloading = false;
        },1)
    }

    handleCancelClick = () => {
        this.resetEditing();
    }

    handleSaveClick = () => {
        // Save data;
        this.saveRecord();
    }

    handleEnabledEditMode = (e) => {
        const { fieldName } = e.detail;
        this.editingFieldSet.add(fieldName);
        this.isEditMode = true;
        /*let rows = this.template.querySelectorAll('extension-record-explorer-row');
            rows.forEach(row => {
                row.enableInputField();
            });*/
    }

    handleToggleFieldName = () => {
        this.isLabelDisplayed = !this.isLabelDisplayed;
    }

    /*
    registerDependentField(e) {
        e.stopPropagation();

        const { fieldName, fieldElement } = e.detail;
        this._depManager.registerField({ fieldName, fieldElement });
    }

    updateDependentFields(e) {
        e.stopPropagation();

        if (this._depManager) {
            this._depManager.handleFieldValueChange(
                e.detail.fieldName,
                e.detail.value
            );
        }
    }
    */

    handleRowInputChange = (e) => {
        e.stopPropagation();
        //console.log('handleRowInputChange',e);
        const allModifiedRows = [...this.template.querySelectorAll('extension-record-explorer-row')].filter(item => item.isDirty);
        this.modifiedRows = allModifiedRows.map(x => ({fieldName:x.name}));
        //console.log('modifiedRows',this.modifiedRows);
    }

    handleViewChanges_filter = (e) => {
        this.isViewChangeFilterEnabled = !this.isViewChangeFilterEnabled;
    }

    /** Getters */

    get isNetworkMemberListDisplayed(){
        return this.networkMembers.length > 0;
    }

    get modifiedRowsTotal(){
        return this.modifiedRows.length;
    }

    get viewChangeLabel(){
        return this.isViewChangeFilterEnabled?'Unfilter Changes':'Filter Changes';
    }

    get labelPlural(){
        return this.metadata?.labelPlural;
    }

    get label(){
        return this.metadata?.label;
    }

    get keyPrefix(){
        return this.metadata?.keyPrefix;
    }

    get fieldLabel(){
        return this.isLabelDisplayed ? 'Label' : 'Field';
    }


    get linkConfig(){
        return {
            host:this.currentOrigin,
            sobjectName:this.sobjectName,
            durableId:this.metadata?.durableId,
            isCustomSetting:this.metadata?.IsCustomSetting,
            keyPrefix:this.metadata?.keyPrefix
        }
    }

    get objectSetupLink(){
        return getObjectSetupLink(this.linkConfig);
    }

    get objectFieldsSetupLink(){
        return getObjectFieldsSetupLink(this.linkConfig);
    }

    get recordTypesLink(){
        return getRecordTypesLink(this.linkConfig);
    }

    get objectListLink(){
        return getObjectListLink(this.linkConfig);
    }

    get objectDocLink(){
        return getObjectDocLink(this.sobjectName,this.isUsingToolingApi);
    }

    get virtualList(){
        // Best UX Improvement !!!!
        // return this.formattedData.slice(0,this.pageNumber * PAGE_LIST_SIZE);
        const allModifiedFields = this.modifiedRows.map(x => x.fieldName);
        const virtualList = [];
        this.formattedData.forEach((x,i) => {
            if(virtualList.length < this.pageNumber * PAGE_LIST_SIZE && x.isVisible){
                virtualList.push(x);
            }else if(allModifiedFields.includes(x.name)){
                virtualList.push({
                    ...x,
                    isVisible:false
                })
            }
        });
        return virtualList;
    }

    get formattedData(){

        return this.filtering(this.data);
    }

    get isRecordIdAvailable(){
        return isNotUndefinedOrNull(this.recordId) && !this.isError;
    }

    get isChangeMessageDisplayed(){
        return this.modifiedRowsTotal > 0;
    }

    get versions_options(){
        return this.versions.map(x => ({
            label:x.label,
            value:x.version
        }));
    }

    get displayRecordHeader(){
        return !this.isLoading && !this.isSaving;
    }

    get isSaveButtonDisabled(){
        return this.modifiedRowsTotal <= 0 || this.isSaving;
    }

    get isCancelButtonDisabled(){
        return this.isSaving;
    }

    get isUsingToolingApi(){
        return this.metadata?._useToolingApi;
    }

    get docLinkTitle(){
        return this.metadata?._useToolingApi ?'Tooling':'Standard';
    }

}