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
    nonMatchesInDirectory = new Set();

    _selectedId = null;
    value = '';

    @api tree = [];
    @api isDeleteDisabled = false;

    /** Event Handlers */

    handleSearch(event) {
        runActionAfterTimeOut(
            event.target.value,
            (value) => {
                this.searchValue = value;
                // returns a map of what should be expanded and a map of non-matching children in each expanded folder
                const { expandedMap, nonMatchesInDirectory } = searchDirectories(
                    this.searchValue,
                    this.tree,
                    this.expandedMap
                );
                this.expandedMap = expandedMap || {};
                this.nonMatchesInDirectory = nonMatchesInDirectory || {};
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
        this._selectedId = item.id;
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
        const selected = this._selectedId === item.id;
        const visible =
            this.searchValue.length < 3 ||
            (item.children && Array.isArray(item.children)) ||
            !this.nonMatchesInDirectory.has(item.id);
        const children = item.children ? item.children.map((child) => this.injectState(child, level + 1)) : undefined;
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