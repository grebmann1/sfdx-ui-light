import { wire, api } from 'lwc';
import ToolkitElement from 'core/toolkitElement';
import { store, connectStore, SELECTORS, DESCRIBE, SOBJECT, QUERY, UI } from 'core/store';
export const CATEGORY_STORAGE = {
    RECENT: 'recent',
    SAVED: 'saved',
};
export default class StoragePanel extends ToolkitElement {
    @api recentItems = [];
    @api savedItems;
    @api size;
    @api title;
    @api isOpen;

    @api savedTitle;
    @api recentTitle;

    // Disable Save Section
    @api isSavedItemDisabled = false;

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
        const { id, category } = event.currentTarget.dataset;
        const items = category == CATEGORY_STORAGE.RECENT ? this.recentItems : this.savedItems;
        const selectedItem = items.find(item => item.id === id);
        if (selectedItem) {
            this.dispatchEvent(
                new CustomEvent('selectitem', {
                    detail: {
                        category,
                        ...selectedItem,
                    },
                    bubbles: true,
                    composed: true,
                })
            );
        }
    }

    removeItem(event) {
        const { id, category } = event.currentTarget.dataset;
        const items = category == CATEGORY_STORAGE.RECENT ? this.recentItems : this.savedItems;
        const selectedItem = items.find(item => item.id === id);
        if (selectedItem) {
            this.dispatchEvent(
                new CustomEvent('removeitem', {
                    detail: {
                        category,
                        ...selectedItem,
                    },
                    bubbles: true,
                    composed: true,
                })
            );
        }
    }

    get hasSavedItems() {
        return this?.savedItems.length > 0;
    }

    get hasRecentItems() {
        return this?.recentItems.length > 0;
    }

    get isSavedItemsDisplayed() {
        return !this.isSavedItemDisabled;
    }

    get formattedSavedItems() {
        return this.savedItems.map(item => ({
            ...item,
            iconName: item.isGlobal ? 'utility:world' : 'utility:privately_shared',
        }));
    }

    get savedTree() {
        // Separate global and org-specific items
        const globalItems = (this.savedItems || []).filter(item => item.isGlobal).map(item => ({
            ...item,
            id: item.id,
            name: item.name,
            isLeaf: true,
        }));
        const orgItems = (this.savedItems || []).filter(item => !item.isGlobal).map(item => ({
            ...item,
            id: item.id,
            name: item.name,
            isLeaf: true,
        }));
        // Only show folders if they have children
        const tree = [];
        if (globalItems.length) {
            tree.push({
                id: 'global-folder',
                name: 'Global',
                children: globalItems,
            });
        }
        if (orgItems.length) {
            tree.push({
                id: 'org-folder',
                name: 'Org Specific',
                children: orgItems,
            });
        }
        return tree;
    }

    selectedId = null;

    handleTreeSelect(event) {
        const { item } = event.detail;
        this.selectedId = item.id;
        // Find the item in savedItems
        const selectedItem = (this.savedItems || []).find(i => i.id === item.id);
        if (selectedItem) {
            this.dispatchEvent(
                new CustomEvent('selectitem', {
                    detail: {
                        category: CATEGORY_STORAGE.SAVED,
                        ...selectedItem,
                    },
                    bubbles: true,
                    composed: true,
                })
            );
        }
    }

    handleTreeDelete(event) {
        const { item } = event.detail;
        // Find the item in savedItems
        const selectedItem = (this.savedItems || []).find(i => i.id === item.id);
        if (selectedItem) {
            this.dispatchEvent(
                new CustomEvent('removeitem', {
                    detail: {
                        category: CATEGORY_STORAGE.SAVED,
                        ...selectedItem,
                    },
                    bubbles: true,
                    composed: true,
                })
            );
        }
    }
}
