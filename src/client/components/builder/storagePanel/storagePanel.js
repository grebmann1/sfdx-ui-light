import { wire, api } from 'lwc';
import ToolkitElement from 'core/toolkitElement';
import { store,connectStore,SELECTORS,DESCRIBE,SOBJECT,QUERY,UI } from 'core/store';
export const CATEGORY_STORAGE = {
    RECENT:'recent',
    SAVED:'saved'
}
export default class StoragePanel extends ToolkitElement {
    @api recentItems;
    @api savedItems;
    @api size;
    @api title;
    @api isOpen;

    @api savedTitle
    @api recentTitle;
    
    @wire(connectStore, { store })
    storeChange({ ui }) {
        /*if (ui.recentQueries) {
            this.recentQueries = ui.recentQueries.map((query, index) => {
                return { key: `${index}`, soql: query };
            });
        }*/
    }

    connectedCallback() {
        //console.log('Ui',UI);
        //store.dispatch(UI.reduxSlice.actions.loadRecentQueries({alias:this.connector.configuration.alias}));
    }

    selectItem(event) {
        const { id,category } = event.currentTarget.dataset;
        const items = category == CATEGORY_STORAGE.RECENT?this.recentItems:this.savedItems;
        const selectedItem = items.find(
            item => item.id === id
        );
        if (selectedItem) {
            this.dispatchEvent(new CustomEvent("selectitem", { detail:{
                category,
                ...selectedItem
            },bubbles: true,composed:true }));
        }
    }

    removeItem(event){
        const { id,category } = event.currentTarget.dataset;
        const items = category == CATEGORY_STORAGE.RECENT?this.recentItems:this.savedItems;
        const selectedItem = items.find(
            item => item.id === id
        );
        if (selectedItem) {
            console.log('removeItem');
            this.dispatchEvent(new CustomEvent("removeitem", { detail:{
                category,
                ...selectedItem
            },bubbles: true,composed:true }));
        }
    }

    get hasSavedItems(){
        return this?.savedItems.length > 0;
    }

    get hasRecentItems(){
        return this?.recentItems.length > 0;
    }

    get formattedSavedItems(){
        return this.savedItems.map(item => ({
            ...item,
            iconName:item.isGlobal?'utility:world':'utility:privately_shared'
        }))
    }
}
