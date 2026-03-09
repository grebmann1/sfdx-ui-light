import { api, LightningElement } from 'lwc';
import { runActionAfterTimeOut } from 'shared/utils';
import { searchDirectories } from './utils';
const i18n = {
    NoFiles: 'No Files',
    Search: 'Search',
    SearchPlaceholder: 'Search ...',
};

const VIRTUAL_SCROLL_THRESHOLD = 300;
const PAGE_LIST_SIZE = 70;

/**
 * Main file tree component. Accepts a tree data structure and renders it using fileTreeItem.
 */
export default class FileTree extends LightningElement {
    expandedMap = {};
    searchValue = '';
    matchedIds = new Set();
    nonMatchesInDirectory = new Set();

    @api selectedId = '';
    value = '';

    _tree = [];
    pageNumber = 1;

    @api
    get tree() {
        return this._tree;
    }
    set tree(value) {
        this._tree = Array.isArray(value) ? value : [];
        this.pageNumber = 1;
    }

    @api isDeleteDisabled = false;
    @api searchFields = ['name', 'id'];
    @api minSearchLength = 3;
    @api hideSearchInput = false;
    @api hideIcons = false;
    @api includeFoldersInResults = false;
    @api isFolderSelectable = false;

    /** Event Handlers */

    handleScroll(event) {
        const totalCount = this.displayList.length;
        if (totalCount <= VIRTUAL_SCROLL_THRESHOLD) return;
        const target = event.target;
        const scrollDiff = Math.abs(
            target.clientHeight - (target.scrollHeight - target.scrollTop)
        );
        const isScrolledToBottom = scrollDiff < 5;
        if (isScrolledToBottom) {
            this.pageNumber++;
        }
    }

    handleSearch(event) {
        runActionAfterTimeOut(
            event.target.value,
            (value) => {
                if (value.trim() === '') {
                    this.expandedMap = {};
                    this.searchValue = '';
                    this.nonMatchesInDirectory = new Set();
                    this.matchedIds = new Set();
                    this.pageNumber = 1;
                    return;
                }
                this.searchValue = value;
                this.pageNumber = 1;
                const options = {
                    searchFields: this.searchFields,
                    minSearchLength: this.minSearchLength,
                };
                if (this.includeFoldersInResults === true) {
                    options.includeFoldersInResults = true;
                }
                const { expandedMap, matchedIds, nonMatchesInDirectory } = searchDirectories(
                    this.searchValue,
                    this.tree,
                    this.expandedMap,
                    options
                );
                this.expandedMap = expandedMap || {};
                this.matchedIds = matchedIds || new Set();
                this.nonMatchesInDirectory = nonMatchesInDirectory || new Set();
            },
            { timeout: 300, key: 'slds.fileTree.search' }
        );
    }

    handleToggle(event) {
        const { item } = event.detail;
        this.expandedMap = {
            ...this.expandedMap,
            [item.id]: !this.expandedMap[item.id],
        };
        this.dispatchEvent(
            new CustomEvent('toggle', { detail: { item }, bubbles: true, composed: true })
        );
    }

    handleSelect(event) {
        const { item } = event.detail;
        this.selectedId = item.id;
        if (Array.isArray(item?.children) && item.children.length > 0) {
            this.expandedMap = {
                ...this.expandedMap,
                [item.id]: true,
            };
        }
        this.dispatchEvent(new CustomEvent('select', { detail: { item } }));
    }

    handleDeleteFile(event) {
        event.stopPropagation();
        this.dispatchEvent(
            new CustomEvent('deletefile', { detail: event.detail, bubbles: true, composed: true })
        );
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
    injectState(item, level, isFirstRoot = false, posInSet = 1, setSize = 1) {
        const expanded = !!this.expandedMap[item.id];
        const selected = this.selectedId === item.id;
        const isTabbable = selected || (level === 0 && isFirstRoot);
        const searchInactive = this.searchValue.length < this.minSearchLength;
        const hasChildren = Array.isArray(item.children) && item.children.length > 0;
        const isFolder = hasChildren || item.isExpandable === true;
        const childSetSize = item.children?.length ?? 0;
        const children = Array.isArray(item.children)
            ? item.children.map((child, index) =>
                  this.injectState(child, level + 1, false, index + 1, childSetSize)
              )
            : undefined;
        const visible =
            searchInactive ||
            isFolder ||
            !this.nonMatchesInDirectory.has(item.id);
        const displayName = item.displayName ?? item.name ?? '';
        return {
            ...item,
            expanded,
            selected,
            isTabbable,
            children,
            visible,
            displayName,
            posInSet,
            setSize,
        };
    }

    /** Getters */

    @api
    get computedTree() {
        const items = this._tree || [];
        const setSize = items.length;
        const hasSelection = this.selectedId != null && this.selectedId !== '';
        return items.map((item, index) =>
            this.injectState(item, 0, !hasSelection && index === 0, index + 1, setSize)
        );
    }

    get displayList() {
        const full = this.computedTree;
        const searchActive = this.searchValue.length >= this.minSearchLength;
        if (searchActive) {
            return full.filter(item => item.visible);
        }
        return full;
    }

    get visibleTree() {
        const list = this.displayList;
        if (list.length <= VIRTUAL_SCROLL_THRESHOLD) {
            return list;
        }
        return list.slice(0, this.pageNumber * PAGE_LIST_SIZE);
    }

    get isTreeVisible() {
        return this.computedTree.length > 0;
    }

    get i18n() {
        return i18n;
    }
}
