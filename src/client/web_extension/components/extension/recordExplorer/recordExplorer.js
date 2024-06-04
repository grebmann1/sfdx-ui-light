import { createElement,api,track} from "lwc";
import FeatureElement from 'element/featureElement';
import { connectStore,store,store_application } from 'shared/store';

import {runActionAfterTimeOut,isEmpty,isNotUndefinedOrNull,isUndefinedOrNull} from 'shared/utils';
import { getCurrentTab,getCurrentObjectType,fetch_data,fetch_metadata,
    getObjectSetupLink,getObjectFieldsSetupLink,getRecordTypesLink,getObjectListLink,getObjectDocLink
} from "extension/utils";

const PAGE_LIST_SIZE    = 70;
const TOOLING = 'tooling';

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
    data;
    filter = '';
    isError = false;

    // Scrolling
    pageNumber = 1;
    //entities = new Map();

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
                this.data = this.formatData();
            }
            
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
                this.data = this.formatData();
            }
            
            this.isLoading = false;
        }catch(e){
            console.error(e);
            this.isError = true;
            this.isLoading = false;
        }
    }

    formatData = () => {
        return this.metadata.fields.map( x => {
            let {label,name,type} = x;
            return {
                name,label,type,
                value:this.record.hasOwnProperty(name)?this.record[name]:null
            }
        }).sort((a, b) => a.label.localeCompare(b.label));
    }



    @api
    updateFilter = (value) => {
        this.filter = value;
        this.pageNumber = 1; // reset
    }

    filtering = (arr) => {
    
        var items = [];
        var regex = new RegExp('('+this.filter+')','i');
        for(var key in arr){
            var item = arr[key];
            if(typeof item.value == 'object' && item.value !== null){
                item.value = JSON.stringify(item.value, null, 2);
            }
    
            if(this.filter === 'false' && item.value === false || this.filter === 'true' && item.value === true || this.filter === 'null' && item.value === null){
                items.push(item);
                continue;
            }
              
            if(item.value != false && item.value != true && regex.test(item.value) || regex.test(item.name) || regex.test(item.label)){
                items.push(item);
                continue;
            }
        }
    
       return items;
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

    refresh_handleClick = () => {
        this.refreshData();
    }


    /** Getters */

    get labelPlural(){
        return this.metadata?.labelPlural;
    }

    get label(){
        return this.metadata?.label;
    }

    get keyPrefix(){
        return this.metadata?.keyPrefix;
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
        return this.formattedData.slice(0,this.pageNumber * PAGE_LIST_SIZE);
    }

    get formattedData(){
        return this.filtering(this.data);
    }

    get isRecordIdAvailable(){
        return isNotUndefinedOrNull(this.recordId) && !this.isError;
    }

    get versions_options(){
        return this.versions.map(x => ({
            label:x.label,
            value:x.version
        }));
    }

    get hasLoaded(){
        return !this.isLoading;
    }

    get isUsingToolingApi(){
        return this.metadata?._useToolingApi;
    }

    get docLinkTitle(){
        return this.metadata?._useToolingApi ?'Tooling':'Standard';
    }

}