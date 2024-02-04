import { api} from "lwc";
import FeatureElement from 'element/featureElement';
import { isEmpty,isElectronApp,classSet,isNotUndefinedOrNull,runActionAfterTimeOut,formatFiles,sortObjectsByField } from 'shared/utils';



export default class Menu extends FeatureElement {

    @api title;
    @api isLoading = false;
    @api isBackDisplayed;
    @api level;

    @api
    get items(){
        return this._items;
    }
    set items(value){
        this._items = value;
        this.filter = null; // reset;
    }
    

    filter;

    /** Events **/

    handleSearch = (e) => {
        runActionAfterTimeOut(e.detail.value,(newValue) => {
            this.filter = newValue;
        });
    }

    handleSelection = (e) => {
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
    
    checkIfPresent = (a,b) => {
        return (a || '').toLowerCase().includes((b||'').toLowerCase());
    }

    /* Getters */
    
    get filteredList(){
        if(isEmpty(this.filter)) return this.items;
        return this.items.filter(x => this.checkIfPresent(x.Name,this.filter));
    }

    get displayIfEmpty(){
        return !this.isLoading && this.items.length == 0;
    }
    
}