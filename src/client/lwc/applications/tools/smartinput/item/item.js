import { api, LightningElement } from 'lwc';
import Toast from 'lightning/toast';

export default class Item extends LightningElement {
    @api item; // { id, value, disabled, isEditing }
    @api editingValue = '';

    handleEditClick = () => {
        this.dispatchEvent(new CustomEvent('editclick', {
            detail: { id: this.item?.id },
            bubbles: true,
            composed: true,
        }));
    };

    handleDeleteClick = () => {
        this.dispatchEvent(new CustomEvent('deleteclick', {
            detail: { id: this.item?.id },
            bubbles: true,
            composed: true,
        }));
    };

    handleEditChange = (e) => {
        const value = e.target.value;
        this.dispatchEvent(new CustomEvent('editchange', {
            detail: { value, id: this.item?.id },
            bubbles: true,
            composed: true,
        }));
    };

    handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this.handleEditSave();
        }
    };

    handleEditSave = () => {
        this.dispatchEvent(new CustomEvent('editsave', {
            detail: { id: this.item?.id },
            bubbles: true,
            composed: true,
        }));
    };

    handleEditCancel = () => {
        this.dispatchEvent(new CustomEvent('editcancel', {
            detail: { id: this.item?.id },
            bubbles: true,
            composed: true,
        }));
    };

    handleCopyClick = () => {
        navigator.clipboard.writeText(this.item?.value);
        Toast.show({
            label: 'Value exported to your clipboard',
            variant: 'success',
        });
    };

    handleFavoriteToggle = () => {
        this.dispatchEvent(new CustomEvent('favoritechange', {
            detail: { id: this.item?.id },
            bubbles: true,
            composed: true,
        }));
    };
}


