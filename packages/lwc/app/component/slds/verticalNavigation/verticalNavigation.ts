import { api, LightningElement } from 'lwc';
import { classSet } from 'lightning/utils';

const Event = Object.freeze({
    Select: 'select',
    Collapse: 'collapse',
});

const i18n = Object.freeze({
    ExpandNavigation: 'Expand Navigation',
    CollapseNavigation: 'Collapse Navigation',
});

/**
 * Custom vertical navigation component that resembles lightning-vertical-navigation.
 *
 * It supports more customizations than the standard component.
 *
 * See agent_studio/verticalNavigationItem for configuration details.
 * See agent_studio/studioLeftNav for an implementation example.
 */
export default class VerticalNavigation extends LightningElement {
    @api selectedItemName;
    @api sections;

    /**
     * This is managed internally in this component,
     * but can be set from the parent if needed.
     */
    @api
    set isCollapsed(value) {
        this._isCollapsed = value;
    }
    get isCollapsed() {
        return this._isCollapsed;
    }
    _isCollapsed = false;

    get containerClass() {
        return classSet('container slds-is-relative').add({
            collapsed: this._isCollapsed,
        });
    }

    get collapseControlButtonClass() {
        return classSet('slds-button slds-button_neutral collapse-control-button').add({
            collapsed: this._isCollapsed,
        });
    }

    get showCollapseExpandButtonLabel() {
        return !this._isCollapsed;
    }

    get collapseExpandButtonTooltipDisabled() {
        return !this._isCollapsed;
    }

    get collapseExpandButtonIconName() {
        return this._isCollapsed ? 'utility:arrow_right' : 'utility:arrow_left';
    }

    get collapseExpandButtonLabel() {
        return this._isCollapsed ? i18n.ExpandNavigation : i18n.CollapseNavigation;
    }

    get collapseIconClass() {
        return classSet('collapse-icon slds-p-around_x-small').add({
            collapsed: this._isCollapsed,
        });
    }

    handleToggleCollapse() {
        this._isCollapsed = !this._isCollapsed;

        this.dispatchEvent(
            new CustomEvent(Event.Collapse, {
                detail: {
                    isCollapsed: this._isCollapsed,
                },
            })
        );
    }

    handleSelect(event) {
        const { name } = event.detail;

        this.dispatchEvent(
            new CustomEvent(Event.Select, {
                detail: {
                    name,
                },
            })
        );
    }
}
