import { LightningElement, api } from 'lwc';
import {
    normalizeString as normalize,
    classSet,
} from 'shared/utils';

export default class VerticalPanel extends LightningElement {
    @api position;
    @api isOpen;
    @api size = 'slds-size_medium';
    @api title = 'Filter';

    @api isHeaderHidden = false;
    @api hasBorder = false;

    manualPanelWidth;

    hasLoaded = false;

    /** Events */

    handleClose = e => {
        e.preventDefault();
        this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
    };

    /** Methods */

    /** Getters */

    get filterPanelClass() {
        return classSet(
            `slds-panel ${this.normalizedSize} slds-panel_docked slds-panel_docked-${this.normalizedPosition} slds-panel_drawer`
        )
            .add({
                'slds-is-open slds-flex-column': this.isOpen,
                'with-border': this.hasBorder,
            })
            .toString();
    }

    get normalizedSize() {
        return normalize(this.size, {
            fallbackValue: 'default',// Default doesn't exist in SLDS !!!
            validValues: ['default', 'slds-size_small', 'slds-size_medium', 'slds-size_large', 'slds-size_x-large', 'slds-size_full'],
        });
    }

    get normalizedPosition() {
        return normalize(this.position, {
            fallbackValue: 'right',
            validValues: ['left', 'right'],
        });
    }

    get isHeaderVisible() {
        return !this.isHeaderHidden;
    }

    get panelStyle() {
        // If panelWidth is set, use it as the width; otherwise, fallback to SLDS size classes
        return this.manualPanelWidth ? `width: ${this.manualPanelWidth}; min-width: 0;` : '';
    }

    /** Drag handle logic */
    handleDragHandleMouseDown = event => {
        event.preventDefault();
        const panel = this.template.querySelector('.slds-panel');
        const startX = event.clientX;
        const startWidth = panel.offsetWidth;
        const isRight = this.normalizedPosition === 'right';

        const handleMouseMove = moveEvent => {
            const dx = moveEvent.clientX - startX;
            const newWidth = isRight ? startWidth - dx : startWidth + dx;
            this.manualPanelWidth = `${newWidth}px`;
            // Force re-render
            this.requestUpdate && this.requestUpdate();
            window.dispatchEvent(new Event('resize'));
        };

        const handleMouseUp = () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    };
}
