import { api,track} from "lwc";
import FeatureElement from 'element/featureElement';
import { isEmpty,classSet,isUndefinedOrNull,isNotUndefinedOrNull} from 'shared/utils';

export default class StructureViewerItem extends FeatureElement {
    @api title;
    @api value;
    @api items;

    @api isOpen = false;

    hasLoaded = false;

    connectedCallback(){
        window.setTimeout(() => {
            this.hasLoaded = true;
        },1)
    }
    

    /** Events **/

    onClickItem = (e) => {
        e.stopPropagation();
        this.isOpen = !this.isOpen;
    }

    @api
    expandAll = () => {
        this.isOpen = true;
        window.setTimeout(() => {
            var items = this.template.querySelectorAll("metadata-structure-viewer-item");
            for (var i = 0; i < items.length; i++) {
                items[i].expandAll();
            }
        },1)
        
    }

    @api 
    collapseAll = () => {
        this.isOpen = false;
        window.setTimeout(() => {
            var items = this.template.querySelectorAll("metadata-structure-viewer-item");
            for (var i = 0; i < items.length; i++) {
                items[i].collapseAll();
            }
        },1)
        
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

    get formattedItems(){
        if(isNotUndefinedOrNull(this.items) && Array.isArray(this.items)) return this.items;
        if(this.isJsonValue){
            return Object.keys(this.value).map(key => ({key,value:this.value[key]}))
        }else if(isNotUndefinedOrNull(this.value) && Array.isArray(this.value)){
            return this.value.map((x,i) => {
                const name = x.Name || x.DeveloperName || x.MasterLabel || this.title;
                return {key:`${name}[${i}]`,value:x}
            })
        }
        return [];
    }
}