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

    // Optional: enable import/export actions for saved items
    @api enableImportExport = false;
    @api exportFileName = 'sf-toolkit-saved-items.json';

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
        const toLeaf = (item) => {
            const method = item?.extra?.method || '';
            const endpoint = item?.extra?.endpoint || '';
            const folder = item?.extra?.folder || '';
            const tags = item?.extra?.tags || [];
            return {
                ...item,
                id: item.id,
                name: item.name || item.id,
                title: `${method}${method ? ' ' : ''}${endpoint}`.trim() || (item.name || item.id),
                method,
                endpoint,
                folder,
                tags,
                isLeaf: true,
                icon: 'utility:snippet',
                isDeletable: true,
            };
        };

        const groupByFolder = (items, rootId) => {
            const map = new Map();
            for (const it of items) {
                const f = it?.extra?.folder ? String(it.extra.folder).trim() : '';
                const key = f || 'Unfiled';
                const list = map.get(key) || [];
                list.push(toLeaf(it));
                map.set(key, list);
            }
            return Array.from(map.entries())
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([folderName, children]) => ({
                    id: `${rootId}:folder:${folderName.toLowerCase()}`,
                    name: folderName,
                    children: children.sort((a, b) => String(a.name).localeCompare(String(b.name))),
                    icon: 'utility:open_folder',
                }));
        };

        const globalItems = (this.savedItems || []).filter(item => item.isGlobal);
        const orgItems = (this.savedItems || []).filter(item => !item.isGlobal);

        const tree = [];
        if (globalItems.length) {
            tree.push({
                id: 'global-folder',
                name: 'Global',
                icon: 'utility:world',
                children: groupByFolder(globalItems, 'global-folder'),
            });
        }
        if (orgItems.length) {
            tree.push({
                id: 'org-folder',
                name: 'Org Specific',
                icon: 'utility:privately_shared',
                children: groupByFolder(orgItems, 'org-folder'),
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

    handleExportSavedClick = () => {
        this.dispatchEvent(
            new CustomEvent('exportsaved', {
                detail: {
                    items: this.savedItems || [],
                    fileName: this.exportFileName,
                },
                bubbles: true,
                composed: true,
            })
        );
    };

    handleImportSavedClick = () => {
        const input = this.template.querySelector('input[data-id="importSaved"]');
        if (input) {
            input.value = null; // allow re-importing same file
            input.click();
        }
    };

    handleImportFileChange = (event) => {
        const file = event.target.files && event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            const text = String(reader.result || '');
            this.dispatchEvent(
                new CustomEvent('importsaved', {
                    detail: {
                        text,
                        fileName: file.name,
                    },
                    bubbles: true,
                    composed: true,
                })
            );
        };
        reader.readAsText(file);
    };

    get savedSearchFields() {
        return ['name', 'id', 'title', 'method', 'endpoint', 'folder', 'tags'];
    }
}
