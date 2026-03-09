import { api, LightningElement } from 'lwc';
import { classSet } from 'shared/utils';
import {
    getHighlightedRichText,
    getFirstChildTreeItem,
    getNextTreeItem,
    getPreviousTreeItem,
    getParentTreeItem,
} from './utils';

const KEY = {
    Enter: 'Enter',
    Space: ' ',
    ArrowUp: 'ArrowUp',
    ArrowDown: 'ArrowDown',
    ArrowLeft: 'ArrowLeft',
    ArrowRight: 'ArrowRight',
};

const i18n = {
    ToggleFolder: 'Toggle folder',
    AltTextExpandFolder: 'Expand folder',
    AltTextFolder: 'Folder',
    AltTextFile: 'File',
    Delete: 'Delete',
};

/**
 * Represents a single item (file or folder) in the file tree.
 */
export default class FileTreeItem extends LightningElement {
    @api item;
    @api expanded = false;
    @api selected = false;
    @api isFirst = false;
    @api saved = false;
    @api searchValue = '';
    @api isDeleteDisabled = false;
    @api isFolderSelectable = false;
    @api isTabbable = false;

    isHover = false;
    isMenuOpen = false;

    /** Event Handlers */

    handleClick(event) {
        if (this.isFolder) {
            this.handleToggle(event);
            if (this.isFolderSelectable) {
                this.handleSelect(event);
            }
        } else {
            this.handleSelect(event);
        }
    }

    handleToggle(event) {
        event.stopPropagation();
        const _item = event.detail?.item || this.item;
        this.dispatchEvent(new CustomEvent('toggle', { detail: { item: _item } }));
    }

    handleSelect(event) {
        event.stopPropagation();
        const _item = event.detail?.item || this.item;
        this.dispatchEvent(new CustomEvent('select', { detail: { item: _item } }));
    }

    handleHover() {
        // make the add file icon visible
        this.isHover = true;
    }

    handleMouseLeave() {
        this.isHover = false;
    }

    handleMenuClick(event) {
        event.preventDefault();
        event.stopPropagation();
        this.template.querySelector('lightning-button-menu').focus();
        /*  
        if(event.target.tagName !== event.currentTarget.tagName) {
            this.isMenuOpen = false;
        } */
    }

    handleMenuSelect(event) {
        const value = event.detail.value;
        if (value === 'expandAll') {
            this.dispatchEvent(
                new CustomEvent('expandall', {
                    detail: { item: this.item },
                    bubbles: true,
                    composed: true,
                })
            );
        } else if (value === 'collapseAll') {
            this.dispatchEvent(
                new CustomEvent('collapseall', {
                    detail: { item: this.item },
                    bubbles: true,
                    composed: true,
                })
            );
        } else if (value === 'delete') {
            this.dispatchEvent(
                new CustomEvent('deletefile', {
                    detail: { item: this.item },
                    bubbles: true,
                    composed: true,
                })
            );
        }
    }

    handleMenuFocus(event) {
        this.isMenuOpen = true;
    }

    handleDelete(event) {
        event.stopPropagation();
        this.dispatchEvent(
            new CustomEvent('deletefile', {
                detail: { item: this.item },
                bubbles: true,
                composed: true,
            })
        );
    }

    handleMenuBlur(event) {
        if (!this.isHover) {
            this.isMenuOpen = false;
        }
    }

    get tabIndex() {
        return this.isTabbable ? 0 : -1;
    }

    handleKeyDown(event) {
        const isEnter = event.key === KEY.Enter;
        const isSpace = event.key === KEY.Space;
        if (isEnter || isSpace) {
            event.preventDefault();
            if (this.isFolder) {
                this.handleToggle(event);
                if (this.isFolderSelectable) {
                    this.handleSelect(event);
                }
            } else {
                this.handleSelect(event);
            }
            return;
        }
        switch (event.key) {
            case KEY.ArrowUp: {
                event.preventDefault();
                event.stopPropagation();
                const prev = getPreviousTreeItem(this.template);
                if (prev) {
                    this.focusTreeItemElement(prev);
                }
                break;
            }
            case KEY.ArrowDown: {
                event.preventDefault();
                event.stopPropagation();
                const next = getNextTreeItem(this.template);
                if (next) {
                    this.focusTreeItemElement(next);
                }
                break;
            }
            case KEY.ArrowLeft: {
                event.preventDefault();
                event.stopPropagation();
                if (this.isFolder && this.expanded) {
                    this.handleToggle(event);
                } else {
                    const parent = getParentTreeItem(this.template);
                    if (parent) {
                        this.focusTreeItemElement(parent);
                    }
                }
                break;
            }
            case KEY.ArrowRight: {
                event.preventDefault();
                event.stopPropagation();
                if (this.isFolder) {
                    if (!this.expanded) {
                        this.handleToggle(event);
                    } else {
                        const first = getFirstChildTreeItem(this.template);
                        if (first) {
                            this.focusTreeItemElement(first);
                        }
                    }
                }
                break;
            }
            default:
                break;
        }
    }

    stopKeydown(event) {
        if (event.key === KEY.Enter || event.key === KEY.Space) {
            event.stopPropagation();
        }
    }

    @api
    focus() {
        const el = this.template.querySelector('[data-tid="file-tree-item"]');
        if (el) {
            el.focus();
        }
    }

    focusTreeItemElement(componentElement) {
        if (componentElement && componentElement.shadowRoot) {
            const el = componentElement.shadowRoot.querySelector('[data-tid="file-tree-item"]');
            if (el) {
                el.focus();
            }
        }
    }

    /** Methods */

    /** Getters */

    get name() {
        return this.item?.name || 'Unknown';
    }

    get displayName() {
        return this.item?.displayName ?? this.item?.name ?? 'Unknown';
    }

    get title() {
        return this.item?.title ?? this.displayName;
    }

    get ariaLabel() {
        const typeLabel = this.isFolder ? i18n.AltTextFolder : i18n.AltTextFile;
        return `${typeLabel} ${this.displayName}`;
    }

    get ariaPosInSet() {
        return this.item?.posInSet;
    }

    get ariaSetSize() {
        return this.item?.setSize;
    }

    get ariaExpandedAttribute() {
        return this.isFolder ? this.expanded : undefined;
    }

    get i18n() {
        return i18n;
    }

    get isFolder() {
        return Array.isArray(this.item?.children);
    }

    get isFile() {
        return !this.isFolder;
    }

    get children() {
        return this.item?.children || [];
    }

    get iconClass() {
        return classSet('slds-icon_container')
            .add({
                'slds-icon-standard-folder': this.isFolder,
                'slds-icon-standard-document': !this.isFolder,
            })
            .toString();
    }

    get chevronIcon() {
        return this.expanded ? 'utility:chevrondown' : 'utility:chevronright';
    }

    get folderIcon() {
        return (
            this.item?.icon ||
            (this.expanded && !this.isFolderIconExcluded
                ? 'utility:opened_folder'
                : 'utility:open_folder')
        );
    }

    get isFolderIconDisplayed() {
        return this.item?.icon !== ''; // Different from empty string !!!
    }

    get itemIcon() {
        return this.item?.icon || 'utility:insert_tag_field';
    }

    get isApiIcon() {
        return (this.item?.icon || '').startsWith('api:');
    }

    get isVisible() {
        return this.item.visible;
    }

    get isMenuButtonVisible() {
        return this.isHover || this.isMenuOpen;
    }

    get isDeleteButtonVisible() {
        return this.isHover && this.isDeletable && !this.isDeleteDisabled;
    }

    get isDeletable() {
        return this.item.isDeletable || false; // this by pass this.isDeleteDisabled
    }

    get highlightedName() {
        const base = this.displayName;
        if (!this.searchValue || this.searchValue.length < 3) {
            return base;
        }
        return getHighlightedRichText(base, [this.searchValue]);
    }

    get rootClasses() {
        return classSet('slds-tree__item tree-item')
            .add({
                'is-first': this.isFirst,
                'slds-is-hovered': this.isMenuButtonVisible,
                //'slds-is-selected': this.selected,
                'tree-item-selected': this.selected,
            })
            .toString();
    }

    get apiIconClass() {
        return classSet('slds-badge slds-m-horizontal_xx-small')
            .add({
                'api-badge--get': this.item?.icon === 'api:get',
                'slds-theme_info': this.item?.icon === 'api:get',
                'slds-theme_error': this.item?.icon === 'api:delete',
                'slds-theme_success': this.item?.icon === 'api:post',
                'slds-theme_warning': this.item?.icon === 'api:put',
                'slds-theme_info': this.item?.icon === 'api:patch',
            })
            .toString();
    }

    get apiIconText() {
        return (this.item?.icon || 'api:...').split(':')[1];
    }
}
