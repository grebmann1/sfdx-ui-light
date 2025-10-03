import { track, wire } from 'lwc';
import ToolkitElement from 'core/toolkitElement';
// Persistence is handled in the SMARTINPUT store slice
import { connectStore, store, SMARTINPUT } from 'core/store';
import { guid, isNotUndefinedOrNull } from 'shared/utils';
import { CATEGORY_SYSTEM, CATEGORY_CUSTOM } from 'smartinput/utils';
// AI logic moved to composer

export default class App extends ToolkitElement {
    /**
     * UI State (non-persisted)
     */
    // Side panel
    isSidePanelOpen = true;
    categorySearchFields = ['name'];
    minSearchLengthForCategories = 2;
    hideSearchInputForCategories = false;
    includeFoldersInResultsForCategories = false;

    /**
     * Categories + Items State (persisted in SMARTINPUT store)
     */
    @track categories = [];
    @track activeCategoryId = null;
    @track isLoading = false;
    @track isEnhanceEnabled = false;
    @track inputValue = '';
    @track editingItemId = null;
    @track editingValue = '';
    @track itemCounter = 1;
    @track showFavoritesOnly = false;

    @track isLeftToggled = true;

    /**
     * Store wiring - syncs local reactive state with the SMARTINPUT slice
     */
    @wire(connectStore, { store })
    storeChange({ application, smartInput }) {
        const isCurrentApp = this.verifyIsActive(application.currentApplication);
        if(isNotUndefinedOrNull(application.openaiKey)) {
            this.isEnhanceEnabled = true;
        }
        if (!isCurrentApp) return;
        if (smartInput) {
            this.categories = smartInput.categories || [];
            this.activeCategoryId = smartInput.activeCategoryId || null;
            this.isSidePanelOpen = !!smartInput.isLeftPanelOpen;
            this.isLeftToggled = !!smartInput.isLeftPanelOpen;
            this.itemCounter = smartInput.itemCounter || 1;
        }
    }

    /**
     * Lifecycle
     */
    connectedCallback() {
        // Load cached SMARTINPUT settings immediately
        this.init();
    }

    /**
     * Header / Left Panel Handlers
     */
    handleLeftToggle = () => {
        store.dispatch(SMARTINPUT.reduxSlice.actions.toggleLeftPanel());
    };

    handleFavoritesToggle = () => {
        this.showFavoritesOnly = !this.showFavoritesOnly;
    };

    createNewCategory = () => {
        // Alias for Add Category
        this.handleAddCategory();
        // open left panel
        store.dispatch(SMARTINPUT.reduxSlice.actions.setLeftPanelOpen(true));
    };

    /**
     * Category Tree Handlers
     */
    handleCategorySelect = (e) => {
        const { id } = e.detail?.item || {};
        if (!id) return;
        const category = this.categoryTree.find(p => p.id === id);
        if (!category) return;
        store.dispatch(SMARTINPUT.reduxSlice.actions.setActiveCategoryId(id));
    };

    handleDeleteItem = async (e) => {
        const { id } = e.detail.item || {};
        if (!id) return;
        
        // Delete category by id only (flat list)
        store.dispatch(SMARTINPUT.reduxSlice.actions.deleteItemOrCategory(id));
    };

    /**
     * Initialization
     */
    async init() {
        store.dispatch(SMARTINPUT.loadCacheSettingsAsync());
    }

    // NOTE: Persistence is handled by the SMARTINPUT reducers

    /**
     * Category Actions
     */
    async handleAddCategory() {
        const baseName = 'New Category';
        const existing = new Set(this.categoryTree.map(p => (p.name || '').trim()));
        let name = baseName;
        if (existing.has(name)) {
            let index = 2;
            while (existing.has(`${baseName} ${index}`)) index++;
            name = `${baseName} ${index}`;
        }
        const category = { id: guid(), name, items: [], createdAt: Date.now(), type: CATEGORY_CUSTOM };
        // Let the store assign the Category ref and persist
        store.dispatch(SMARTINPUT.reduxSlice.actions.addCategory(category));
    }

    /**
     * Composer Handlers
     */
    // removed change binding from composer; input is managed locally in composer

    handleReset = () => {
        this.inputValue = '';
    };

    handleCreateItems = async (e) => {
        const items = (e.detail?.items || []).map(v => (v || '').toString().trim()).filter(Boolean);
        if (items.length === 0) return;
        const category = { ...this.activeCategory };
        if (!category) return;
        // Use highest existing code within the active category to avoid unnecessary increments
        const highestInCategory = Math.max(
            0,
            ...((category.items || []).map(it => (Number.isFinite(it?.code) ? it.code : 0)))
        );
        let nextCounter = highestInCategory + 1;
        const newItems = items.map(value => {
            const code = nextCounter++;
            return { id: guid(), value, code, ref: `${category.ref || ''}${code}`, isFavorite: false}
        });
        category.items = [...(category.items || []), ...newItems];
        const next = (this.categories || []).map(p => (p.id === category.id ? category : p));
        this.categories = next;
        store.dispatch(SMARTINPUT.reduxSlice.actions.setCategories(next));
        this.inputValue = '';
    };

    /**
     * Item List Handlers
     */

    handleItemDeleteClick = async (e) => {
        const { id } = e.detail || {};
        if (!id) return;
        await this.deleteItemById(id);
    };

    handleItemEditClick = async (e) => {
        const { id } = e.detail || {};
        if (!id) return;
        const current = (this.inputs || []).find(x => x.id === id);
        this.editingItemId = id;
        this.editingValue = current?.value || '';
    };

    handleInlineEditChange = (e) => {
        this.editingValue = e.detail?.value ?? e.target.value;
    };

    handleInlineEditSave = async (e) => {
        const id = e.detail?.id;
        if (!id) return;
        const value = (this.editingValue || '').trim();
        if (!value) return;
        const category = { ...this.activeCategory };
        if (!category) return;
        category.items = (category.items || []).map(it => (it.id === id ? { ...it, value } : it));
        const next = (this.categories || []).map(p => (p.id === category.id ? category : p));
        this.categories = next;
        store.dispatch(SMARTINPUT.reduxSlice.actions.setCategories(next));
        // persisted via reducers
        this.editingItemId = null;
        this.editingValue = '';
    };

    handleInlineEditCancel = () => {
        this.editingItemId = null;
        this.editingValue = '';
    };

    deleteItemById = async (id) => {
        const category = { ...this.activeCategory };
        if (!category) return;
        category.items = (category.items || []).filter(it => it.id !== id);
        const next = (this.categories || []).map(p => (p.id === category.id ? category : p));
        this.categories = next;
        store.dispatch(SMARTINPUT.reduxSlice.actions.setCategories(next));
        // persisted via reducers
    };

    handleItemFavoriteChange = (e) => {
        const { id } = e.detail || {};
        if (!id) return;
        const category = { ...this.activeCategory };
        if (!category) return;
        category.items = (category.items || []).map(it => (it.id === id ? { ...it, isFavorite: !it.isFavorite } : it));
        const next = (this.categories || []).map(p => (p.id === category.id ? category : p));
        this.categories = next;
        store.dispatch(SMARTINPUT.reduxSlice.actions.setCategories(next));
    };

    /**
     * Category name editing using slds-field
     */
    categoryName_disableEvent = (event) => {
        event.stopPropagation();
        event.preventDefault();
    };

    categoryName_onChange = async (event) => {
        const value = (event.detail && event.detail.value) || '';
        const name = (value || '').trim();
        const category = { ...this.activeCategory };
        if (!category) return;
        if (name && name !== category.name) {
            category.name = name;
            const next = (this.categories || []).map(p => (p.id === category.id ? { ...category } : p));
            this.categories = next;
            store.dispatch(SMARTINPUT.reduxSlice.actions.setCategories(next));
            // persisted via reducers
        }
    };

    /**
     * AI helper - Enhance an input using configured OpenAI provider via shared utils
     */
    // AI generation handled in composer

    // Getters

    get pageClass() {
        //Overwrite
        return super.pageClass + ' slds-p-around_small';
    }

    get formattedCategoryTree() {
        return this.categoryTree.map(category => {
            const isSystem = category.type === CATEGORY_SYSTEM;
            const children = (category.items || []);
            return {
                id: category.id,
                name: category.name,
                label: category.name,
                icon: category.type === CATEGORY_CUSTOM ? 'utility:knowledge_smart_link' : 'utility:pinned',
                isReadOnly: isSystem,
                isDeletable: !isSystem,
                ...(children.length > 0) && { children: children.map(it => ({
                    id: it.id,
                    name: it.value || it.name || '',
                    title: it.value || it.name || '',
                    isDeletable: true,
                }))},
            };
        });
    }
    
    get categoryTree() {
        return [...this.categories];
    }

    get activeCategory() {
        const category = this.categoryTree.find(p => p.id === this.activeCategoryId);
        if (!category) return null;
        return {
            ...category,
            _isReadOnly: category.type === CATEGORY_SYSTEM,
        };
    }

    get inputs() {
        return this.activeCategory?.items || [];
    }

    // Enhance disabled state handled in composer

    get displayedInputs() {
        let list = (this.inputs || []);
        if (this.showFavoritesOnly) {
            list = list.filter(x => !!x.isFavorite);
        }
        return list
            .map(x => ({
                ...x,
                disabled: false,
                isEditing: x.id === this.editingItemId,
            }))
            .reverse();
    }

    get hasDisplayedInputs() {
        return (this.displayedInputs || []).length > 0;
    }
}


