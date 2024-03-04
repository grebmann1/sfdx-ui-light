import {LightningElement,wire,api,track} from "lwc";
import FeatureElement from 'element/featureElement';
import { CurrentPageReference,NavigationContext, generateUrl, navigate } from 'lwr/navigation';
import { groupBy,runActionAfterTimeOut,isUndefinedOrNull,isNotUndefinedOrNull,getFromStorage,classSet } from 'shared/utils';


const TYPEFILTER_OPTIONS = [
    { label: 'Object', value: 'object' },
    { label: 'Change Event', value: 'change' },
    { label: 'Platform Event', value: 'event' },
    { label: 'Custom Metadata', value: 'metadata' },
    { label: 'Feed', value: 'feed' },
    { label: 'History', value: 'history' },
    { label: 'Share', value: 'share' },
];

export default class App extends FeatureElement {
    @wire(NavigationContext)
    navContext;

    @track selectedItem;

    displayFilter = false;
    records = [];
    recordFilters = [];
    menuRecords = [];

    typeFilter_value = []; // by default

    _pageRef;
    @wire(CurrentPageReference)
    handleNavigation(pageRef){
        if(isUndefinedOrNull(pageRef)) return;
        if(JSON.stringify(this._pageRef) == JSON.stringify(pageRef)) return;
       
        if(pageRef?.attributes?.applicationName == 'sobject'){
            this._pageRef = pageRef;
            this.loadFromNavigation(pageRef);
        }

        
    }

    

    connectedCallback(){
        this.loadCachedSettings();
        this.loadAlls();
    }
    

    /** Events */

    handleCloseVerticalPanel = (e) => {
        this.displayFilter = false;
    }

    handleItemSelection = async (e) => {
        //this.selectedItem = e.detail.name;
        const objectName = e.detail.name;
        navigate(this.navContext,{
            type:'application',
            attributes:{
                applicationName:'sobject',
                attribute1:objectName,
            }
        });
    }

    filtering_handleClick = (e) => {
        this.displayFilter = !this.displayFilter;
    }

    typeFilter_onChange = (e) => {
        this.typeFilter_value = e.detail.value;
        localStorage.setItem('global-sobject-typeFilter_value',JSON.stringify(this.typeFilter_value));
        setTimeout(() => {
            this.recordFilters = this.filterRecords();
        },1);
    }

    /** Methods */

    loadFromNavigation = async ({state, attributes}) => {
        console.log('sobject - loadFromNavigation');
        const {applicationName,attribute1}  = attributes;
        if(applicationName != 'sobject') return; // Only for sobject

        if(attribute1){
            this.selectedItem = attribute1;
        }
        
    }

    extractCategory = (item) => {
        if(item.endsWith('ChangeEvent')){
            return 'change';
        }else if(item.endsWith('Feed')){
            return 'feed';
        }else if(item.endsWith('History')){
            return 'history';
        }else if(item.endsWith('Share')){
            return 'share';
        }else if(item.endsWith('__mdt')){
            return 'metadata';
        }
        return 'object'; // default value for the left over
    }

    filterRecords = () => {
        if(this.typeFilter_value.length == 0) return this.menuRecords;
        return this.menuRecords.filter(x => this.typeFilter_value.includes(x.category));
    }

    loadAlls = async () => {
        await this.describeAll();
    }

    load_toolingGlobal = async () => {
        let result = await this.connector.conn.describeGlobal();
        return result?.sobjects || [];
    }

    describeAll = async () => {
        this.isLoading = true;
        try{
            const records = (await this.load_toolingGlobal()) || [];
            this.records = records;
            this.menuRecords = records.map(x => ({
                label:`${x.label}(${x.name})`, // for slds-menu
                name:x.name, // for slds-menu
                key:x.name, // for slds-menu
                category:this.extractCategory(x.name)
            })).sort((a, b) => a.name.localeCompare(b.name));
            this.recordFilters = this.filterRecords();
        }catch(e){
            console.error(e);
        }
        this.isLoading = false;
    }

    

    loadCachedSettings = () => {
        if(isNotUndefinedOrNull(this.connector.header.alias)){
            this.typeFilter_value  = getFromStorage(localStorage.getItem('global-sobject-typeFilter_value'),['object']);
        }
    }


    /** Getters */

    get formattedMenuItems(){
        return this.recordFilters.map(x => ({
            ...x,
            isSelected:this.selectedItem == x.name
        }));
    }

    get typeFilter_options(){
        return TYPEFILTER_OPTIONS;
    }

    get filtering_variant(){
        return this.displayFilter?'brand':'border-filled';
    }
    
    get pageClass(){
        return super.pageClass+' slds-p-around_small';
    }
}