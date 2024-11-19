import { api,track} from "lwc";
import ToolkitElement from 'core/toolkitElement';
import { isEmpty,isSalesforceId,classSet,isUndefinedOrNull,isNotUndefinedOrNull} from 'shared/utils';
import { store,store_application } from 'shared/store';

const PAGE_LIST_SIZE = 100;
export default class StructureViewerItem extends ToolkitElement {
    @api title;
    @api value;
    @api items;

    @api isOpen = false;

    hasLoaded = false;

    pageNumber = 1

    connectedCallback(){
        window.setTimeout(() => {
            this.hasLoaded = true;
        },1)
    }
    

    /** Events **/

    goToUrl = (e) => {
        e.preventDefault();
        const redirectUrl = e.currentTarget.dataset.url;
        //console.log('redirectUrl',redirectUrl);
        store.dispatch(store_application.navigate(redirectUrl));
    }

    onClickItem = (e) => {
        e.stopPropagation();
        this.isOpen = !this.isOpen;
    }

    /* Methods **/

    @api
    expandAll = () => {
        this.isOpen = true;
        window.setTimeout(() => {
            var items = this.template.querySelectorAll("slds-structure-viewer-item");
            for (var i = 0; i < items.length; i++) {
                items[i].expandAll();
            }
        },1)
        
    }

    @api 
    collapseAll = () => {
        this.isOpen = false;
        window.setTimeout(() => {
            var items = this.template.querySelectorAll("slds-structure-viewer-item");
            for (var i = 0; i < items.length; i++) {
                items[i].collapseAll();
            }
        },1)
        
    }

    handleLoadMore = (e) =>{
        e.preventDefault();
        e.stopPropagation();
        this.pageNumber++;
    } 


    /** Getters **/

    get hasItems(){
        return this.formattedItems.length > 0;
    }

    get hasDefaultItems(){
        return isNotUndefinedOrNull(this.items) && this.items.length > 0;
    }

    get displayCounter(){
        return this.hasDefaultItems || isNotUndefinedOrNull(this.value) && Array.isArray(this.value);
    }

    get counter(){
        return this.formattedItems.length;
    }

    get itemClass(){
        return classSet("submenu").add({
            'icon-open':this.isOpen && this.hasItems,
            'icon-closed':!this.isOpen && this.hasItems,
        }).toString(); 
    }

    get isChildrenDisplayed(){
        return this.isOpen && isNotUndefinedOrNull(this.formattedItems);
    }
    
    get isSalesforceId(){
        return isNotUndefinedOrNull(this.value) && isSalesforceId(this.value);
    }

    get isJsonValue(){
        return isNotUndefinedOrNull(this.value) && typeof this.value === 'object' && !Array.isArray(this.value);
    }

    get isValueAvailable(){
        return isNotUndefinedOrNull(this.value) && !this.isJsonValue && !Array.isArray(this.value);
    }

    get isValueTrue(){
        return isNotUndefinedOrNull(this.value) && typeof this.value === 'boolean' && this.value;
    }

    get isValueFalse(){
        return isNotUndefinedOrNull(this.value) && typeof this.value === 'boolean' && !this.value;
    }

    get href(){
        return `/${this.value}`;
    }

    get formattedItems() {
        // Check if `this.items` is defined and is an array
        if (isNotUndefinedOrNull(this.items) && Array.isArray(this.items)) {
            return this.items;
        }
    
        // Check if `this.isJsonValue` is true
        if (this.isJsonValue) {
            return Object.keys(this.value).map(key => ({
                key,
                value: this.value[key]
            }));
        }
    
        // Check if `this.value` is defined and is an array
        if (isNotUndefinedOrNull(this.value) && Array.isArray(this.value)) {
            return this.value.map((item, index) => {
                const {
                    name,
                    Name,
                    developerName,
                    DeveloperName,
                    masterLabel,
                    MasterLabel
                } = item;
    
                // Determine the key name
                const keyName = name || Name || developerName || DeveloperName || masterLabel || MasterLabel || `${this.title}[${index}]`;
    
                return {
                    key: keyName,
                    value: item
                };
            });
        }
    
        // Default return value if none of the conditions are met
        return [];
    }

    get virtualList(){
        // Best UX Improvement !!!!
        return this.formattedItems.slice(0,this.pageNumber * PAGE_LIST_SIZE);
    }

    get hasMoreRecords(){
        return this.virtualList.length < this.formattedItems.length;
    }
}