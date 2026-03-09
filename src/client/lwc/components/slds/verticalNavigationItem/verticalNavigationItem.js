import { api, LightningElement } from 'lwc';
import { classSet } from 'lightning/utils';
import { hasSelectedDescendant } from './utils';

const Event = Object.freeze({
    Select: 'select',
});

const i18n = Object.freeze({
    BadgeAltText: 'Badge',
    NewWindowIconAltText: 'New Window',
    ChevronDownIconAltText: 'Chevron Down',
    ChevronUpIconAltText: 'Chevron Up',
});

/**
 * Custom vertical navigation item component.
 *
 * Supports:
 * - left side icon
 * - right side new window icon if it is a link
 * - badge count if `badgeCount` is provided
 * - badge text if `badgeText` is provided
 * - expandable nested child items
 * - collapse state with tooltips
 */
export default class VerticalNavigationItem extends LightningElement {
    @api isSelected = false;
    @api name;
    @api label;
    @api iconName;
    @api badgeCount;
    @api badgeText;
    @api isLink = false;
    @api defaultExpanded = false; // Whether the children should be expanded by default

    // An array of child items, each with the same properties as this component
    @api
    set children(value) {
        this._children = value;

        // If there is any child that is already selected, expand the children
        // or fallback to defaultExpanded
        // Do not expand when the left nav is collapsed
        const hasSelectedChild = value?.find(item => item.isSelected) !== undefined;
        this.areChildrenExpanded = !this.isCollapsed && (hasSelectedChild || this.defaultExpanded);
    }
    get children() {
        return this._children || [];
    }
    _children;

    @api
    get isCollapsed() {
        return this._isCollapsed;
    }

    set isCollapsed(value) {
        this._isCollapsed = value;

        // If the nav is collapsing and this item has expanded children, collapse them
        if (value) {
            this.areChildrenExpanded = false;
        }
    }
    _isCollapsed = false;

    _hasRendered = false;
    _wasActive = false;

    i18n = i18n;
    areChildrenExpanded = false;

    get isActive() {
        return this.isSelected || (this.isCollapsed && hasSelectedDescendant(this.children));
    }

    get ariaCurrent() {
        return this.isSelected ? 'page' : undefined;
    }

    get ariaControls() {
        return this.hasChildren ? 'children-list' : undefined;
    }

    get ariaExpanded() {
        return this.hasChildren ? this.areChildrenExpanded : undefined;
    }

    // This is an override of the isSelected property that highlights the parent menu item when one of its children is selected while the left nav is collapsed.
    // parent items cannot be selected directly when the left nav is expanded.
    get navigationItemClass() {
        return classSet('slds-nav-vertical__item').add({
            'slds-is-active': this.isActive,
        });
    }

    get hasBadgeCount() {
        return this.badgeCount !== undefined && this.badgeCount !== null;
    }

    get hasBadgeText() {
        return !!this.badgeText;
    }

    get hasChildren() {
        return Array.isArray(this.children) && this.children.length > 0;
    }

    get expandCollapseIconClass() {
        return classSet('slds-m-left_x-small chevron-icon slds-p-around-x-small').add({
            expanded: this.areChildrenExpanded,
        });
    }

    get expandCollapseIconAltText() {
        return this.areChildrenExpanded ? i18n.ChevronUpIconAltText : i18n.ChevronDownIconAltText;
    }

    get childrenListClass() {
        return classSet('children-list').add({
            // Only show expanded state when the left nav itself is not collapsed
            expanded: this.areChildrenExpanded && !this.isCollapsed,
        });
    }

    get actionClass() {
        return classSet('slds-nav-vertical__action').add({
            'slds-p-horizontal_none': this.isCollapsed,
            'slds-align-content-center': this.isCollapsed,
            collapsed: this.isCollapsed,
            'non-active': !this.isActive, // ensures inactive child menu items do not show box-shadow.
        });
    }

    get iconClass() {
        return classSet('icon').add({
            'slds-m-right_x-small': !this.isCollapsed,
            'slds-m-right_none': this.isCollapsed,
        });
    }

    get showLabel() {
        return !this.isCollapsed;
    }

    get showRightIcons() {
        return !this.isCollapsed;
    }

    get tooltipDisabled() {
        return !this.isCollapsed;
    }

    get computedTooltipLabel() {
        return this.label || this.name || 'Menu item';
    }

    renderedCallback() {
        // If the item has just become active, focus the action element
        if (this._hasRendered && this.isActive && !this._wasActive) {
            this.refs.action?.focus();
        }
        this._wasActive = this.isActive;
        if (!this._hasRendered) {
            this._hasRendered = true;
        }
    }

    handleClick(event) {
        // Prevent default anchor link behavior
        event.preventDefault();
        this.selectItem(false);
    }

    handleKeyDown(event) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            this.selectItem(true);
        }
    }

    handleChildSelect(event) {
        this.dispatchEvent(
            new CustomEvent(Event.Select, {
                detail: event.detail,
            })
        );
    }

    selectItem(keyboard = false) {
        if (this.hasChildren) {
            // Only allow expansion/collapse of the children if the left nav itself is NOT collapsed
            if (this.isCollapsed) {
                // Left nav is collapsed - do nothing for items with children
                return;
            }

            // Left nav is expanded - toggle children expansion
            this.areChildrenExpanded = !this.areChildrenExpanded;
            return;
        }

        // For items without children, always handle the click
        this.dispatchEvent(
            new CustomEvent(Event.Select, {
                detail: {
                    name: this.name,
                    keyboard,
                },
            })
        );
    }
}
