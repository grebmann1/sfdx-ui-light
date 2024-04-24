import { api,track} from "lwc";
import FeatureElement from 'element/featureElement';
import { isEmpty,isElectronApp,classSet,isNotUndefinedOrNull,runActionAfterTimeOut,formatFiles,sortObjectsByField } from 'shared/utils';

const DEFAULT_NAMESPACE = 'Default';
const ALL_NAMESPACE     = 'All';

export default class Menu extends FeatureElement {
    _isRendered = true;
    @api title;
    @api isLoading = false;
    @api isBackDisplayed = false;
    @api hideSearch = false;
    @api level;
    @api highlight; // Like filtering but only highlighting the record

    // Filter
    filter;
    @api keepFilter = false;
    // Scrolling
    pageNumber = 1;

    
    observer
    namespacePrefixes = [];
    namespaceFiltering_value = DEFAULT_NAMESPACE;

    
    @track _items = [];
    @api
    get items(){
        return this._items;
    }
    set items(value){
        this._items = (JSON.parse(JSON.stringify(value)));
        this.namespacePrefixes = this.extractNamespaces(this._items);
        this.pageNumber = 1; // reset
        if(!this.keepFilter){
            this.filter = null; // reset;
        }
    }
    @api selectedItem;


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
    
    
    namespaceFiltering_handleChange = (e) => {
        this.namespaceFiltering_value = e.detail.value;
    }

    handleSearch = (e) => {
        runActionAfterTimeOut(e.detail.value,(newValue) => {
            this.filter = newValue;
        },1000);
    }

    handleSelection = (e) => {
        this.selectedItem = e.detail.name;
        const index     = this.items.findIndex(x => x.name === e.detail.name);
        const oldIndex  = this.items.findIndex(x => x.isSelected);
        if(oldIndex > -1){
            this._items[oldIndex].isSelected = false;
        }
        if(index > -1){
            this._items[index].isSelected = true;
        }
        
        this.dispatchEvent(new CustomEvent("menuselection", { detail:{
            ...this.items[index]
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

    get virtualList(){
        // Best UX Improvement !!!!
        return this.filteredList.slice(0,this.pageNumber * 100);
    }
    
    get filteredList(){
        if(isEmpty(this.filter)) return this.namespaceFiltered;
        return this.namespaceFiltered.filter(x => this.checkIfPresent(x.name,this.filter) || this.checkIfPresent(x.label,this.filter));
    }

    get displayIfEmpty(){
        return !this.isLoading && this.items.length == 0;
    }
    
}