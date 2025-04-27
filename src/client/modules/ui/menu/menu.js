import { api, wire } from 'lwc';
import ToolkitElement from 'core/toolkitElement';
import {
    isElectronApp,
    isEmpty,
    classSet,
    isNotUndefinedOrNull,
    isUndefinedOrNull,
} from 'shared/utils';
import { CACHE_CONFIG, loadExtensionConfigFromCache } from 'shared/cacheManager';

import { CONFIG } from 'ui/app';
import { connectStore, store as legacyStore, store_application } from 'shared/store';
import { NavigationContext, CurrentPageReference, generateUrl, navigate } from 'lwr/navigation';
import LOGGER from 'shared/logger';

export default class Menu extends ToolkitElement {
    @api isUserLoggedIn = false; // to enforce t
    @api version;
    isMenuSmall = false;
    selectedItem = 'home';

    isApplicationTabVisible = false;

    @wire(NavigationContext)
    navContext;

    @wire(connectStore, { store: legacyStore })
    applicationChange({ application }) {
        LOGGER.debug('applicationChange', application);
        // Toggle Menu
        if (isNotUndefinedOrNull(application.isMenuExpanded)) {
            this.isMenuSmall = !application.isMenuExpanded;
        }
    }

    @wire(CurrentPageReference)
    handleNavigation(pageRef) {
        if (isUndefinedOrNull(pageRef)) return;
        if (JSON.stringify(this._pageRef) == JSON.stringify(pageRef)) return;

        this.updateMenuItemFromNavigation(pageRef);
    }

    updateMenuItemFromNavigation = async ({ state }) => {
        const { applicationName } = state;
        if (this.selectedItem != applicationName) {
            //console.log('Update Menu - From Navigation');
            this.selectedItem = applicationName || 'home';
            this.updateSelectedItem();
        }
    };

    connectedCallback() {
        if (isElectronApp()) {
            this.isMenuSmall = true; // by default it small for electron apps
            legacyStore.dispatch(store_application.collapseMenu());
        }
        this.loadFromCache();
    }

    /** Events **/

    handleApplicationSelection = e => {
        e.stopPropagation();
        const target = e.detail.name || e.detail.value;
        if (!isEmpty(target)) {
            navigate(this.navContext, { type: 'application', state: { applicationName: target } });
        } else {
            navigate(this.navContext, { type: 'home' });
        }
        this.selectedItem = target;
    };

    handleRedirection = e => {
        e.preventDefault();
        e.stopPropagation();
        const url = e.currentTarget.dataset.url;
        legacyStore.dispatch(store_application.navigate(url));
    };

    handleToggle = () => {
        this.isMenuSmall = !this.isMenuSmall;
        if (this.isMenuSmall) {
            legacyStore.dispatch(store_application.collapseMenu());
        } else {
            legacyStore.dispatch(store_application.expandMenu());
        }
    };

    /** Methods **/

    loadFromCache = async () => {
        const configuration = await loadExtensionConfigFromCache([
            CACHE_CONFIG.UI_IS_APPLICATION_TAB_VISIBLE.key,
        ]);
        this.isApplicationTabVisible =
            configuration[CACHE_CONFIG.UI_IS_APPLICATION_TAB_VISIBLE.key];
        console.log('isApplicationTabVisible', this.isApplicationTabVisible);
    };

    updateSelectedItem = () => {
        let currentActiveItem = this.template.querySelector(
            '.slds-nav-vertical__item.slds-is-active'
        );
        let newActiveItem = this.template.querySelector(
            `.slds-nav-vertical__item[data-key="${this.selectedItem}"]`
        );
        if (currentActiveItem) {
            currentActiveItem.classList.remove('slds-is-active');
        }
        if (newActiveItem) {
            newActiveItem.classList.add('slds-is-active');
        }
    };

    formatMenuItems = (items, hideMenuLabel = false) => {
        return items.map(x => {
            const menuLabel = isEmpty(x.menuLabel) ? x.label : x.menuLabel;
            return {
                ...x,
                menuLabel: hideMenuLabel ? null : menuLabel,
                //menuIcon:isEmpty(x.menuIcon)?null:x.menuIcon
            };
        });
    };

    generateFilter = (name, hideMenuLabel = false) => {
        var filtered = this.formatMenuItems(
            this.items.filter(x => x.type === name),
            hideMenuLabel
        );
        if (!isElectronApp()) {
            filtered = filtered.filter(x => !x.isElectronOnly);
        }
        if (!this.isUserLoggedIn) {
            filtered = filtered.filter(x => x.isOfflineAvailable);
        }

        return filtered;
    };

    /** Getters **/

    get isTitleDisplayed() {
        return !this.isMenuSmall;
    }

    get collapseClass() {
        return classSet('slds-grid')
            .add({
                'slds-grid_align-end': !this.isMenuSmall,
                'slds-grid_align-center': this.isMenuSmall,
            })
            .toString();
    }

    get isSmallToolDisplayed() {}

    get applicationLabel() {
        return this.isMenuSmall ? 'App' : 'Applications';
    }

    get toolsLabel() {
        return this.isMenuSmall ? 'Tools' : 'Tools';
    }

    get connectionLabel() {
        return this.isMenuSmall ? 'Conn' : 'Connections';
    }

    get items() {
        return CONFIG?.APP_LIST || [];
    }

    get homes() {
        return this.generateFilter('home', this.isMenuSmall);
    }

    get applications() {
        return this.generateFilter('application');
    }

    get documentations() {
        return this.generateFilter('documentation');
    }

    get extras() {
        return this.generateFilter('extra');
    }

    get tools() {
        return this.generateFilter('tool');
    }

    get hasTools() {
        return this.tools.length > 0;
    }

    get hasApplications() {
        return this.applications.length > 0;
    }

    get connections() {
        return this.generateFilter('connection');
    }

    get others() {
        return [
            {
                name: 'extra_reportIssue',
                url: 'https://github.com/grebmann1/sfdx-ui-light/issues',
                menuIcon: 'utility:bug',
                menuLabel: this.isMenuSmall ? '' : 'Report Issue',
            },
            {
                name: 'extra_contribute',
                url: 'https://github.com/grebmann1/sfdx-ui-light',
                menuIcon: 'utility:recipe',
                menuLabel: this.isMenuSmall ? '' : 'Contribute',
            },
        ];
    }

    get iconName() {
        return this.isMenuSmall ? 'utility:toggle_panel_left' : 'utility:toggle_panel_right';
    }

    get isNotMenuSmall() {
        return !this.isMenuSmall;
    }

    get formattedVersion() {
        return `${this.version}`;
    }

    get isHeaderLightDisplayed() {
        return !this.isApplicationTabVisible;
    }
}
