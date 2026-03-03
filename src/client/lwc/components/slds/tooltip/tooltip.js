import { LightningElement, api } from 'lwc';
import { classSet } from 'lightning/utils';

const Event = Object.freeze({
    Select: 'select',
});

export const Position = Object.freeze({
    Top: 'top',
    Right: 'right',
    Bottom: 'bottom',
    Left: 'left',
    // Add more positions here if needed
});

export default class Tooltip extends LightningElement {
    @api label;

    @api items = []; // an array of items - refer to `agent_studio/verticalNavigationItem` component's properties

    /**
     * Tooltip position relative to the trigger element
     * Allows simple alignment (center aligned only; add more if needed)
     */
    @api position = Position.Right;

    @api autoFlipDisabled = false;

    @api
    get disabled() {
        return this._disabled;
    }
    set disabled(value) {
        if (value !== this._disabled) {
            this._disabled = value;

            // If becoming disabled while a popup might be open, ensure it is closed
            if (this._disabled && this._hasRendered) {
                this.closePopup();
            }
        }
    }
    _disabled = false;

    _hasRendered = false;
    isPopupOpen = false;

    renderedCallback() {
        if (!this._hasRendered) {
            this._hasRendered = true;
        }
    }

    get hasItems() {
        return this.items.length > 0;
    }

    get tooltipBodyClass() {
        return classSet('slds-popover slds-popover__body slds-p-bottom_small tooltip-body').add({
            'slds-popover_tooltip slds-tooltip slds-text-color_inverse': !this.hasItems,
            'slds-nubbin_left': !this.hasItems && this.position === Position.Right,
            'slds-nubbin_right': !this.hasItems && this.position === Position.Left,
            'slds-nubbin_top': !this.hasItems && this.position === Position.Bottom,
            'slds-nubbin_bottom': !this.hasItems && this.position === Position.Top,
        });
    }

    get labelClass() {
        return classSet({
            'menu-label': this.hasItems,
        });
    }

    // Does not handle non-center aligned positions
    get simpleAlignmentOptions() {
        switch (this.position) {
            case Position.Left:
                return {
                    reference: { horizontal: 'left', vertical: 'center' },
                    popup: { horizontal: 'right', vertical: 'center' },
                    padding: -1,
                    offset: 0,
                };
            case Position.Top:
                return {
                    reference: { horizontal: 'center', vertical: 'top' },
                    popup: { horizontal: 'center', vertical: 'bottom' },
                    padding: 1,
                    offset: 0,
                };
            case Position.Bottom:
                return {
                    reference: { horizontal: 'center', vertical: 'bottom' },
                    popup: { horizontal: 'center', vertical: 'top' },
                    padding: -1,
                    offset: 0,
                };
            case Position.Right:
            default:
                return {
                    reference: { horizontal: 'right', vertical: 'center' },
                    popup: { horizontal: 'left', vertical: 'center' },
                    padding: 1,
                    offset: 0,
                };
        }
    }

    handleMouseEnter() {
        this.showPopup();
    }

    handleMouseLeave(event) {
        const to = event.relatedTarget;
        if (!this.hasItems || !this.isElementContainedInTooltip(to)) {
            // If no list items, or moving out of tooltip, close it on mouse leave
            this.closePopup();
        }
    }

    handleFocusIn(event) {
        if (this._ignoreFocusIn) {
            // Wait for focus to settle
            queueMicrotask(() => {
                this._ignoreFocusIn = false;
            });
            return;
        }

        // Only open popup when focus comes from outside
        const from = event.relatedTarget;
        if (!this.isElementContainedInTooltip(from)) {
            this.showPopup();
        }
    }

    handleFocusOut(event) {
        if (this._ignoreFocusOut) {
            // Wait for focus to settle
            queueMicrotask(() => {
                this._ignoreFocusOut = false;
            });
            return;
        }

        // When focus moves out of tooltip, close it
        const to = event.relatedTarget;
        if (!this.isElementContainedInTooltip(to)) {
            this.closePopup();
        }
    }

    handlePopupReturnFocus(event) {
        // Prevent focus from going back to trigger automatically,
        // which triggers focusin event and reopens the popup
        event.preventDefault();
    }

    handleTriggerKeyDown(event) {
        if (this.disabled || !this.hasItems) {
            return;
        }

        // For tooltip with items
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            this.showPopup();
        }
    }

    handleMenuKeyDown(event) {
        // Handle tabs through items with keyboard navigation
        if (this.disabled || !this.hasItems || event.key !== 'Tab') {
            return;
        }

        const firstItemName = this.items[0].name;
        const lastItemName = this.items[this.items.length - 1].name;
        const focusedElementName = this.template.activeElement?.name;
        const isTabbingOutForward = !event.shiftKey && focusedElementName === lastItemName;
        const isTabbingOutBackward = event.shiftKey && focusedElementName === firstItemName;

        // Close popup if tabbing out from first or last item
        this._ignoreFocusIn = isTabbingOutBackward;
        if (isTabbingOutForward || isTabbingOutBackward) {
            this.closePopup();
        }
    }

    handleMenuItemSelect(event) {
        this.dispatchEvent(
            new CustomEvent(Event.Select, {
                detail: event.detail,
            })
        );

        // Prevent focusout handler from closing the popup
        this._ignoreFocusOut = true;
    }

    showPopup() {
        if (this.disabled) {
            return;
        }

        const alignment = this.hasItems
            ? {
                  reference: { horizontal: 'right', vertical: 'top' },
                  popup: { horizontal: 'left', vertical: 'top' },
                  padding: 0,
                  offset: 0,
              }
            : this.simpleAlignmentOptions;
        this.refs?.popup?.show(this.refs?.trigger, { ...alignment, autoFlip: !this.autoFlipDisabled });

        this.isPopupOpen = true;
    }

    closePopup() {
        this.refs?.popup?.close();
        this.isPopupOpen = false;
    }

    isElementContainedInTooltip(element) {
        return this.refs?.trigger?.contains(element) || this.refs?.popup?.contains(element);
    }
}
