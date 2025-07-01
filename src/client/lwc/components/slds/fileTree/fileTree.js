import { api, LightningElement } from 'lwc';
const i18n = {
    NoFiles: 'No Files',
};
/**
 * Main file tree component. Accepts a tree data structure and renders it using fileTreeItem.
 */
export default class FileTree extends LightningElement {
    expandedMap = {};
    @api tree;

    _selectedId = null;
    @api
    get selectedId() {
        return this._selectedId;
    }
    set selectedId(value) {
        this._selectedId = value;
    }

    /** Event Handlers */
    handleToggle(event) {
        const { item } = event.detail;
        this.expandedMap = { ...this.expandedMap, [item.id]: !this.expandedMap[item.id] };
    }

    handleSelect(event) {
        const { item } = event.detail;
        this._selectedId = item.id;
        this.dispatchEvent(new CustomEvent('select', {detail: { item }}));
    }

    handleDelete(event) {
        event.stopPropagation();
        const { item } = event.detail;
        this.dispatchEvent(new CustomEvent('delete', { detail: { item } }));
    }

    /** Methods */
    injectState(item, level) {
        const expanded = !!this.expandedMap[item.id];
        const selected = this.selectedId === item.id;
        const children = item.children ? item.children.map(child => this.injectState(child, level + 1)) : undefined;
        return { ...item, expanded, selected, children };
    }

    /** Getters */
    @api
    get computedTree() {
        return (this.tree || []).map(item => this.injectState(item, 0));
    }

    get i18n() {
        return i18n;
    }
}