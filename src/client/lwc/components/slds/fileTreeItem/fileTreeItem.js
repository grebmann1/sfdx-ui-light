import { api, LightningElement } from 'lwc';
import { classSet } from 'lightning/utils';
const i18n = {
    ToggleFolder: 'Toggle folder',
};

/**
 * Represents a single item (file or folder) in the file tree.
 */
export default class FileTreeItem extends LightningElement {
    @api item;
    @api expanded = false;
    @api selected = false;
    @api isFirst = false;

    /** Methods */

    /** Event Handlers */

    handleClick(event) {
        if (this.isFolder) {
            this.handleToggle(event);
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

    handleDelete(event) {
        event.stopPropagation();
        const _item = event.detail?.item || this.item;
        this.dispatchEvent(new CustomEvent('delete', { detail: { item: _item }, bubbles: true, composed: true }));
    }

    /** Getters */

    get i18n() {
        return i18n;
    }

    get isFolder() {
        return this.item && Array.isArray(this.item.children);
    }

    get isNotFolder() {
        return !this.isFolder;
    }

    get iconClass() {
        return classSet('slds-icon_container')
            .add({
                'slds-icon-standard-folder': this.isFolder,
                'slds-icon-standard-document': !this.isFolder
            }).toString();
    }

    get chevronIcon() {
        return this.expanded ? 'utility:down' : 'utility:right';
    }

    get folderIcon() {
        return this.expanded ? 'utility:opened_folder' : 'utility:open_folder';
    }
}