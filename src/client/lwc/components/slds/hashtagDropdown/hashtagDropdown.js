import { LightningElement, api, track } from 'lwc';
import { isUndefinedOrNull, isNotUndefinedOrNull } from 'shared/utils';

export const checkQuery = (q) => {
    const reCompat = /(^|[^"])@(\S*)/g; // find all @ not preceded by "
    const matches = [...q.matchAll(reCompat)];
    const last = matches.at(-1);
    if (last) {
        const full = last[0].slice(last[1].length); // remove the possible leading char
        //const after = last[2];                       // text after @
        return full;
    }
    return null;
}

export default class HashtagDropdown extends LightningElement {
    @api items = [];
    @api maxItems = 8;
    @api top = 0;
    @api left = 0;

    @track activeIndex = 0;
    @track expandedMap = {};
    @track currentFolderId = null;
    @track filteredItems = [];
    @track isKeyboardMode = false;

    _isOpen = false;
    @api 
    set isOpen(value) {
        this._isOpen = value;
        if (this._isOpen) {
            // Calculate the items to display
            this.currentFolderId = null;
            this.activeIndex = 0;
            this.isKeyboardMode = false;
            this.computeFilteredItems();
        }
    }
    get isOpen() {
        return this._isOpen;
    }

    _query = '';
    @api get query() {
        return this._query;
    }
    set query(value) {
        this._query = value;
        this.currentFolderId = null;
        this.activeIndex = 0;
        this.isKeyboardMode = false;
        this.computeFilteredItems();
    }

    renderedCallback() {
        const el = this.template.querySelector('.slds-hashtag-dropdown');
        if (el) {
            el.style.top = `${this.top}px`;
            el.style.left = `${this.left}px`;
        }
    }

    @api reset() {
        this.activeIndex = 0;
    }

    @api highlightNext() {
        const len = this.filteredItems.length;
        if (len === 0) return;
        this.isKeyboardMode = true;
        this.activeIndex = Math.min(len - 1, this.activeIndex + 1);
        this.scrollActiveIntoView();
    }

    @api highlightPrev() {
        const len = this.filteredItems.length;
        if (len === 0) return;
        this.isKeyboardMode = true;
        this.activeIndex = Math.max(0, this.activeIndex - 1);
        this.scrollActiveIntoView();
    }

    @api selectHighlighted() {
        const list = this.filteredItems;
        const item = list[this.activeIndex];
        if (!item) return;
        this.isKeyboardMode = true;
        if (Array.isArray(item.items) && item.items.length > 0) {
            this.enterFolder(item);
            return;
        }
        this.dispatchSelect(item);
    }

    handleMouseOver = (e) => {
        this.isKeyboardMode = false;
        const idxStr = e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.index;
        const idx = parseInt(idxStr, 10);
        if (!isNaN(idx)) this.activeIndex = idx;
    };

    handleMouseDown = (e) => {
        e.preventDefault();
        this.isKeyboardMode = false;
        const action = e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.action;
        if (action === 'toggle') {
            const idx = parseInt(e.currentTarget.dataset.index, 10);
            const list = this.filteredItems;
            const item = list[idx];
            if (item) this.toggleExpand(item);
            return;
        }
        const idxStr = e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.index;
        const idx = parseInt(idxStr, 10);
        const list = this.filteredItems;
        const item = list[idx];
        if (!item) return;
        if (Array.isArray(item.items)) {
            this.enterFolder(item);
        } else {
            this.dispatchSelect(item);
        }
    };

    dispatchSelect(item) {
        this.dispatchEvent(new CustomEvent('itemselect', { detail: { item } }));
    }

    scrollActiveIntoView() {
        try {
            const el = this.template.querySelector(`li[data-index="${this.activeIndex}"]`);
            if (el && typeof el.scrollIntoView === 'function') {
                el.scrollIntoView({ block: 'nearest' });
            }
        } catch (_) {}
    }

    // ===== Tree helpers =====
    normalizeToTree(items) {
        const isTree = Array.isArray(items) && items.some(x => Array.isArray(x && x.items));
        if (isTree) return items;
        return (items || []).map(it => ({ id: it.id, ref: it.ref, label: it.label, value: it.value, items: [] }));
    }

    filterTree(nodes, tokenUpper) {
        if (!Array.isArray(nodes)) return [];
        const out = [];
        for (const node of nodes) {
            const refMatch = ((node.ref || '').toUpperCase().includes(tokenUpper));
            const labelMatch = ((node.label || '').toUpperCase().includes(tokenUpper));
            const valueMatch = ((node.value || '').toUpperCase().includes(tokenUpper));
            const subItems = isNotUndefinedOrNull(node.items) ? this.filterTree(node.items || [], tokenUpper) : null;
            if (tokenUpper ? (refMatch || labelMatch || valueMatch || subItems && subItems.length > 0) : true) {
                const copy = { ...node };
                if(subItems) {
                    copy.filteredItems = subItems;
                }
                copy._expanded = tokenUpper ? (subItems && subItems.length > 0) : !!this.expandedMap[copy.id];
                out.push(copy);
            }
        }
        return out;
    }

    flattenVisibleTree(nodes, level = 0, excludeParent = false) {
        const flat = [];
        for (const n of nodes || []) {
            if (!excludeParent || isUndefinedOrNull(n.items) && excludeParent ){
                flat.push({ ...n, level });
            }
            if (n._expanded && Array.isArray(n.items) && n.items.length > 0) {
                flat.push(...this.flattenVisibleTree(n.items, level + 1, excludeParent));
            }
        }
        return flat;
    }

    findNodeById(nodes, id) {
        for (const n of nodes || []) {
            if (n.id === id) return n;
            const found = this.findNodeById(n.items, id);
            if (found) return found;
        }
        return null;
    }
    

    toggleExpand(node) {
        if (!node || !node.id) return;
        this.expandedMap = { ...this.expandedMap, [node.id]: !this.expandedMap[node.id] };
        this.computeFilteredItems();
    }

    enterFolder(node) {
        if (!node || !node.id) return;
        this.currentFolderId = node.id;
        this.activeIndex = 0;
        this.computeFilteredItems();
    }


    computeFilteredItems = () => {
        const all = Array.isArray(this.items) ? this.items : [];
        const q = (this.query || '').trim();
        const full = checkQuery(q);
        if (!full) return [];
        // If it's manual filter, we don't want to show the parent node
        //const isManualFilter = (full !== '@');
        const queryWithoutAt = (full.substring(1) || '').toUpperCase(); // Important to uppercase

        // '@' only triggers the dropdown;
        const tree = this.normalizeToTree(all);
        console.log('tree',tree);
        const visible = this.filterTree(tree, queryWithoutAt);
        let flattened;
        if (this.currentFolderId) {
            const folderNode = this.findNodeById(visible, this.currentFolderId);
            const items = folderNode ? (folderNode.items || []) : [];
            flattened = this.flattenVisibleTree(items);
        } else {
            flattened = this.flattenVisibleTree(visible, 0);
        }
        const limited = this.maxItems > 0 ? flattened.slice(0, this.maxItems) : flattened;
        if (this.activeIndex >= limited.length) this.activeIndex = limited.length - 1;
        if (this.activeIndex < 0) this.activeIndex = 0;
        this.filteredItems = limited;
    }

    

    /** Getters **/

    get currentFolderName() {
        const all = Array.isArray(this.items) ? this.items : [];
        if (!this.currentFolderId) return '';
        const tree = this.normalizeToTree(all);
        const visible = this.filterTree(tree, ''); // no filtering by token
        const folderNode = this.findNodeById(visible, this.currentFolderId);
        return folderNode ? (folderNode.label || '') : '';
    }

    get viewItems() {
        return this.filteredItems.map((node, idx) => ({
            key: `${idx}-${node.id || node.label || node.value}`,
            id: node.id,
            label: node.label,
            ref: node.ref,
            value: node.value,
            level: node.level || 0,
            isExpandable: Array.isArray(node.items) && node.items.length > 0,
            isExpanded: !!node._expanded,
            chevronIcon: node._expanded ? 'utility:chevrondown' : 'utility:chevronright',
            index: idx,
            isActive: idx === this.activeIndex,
            className: 'slds-flex-row slds-justify-content-space-between slds-hashtag-dropdown__item' + (idx === this.activeIndex ? ' is-active' : ''),
            indentClass: `indent indent-${Math.min(6, node.level || 0)}`,
        }));
    }

    get dropdownClass() {
        return 'slds-hashtag-dropdown slds-flex-column slds-full-height' + (this.isKeyboardMode ? ' is-keyboard' : '');
    }

    get hasItems() {
        return (this.filteredItems || []).length > 0;
    }
}