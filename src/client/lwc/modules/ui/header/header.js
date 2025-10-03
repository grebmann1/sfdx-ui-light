import { LightningElement, api, wire } from 'lwc';
import { isElectronApp, isEmpty, classSet, isNotUndefinedOrNull } from 'shared/utils';
import { connectStore, store as legacyStore, store_application } from 'shared/store';
import { NavigationContext, generateUrl, navigate } from 'lwr/navigation';

import ModalLauncher from 'ui/modalLauncher';
import constant from 'core/constant';

export default class Header extends LightningElement {
    @api currentApplicationName = 'App Name';
    @api currentTabName = 'Home';
    @api applications;
    @api isUserLoggedIn = false;

    @api version = constant.version || '';

    @api isMenuSmall = false;

    @api isAgentChatExpanded = false;

    @wire(NavigationContext)
    navContext;

    @wire(connectStore, { store: legacyStore })
    applicationChange({ application }) {
        // Toggle Menu
        if (isNotUndefinedOrNull(application.isMenuExpanded)) {
            this.isMenuSmall = !application.isMenuExpanded;
        }
    }

    connectedCallback() {
        this.loadCache();
    }

    /** Events **/

    handleToggle = () => {
        this.isMenuSmall = !this.isMenuSmall;
        if (this.isMenuSmall) {
            legacyStore.dispatch(store_application.collapseMenu());
        } else {
            legacyStore.dispatch(store_application.expandMenu());
        }

        window.defaultStore.setItem('header-isMenuSmall', JSON.stringify(this.isMenuSmall));
    };

    handleToggle_rightPanel = () => {
        if (this.isAgentChatExpanded) {
            legacyStore.dispatch(store_application.collapseAgentChat());
        } else {
            legacyStore.dispatch(store_application.expandAgentChat());
        }
    }

    selectTab = e => {
        const target = e.currentTarget.dataset.path;
        if (!isEmpty(target)) {
            navigate(this.navContext, { type: 'application', state: { applicationName: target } });
        } else {
            navigate(this.navContext, { type: 'home' });
        }
    };

    deleteTab = e => {
        e.stopPropagation();
        const applicationId = e.currentTarget.closest('li').dataset.key;
        const filteredTabs = this.applications.filter(x => x.isTabVisible);
        const index = filteredTabs.findIndex(x => x.id === applicationId);
        // Delete app
        this.dispatchEvent(new CustomEvent('tabdelete', { detail: { id: applicationId } }));
        // Navigate
        if (index > 0) {
            navigate(this.navContext, {
                type: 'application',
                state: { applicationName: filteredTabs[index - 1].path },
            });
        } else {
            navigate(this.navContext, { type: 'home' });
        }
    };

    /** Methods **/

    loadCache = async () => {
        try {
            let _isMenuSmall = await window.defaultStore.getItem('header-isMenuSmall');
            if (!isEmpty(_isMenuSmall)) {
                this.isMenuSmall = _isMenuSmall === 'true';
                if (this.isMenuSmall) {
                    legacyStore.dispatch(store_application.collapseMenu());
                } else {
                    legacyStore.dispatch(store_application.expandMenu());
                }
            }
        } catch (e) {
            console.error(e);
        }
    };

    openLauncher = () => {
        ModalLauncher.open({
            isUserLoggedIn: this.isUserLoggedIn,
        }).then(res => {
            if (res) {
                this.dispatchEvent(new CustomEvent('newapp', { detail: res }));
            }
        });
    };

    /** Getters */

    get formattedVersion() {
        return `${this.version}`;
    }

    get collapseClass() {
        return classSet('slds-grid button-container slds-show_medium')
            .add({
                'slds-grid_align-end': !this.isMenuSmall,
                'slds-grid_align-center': this.isMenuSmall,
            })
            .toString();
    }

    get rightPanelCollapseClass() {
        return classSet('slds-grid button-container slds-show_medium')
            .add({
                'slds-grid_align-end': !this.isAgentChatExpanded,
            })
            .toString();
    }
    get leftPanelIconName() {
        return this.isMenuSmall ? 'utility:toggle_panel_left' : 'utility:toggle_panel_right';
    }

    get rightPanelIconName(){
        return this.isAgentChatExpanded ? 'utility:einstein_alt' : 'utility:einstein';
    }
}
