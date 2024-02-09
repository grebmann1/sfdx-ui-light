import { api} from "lwc";
import FeatureElement from 'element/featureElement';
import { isEmpty,isElectronApp,classSet,isNotUndefinedOrNull,runActionAfterTimeOut,formatFiles,sortObjectsByField } from 'shared/utils';

const DEFAULT_NAMESPACE = 'Default';
const ALL_NAMESPACE     = 'All';

export default class Menu extends FeatureElement {

    @api title;
    @api isLoading = false;
    @api isBackDisplayed = false;
    @api hideSearch = false;
    @api level;
    @api highlight; // Like filtering but only highlighting the record

    @api selectedItem;

    namespacePrefixes = [];
    namespaceFiltering_value;


    @api
    get items(){
        return this._items;
    }
    set items(value){
        this._items = value;
        this.filter = null; // reset;
        this.namespacePrefixes = this.extractNamespaces(value);
    }
    

    filter;

    /** Events **/
    
    namespaceFiltering_handleChange = (e) => {
        this.namespaceFiltering_value = e.detail.value;
    }

    handleSearch = (e) => {
        runActionAfterTimeOut(e.detail.value,(newValue) => {
            this.filter = newValue;
        });
    }

    handleSelection = (e) => {
        this.selectedItem = e.detail.name;
        const item = this.items.find(x => x.Name === e.detail.name);
        this.dispatchEvent(new CustomEvent("menuselection", { detail:{
            itemName:item.Name,
            itemLabel:item.Label,
            level:this.level
        },bubbles: true }));
    }

    goBack = (e) => {
        this.dispatchEvent(new CustomEvent("back", {bubbles: true }));
    }

    /** Methods **/
    extractNamespaces = (value) => {
        const result = new Set(['All']);
        (value || []).forEach(x => {
            result.add(x.NamespacePrefix || DEFAULT_NAMESPACE);
        })
        return [...result];
    }
    
    checkIfPresent = (a,b) => {
        return (a || '').toLowerCase().includes((b||'').toLowerCase());
    }

    /* Getters */

    get itemHighlight(){
        return this.filter || this.highlight;
    }
    
    get formattedLabel(){
        if(isEmpty(this.filter) && isEmpty(this.highlight)){
            return this.label;
        }
        var _filter = isEmpty(this.highlight)?this.filter:this.highlight;
        var regex = new RegExp('('+_filter+')','gi');
        if(regex.test(this.label)){
            return this.label.toString().replace(/<?>?/,'').replace(regex,'<span style="font-weight:Bold; color:blue;">$1</span>');
        }else{
            return this.label;
        }
    }
    
    get isSearchDisplayed(){
        return !this.hideSearch;
    }
    
    
    get namespaceFiltering_isDisplayed(){
        return this.namespaceFiltering_options.length > 2; // Default & All are there by default
    }
    
    get namespaceFiltering_options(){
        return this.namespacePrefixes.map(x => ({label:x,value:x}));
    }

    get namespaceFiltered(){
        if(this.namespaceFiltering_value == ALL_NAMESPACE || isEmpty(this.namespaceFiltering_value)) return this.items;
        return this.items.filter(x => isEmpty(x.NamespacePrefix) && this.namespaceFiltering_value === DEFAULT_NAMESPACE || this.namespaceFiltering_value === x.NamespacePrefix);
    }
    
    get filteredList(){
        if(isEmpty(this.filter)) return this.namespaceFiltered;
        return this.namespaceFiltered.filter(x => this.checkIfPresent(x.Name,this.filter) || this.checkIfPresent(x.Label,this.filter));
    }

    get displayIfEmpty(){
        return !this.isLoading && this.items.length == 0;
    }
    
}