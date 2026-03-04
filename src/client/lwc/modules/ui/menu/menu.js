import { api, wire } from 'lwc';
import ToolkitElement from 'core/toolkitElement';
import {
    isElectronApp,
    isChromeExtension,
    isEmpty,
    classSet,
    isNotUndefinedOrNull,
    isUndefinedOrNull,
} from 'shared/utils';
import { CACHE_CONFIG, loadExtensionConfigFromCache } from 'shared/cacheManager';

import { CONFIG } from 'ui/app';
import { connectStore, store as legacyStore, store_application } from 'shared/store';
import { NavigationContext, CurrentPageReference, navigate } from 'lwr/navigation';
import LOGGER from 'shared/logger';

export default class Menu extends ToolkitElement {
    @api isUserLoggedIn = false; // to enforce t
    @api version;
    isMenuSmall = false;
    selectedItem = 'home';
    filterText = '';

    isApplicationTabVisible = false;
    betaSmartInputEnabled = false;

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
            this.selectedItem = applicationName || 'home';
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

    handleSelect = (e) => {
        e.stopPropagation();
        const name = e.detail?.name;
        const external = this.others.find((o) => o.name === name);
        if (external?.url) {
            legacyStore.dispatch(store_application.navigate(external.url));
            return;
        }
        const target = isEmpty(name) ? null : name;
        if (!isEmpty(target)) {
            navigate(this.navContext, { type: 'application', state: { applicationName: target } });
        } else {
            navigate(this.navContext, { type: 'home' });
        }
        this.selectedItem = target || 'home';
        const appName = this.items.find((x) => x.path === this.selectedItem)?.name ?? this.selectedItem;
        this.dispatchEvent(
            new CustomEvent('applicationselection', {
                detail: { target: appName },
                bubbles: true,
                composed: true,
            })
        );
    };

    handleCollapse = (e) => {
        this.isMenuSmall = e.detail?.isCollapsed ?? false;
        if (this.isMenuSmall) {
            legacyStore.dispatch(store_application.collapseMenu());
        } else {
            legacyStore.dispatch(store_application.expandMenu());
        }
    };

    handleToggle = () => {
        this.isMenuSmall = !this.isMenuSmall;
        if (this.isMenuSmall) {
            legacyStore.dispatch(store_application.collapseMenu());
        } else {
            legacyStore.dispatch(store_application.expandMenu());
        }
    };

    handleSearchInput = (e) => {
        this.filterText = (e.target.value || '').trim();
    };

    /** Methods **/

    filterBySearch = (items, searchText) => {
        if (isEmpty(searchText)) return items;
        const lower = searchText.toLowerCase();
        return items.filter((x) => {
            const label = (x.menuLabel || x.label || x.name || '').toString().toLowerCase();
            return label.includes(lower);
        });
    };

    loadFromCache = async () => {
        const configuration = await loadExtensionConfigFromCache([
            CACHE_CONFIG.UI_IS_APPLICATION_TAB_VISIBLE.key,
            CACHE_CONFIG.BETA_SMARTINPUT_ENABLED.key,
        ]);
        this.isApplicationTabVisible = configuration[CACHE_CONFIG.UI_IS_APPLICATION_TAB_VISIBLE.key];
        this.betaSmartInputEnabled = !!configuration[CACHE_CONFIG.BETA_SMARTINPUT_ENABLED.key];
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
        // If not Chrome, filter out Chrome only apps
        if (!isChromeExtension()) {
            filtered = filtered.filter(x => !x.isChromeOnly);
        }

        if (!this.isUserLoggedIn) {
            filtered = filtered.filter(x => x.isOfflineAvailable);
        }

        // Beta features
        if (!this.betaSmartInputEnabled) {
            filtered = filtered.filter(x => x.name !== 'smartinput/app');
        }

        return filtered;
    };

    getFilteredItemsByPaths = (paths) => {
        if (!Array.isArray(paths) || paths.length === 0) return [];
        let filtered = this.items.filter((x) => paths.includes(x.path));
        filtered = this.formatMenuItems(filtered);
        if (!isElectronApp()) {
            filtered = filtered.filter((x) => !x.isElectronOnly);
        }
        if (!isChromeExtension()) {
            filtered = filtered.filter((x) => !x.isChromeOnly);
        }
        if (!this.isUserLoggedIn) {
            filtered = filtered.filter((x) => x.isOfflineAvailable);
        }
        if (!this.betaSmartInputEnabled) {
            filtered = filtered.filter((x) => x.name !== 'smartinput/app');
        }
        return this.filterBySearch(filtered, this.filterText);
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
        return this.isMenuSmall ? 'Exp' : 'Explorers';
    }

    get developerLabel() {
        return this.isMenuSmall ? 'Dev' : 'Developer';
    }

    get dataLabel() {
        return this.isMenuSmall ? 'Data' : 'Data';
    }

    get utilitiesLabel() {
        return this.isMenuSmall ? 'Util' : 'Utilities';
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

    get filteredHomes() {
        return this.filterBySearch(this.homes, this.filterText);
    }

    get explorers() {
        return this.generateFilter('explorer');
    }

    get filteredExplorers() {
        return this.filterBySearch(this.explorers, this.filterText);
    }

    get documentations() {
        return this.generateFilter('documentation');
    }

    get filteredDocumentations() {
        return this.filterBySearch(this.documentations, this.filterText);
    }

    get extras() {
        return this.generateFilter('extra');
    }

    get filteredExtras() {
        return this.filterBySearch(this.extras, this.filterText);
    }

    get developerTools() {
        return this.generateFilter('developer');
    }

    get filteredDeveloperTools() {
        return this.filterBySearch(this.developerTools, this.filterText);
    }

    get dataTools() {
        return this.generateFilter('data');
    }

    get filteredDataTools() {
        return this.filterBySearch(this.dataTools, this.filterText);
    }

    get utilities() {
        return this.generateFilter('utility');
    }

    get filteredUtilities() {
        return this.filterBySearch(this.utilities, this.filterText);
    }

    get hasFilteredExplorers() {
        return this.filteredExplorers.length > 0;
    }

    get hasFilteredDeveloperTools() {
        return this.filteredDeveloperTools.length > 0;
    }

    get hasFilteredDataTools() {
        return this.filteredDataTools.length > 0;
    }

    get hasFilteredUtilities() {
        return this.filteredUtilities.length > 0;
    }

    get connections() {
        return this.generateFilter('connection');
    }

    get filteredConnections() {
        return this.filterBySearch(this.connections, this.filterText);
    }

    get isUnlimitedModeAndHasConnections() {
        return this.isUnlimitedMode && this.filteredConnections.length > 0;
    }

    get others() {
        return [
            {
                name: 'extra_howTo',
                url: 'https://sf-toolkit.com/install',
                menuIcon: 'utility:knowledge_base',
                menuLabel: this.isMenuSmall ? '' : 'How to',
            },
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

    get filteredOthers() {
        return this.filterBySearch(this.others, this.filterText);
    }

    get isUnlimitedMode() {
        return !isElectronApp();
    }

    get formattedVersion() {
        return `${this.version}`;
    }

    get isHeaderLightDisplayed() {
        return !this.isApplicationTabVisible;
    }

    get selectedItemName() {
        return this.selectedItem;
    }

    get sections() {
        const sel = this.selectedItem;
        const toItem = (x) => ({
            name: x.path,
            label: x.menuLabel || x.label || '',
            iconName: x.menuIcon || x.quickActionIcon,
            isSelected: x.path === sel,
            isLink: false,
        });
        const toChild = (x) => ({
            name: x.path,
            label: x.menuLabel || x.label || x.shortName || '',
            isSelected: x.path === sel,
            isLink: false,
        });
        const toOtherItem = (x) => ({
            name: x.name,
            label: x.menuLabel || '',
            iconName: x.menuIcon,
            isSelected: false,
            isLink: !!x.url,
        });

        const buildGroups = [
            {
                key: 'home',
                label: 'Home',
                iconName: 'utility:home',
                paths: ['home'],
                flat: true,
            },
            {
                key: 'data',
                label: 'Data',
                iconName: 'utility:database',
                paths: ['soql', 'dataimport'],
                flat: false,
            },
            {
                key: 'code',
                label: 'Code',
                iconName: 'standard:apex',
                paths: ['api', 'platformevent', 'anonymousapex', 'code'],
                flat: false,
            },
            {
                key: 'explorers',
                label: 'Explorers',
                iconName: 'standard:knowledge',
                paths: ['metadata', 'sobject', 'recordviewer', 'org', 'access'],
                flat: false,
            },
            {
                key: 'deploy',
                label: 'Deploy',
                iconName: 'standard:maintenance_asset',
                paths: ['package'],
                flat: false,
            },
            {
                key: 'utilities',
                label: 'Utilities',
                iconName: 'utility:magicwand',
                paths: ['smartinput', 'textcompare'],
                flat: false,
            },
        ];

        const buildItems = [];
        for (const group of buildGroups) {
            const filtered = this.getFilteredItemsByPaths(group.paths);
            if (filtered.length === 0) continue;
            if (group.flat) {
                buildItems.push(...filtered.map(toItem));
            } else {
                const children = filtered.map(toChild);
                const hasSelectedChild = children.some((c) => c.isSelected);
                buildItems.push({
                    name: `build-${group.key}`,
                    label: group.label,
                    iconName: group.iconName,
                    isSelected: false,
                    isLink: false,
                    defaultExpanded: hasSelectedChild,
                    children,
                });
            }
        }

        const connectionItems = this.isUnlimitedModeAndHasConnections
            ? this.getFilteredItemsByPaths(['connections']).map(toItem)
            : [];
        const documentationItems = this.getFilteredItemsByPaths(['documentation']).map(toItem);
        const othersItems = [
            ...this.filteredExtras.map(toItem),
            ...this.filteredOthers.map(toOtherItem),
        ];

        return [
            { label: 'Build', items: buildItems },
            ...(connectionItems.length > 0 ? [{ label: 'Connections', items: connectionItems }] : []),
            ...(documentationItems.length > 0
                ? [{ label: 'Documentation', items: documentationItems }]
                : []),
            { label: 'Others', items: othersItems },
        ];
    }
}
