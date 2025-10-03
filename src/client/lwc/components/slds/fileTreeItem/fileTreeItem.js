import { api, LightningElement } from 'lwc';
import { classSet, isEmpty, isNotUndefinedOrNull, isUndefinedOrNull } from 'shared/utils';
import { getHighlightedRichText } from './utils';

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
    
    isHover = false;
    isMenuOpen = false;
    

    /** Event Handlers */

    handleClick(event) {
        if (this.isFolder) {
            this.handleToggle(event);
            if(this.isFolderSelectable) {
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
            this.dispatchEvent(new CustomEvent('expandall', { detail: { item: this.item }, bubbles: true, composed: true }));
        } else if (value === 'collapseAll') {
            this.dispatchEvent(new CustomEvent('collapseall', { detail: { item: this.item }, bubbles: true, composed: true }));
        }else if (value === 'delete') {
            this.dispatchEvent(new CustomEvent('deletefile', { detail: { item: this.item }, bubbles: true, composed: true }));
        }
    }

    handleMenuFocus(event) {
        this.isMenuOpen = true;
    }

    handleDelete(event) {
        event.stopPropagation();
        this.dispatchEvent(new CustomEvent('deletefile', { detail: { item: this.item }, bubbles: true, composed: true }));
    }

    handleMenuBlur(event) {
        if(!this.isHover) {
            this.isMenuOpen = false;
        }
    }

     /** Methods */

    /** Getters */

    get name() {
        return this.item?.name || 'Unknown';
    }

    get title() {
        return this.item?.title || this.item?.name || 'Unknown';
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
        return this.item?.icon || (this.expanded && !this.isFolderIconExcluded ? 'utility:opened_folder' : 'utility:open_folder');
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
        if (!this.searchValue || this.searchValue.length < 3 || !this.item?.name) {
            return this.item?.name || '';
        }

        return getHighlightedRichText(this.item.name, [this.searchValue]);
    }

    get rootClasses() {
        return classSet('slds-tree__item').add({
            'is-first': this.isFirst,
            'slds-is-hovered': this.isMenuButtonVisible,
            'slds-is-selected': this.selected
        }).toString();
    }

    get apiIconClass() {
        return classSet('slds-badge slds-m-horizontal_xx-small').add({
            'slds-theme_error': this.item?.icon === 'api:delete',
            'slds-theme_success': this.item?.icon === 'api:post',
            'slds-theme_warning': this.item?.icon === 'api:put',
            'slds-theme_info': this.item?.icon === 'api:patch',
        }).toString();
    }

    get apiIconText() {
        return (this.item?.icon || 'api:...').split(':')[1];
    }
}