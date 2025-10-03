import { api, LightningElement } from 'lwc';
import { runActionAfterTimeOut } from 'shared/utils';
import { searchDirectories } from './utils';
const i18n = {
    NoFiles: 'No Files',
    Search: 'Search',
    SearchPlaceholder: 'Search ...',
};
/**
 * Main file tree component. Accepts a tree data structure and renders it using fileTreeItem.
 */
export default class FileTree extends LightningElement {
    expandedMap = {};
    visibleMap = {};
    searchValue = '';
    matchedIds = new Set();

    @api selectedId = '';
    value = '';

    @api tree = [];
    @api isDeleteDisabled = false;
    @api searchFields = ['name','id'];
    @api minSearchLength = 3;
    @api hideSearchInput = false;
    @api includeFoldersInResults = false;
    @api isFolderSelectable = false;

    /** Event Handlers */

    handleSearch(event) {
        runActionAfterTimeOut(
            event.target.value,
            (value) => {
                this.searchValue = value;
                // returns a map of what should be expanded and a map of non-matching children in each expanded folder
                const options = {
                    searchFields: this.searchFields,
                    minSearchLength: this.minSearchLength,
                };
                if (this.includeFoldersInResults === true) {
                    options.includeFoldersInResults = true;
                }
                const { expandedMap, matchedIds } = searchDirectories(
                    this.searchValue,
                    this.tree,
                    this.expandedMap,
                    options
                );
                this.expandedMap = expandedMap || {};
                this.matchedIds = matchedIds || new Set();
            },
            { timeout: 300 }
        );
    }

    handleToggle(event) {
        const { item } = event.detail;
        this.expandedMap = {
            ...this.expandedMap,
            [item.id]: !this.expandedMap[item.id],
        };
    }

    handleSelect(event) {
        const { item } = event.detail;
        this.selectedId = item.id;
        this.dispatchEvent(new CustomEvent('select', { detail: { item } }));
    }

    handleDeleteFile(event) {
        event.stopPropagation();
        this.dispatchEvent(new CustomEvent('deletefile', { detail: event.detail, bubbles: true, composed: true }));
    }

    handleExpandAll(event) {
        const { item } = event.detail;
        this.expandAll(item);
    }

    handleCollapseAll(event) {
        const { item } = event.detail;
        this.collapseAll(item);
    }

    expandAll(item) {
        const expandRecursive = (node, map) => {
            map[node.id] = true;
            if (node.children && node.children.length > 0) {
                node.children.forEach(child => expandRecursive(child, map));
            }
        };
        const newMap = { ...this.expandedMap };
        expandRecursive(item, newMap);
        this.expandedMap = newMap;
    }

    collapseAll(item) {
        const collapseRecursive = (node, map) => {
            map[node.id] = false;
            if (node.children && node.children.length > 0) {
                node.children.forEach(child => collapseRecursive(child, map));
            }
        };
        const newMap = { ...this.expandedMap };
        collapseRecursive(item, newMap);
        this.expandedMap = newMap;
    }

    /** Methods */
    injectState(item, level) {
        const expanded = !!this.expandedMap[item.id];
        const selected = this.selectedId === item.id;
        const searchInactive = this.searchValue.length < this.minSearchLength;
        const isFolder = Array.isArray(item.children);
        const children = item.children ? item.children.map((child) => this.injectState(child, level + 1)) : undefined;
        let visible;
        if (searchInactive) {
            visible = true;
        } else if (isFolder) {
            const childVisible = (children || []).some((c) => c.visible);
            const selfMatchAndIncluded = this.includeFoldersInResults === true && this.matchedIds.has(item.id);
            visible = childVisible || selfMatchAndIncluded;
        } else {
            visible = this.matchedIds.has(item.id);
        }
        return { 
            ...item, 
            expanded, 
            selected, 
            children, 
            visible
        };
    }

    /** Getters */

    @api
    get computedTree() {
        return (this.tree || []).map((item) => this.injectState(item, 0));
    }

    get isTreeVisible() {
        return this.computedTree.length > 0;
    }

    get i18n() {
        return i18n;
    }

}