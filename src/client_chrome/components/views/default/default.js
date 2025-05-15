import { api, LightningElement, wire } from 'lwc';
import { store as legacyStore } from 'shared/store';
import { connectStore, store, EINSTEIN } from 'core/store';

import { normalizeString as normalize } from 'shared/utils';
import { PANELS } from 'extension/utils';
import LOGGER from 'shared/logger';
export default class Default extends LightningElement {
    @api currentApplication;
    @api recordId;
    @api panel = PANELS.DEFAULT;

    port;

    previousPanel;
    isBackButtonDisplayed = false;

    /** Getters **/

    get urlOverwrittenPanel() {
        return new URLSearchParams(window.location.search).get('panel');
    }

    get normalizedPanel() {
        return normalize(this.panel, {
            fallbackValue: PANELS.SALESFORCE,
            validValues: Object.values(PANELS),
        });
    }

    get isSalesforcePanel() {
        return this.normalizedPanel === PANELS.SALESFORCE;
    }

    get salesforcePanelClass() {
        return this.isSalesforcePanel ? '' : 'slds-hide';
    }

    get defaultPanelClass() {
        return this.isSalesforcePanel ? 'slds-hide' : '';
    }

    @wire(connectStore, { store: legacyStore })
    applicationChange({ application }) {
        if (application?.type === 'FAKE_NAVIGATE') {
            const pageRef = application.target;
            this.loadFromNavigation(pageRef);
        }
        //console.log('application',application)
    }

    connectedCallback() {
        this.panel = this.urlOverwrittenPanel || this.panel;
        this.connectToBackground();
    }

    disconnectedCallback() {
        this.disconnectFromBackground();
    }

    /** Events **/

    handlePanelChange = e => {
        //console.log('handlePanelChange',e.detail);
        //this.previousPanel = this.panel;
        if (this.panel !== e.detail.panel) {
            this.panel = e.detail.panel;
            this.isBackButtonDisplayed = e.detail.isBackButtonDisplayed;
        }

        // Temporary solution to force refresh of connection list
        if (this.refs.default) {
            this.refs.default.connection_refresh();
        }
    };

    handleGoBack = () => {
        //console.log('handleGoBack');
        //this.panel = this.previousPanel;
        this.panel = PANELS.SALESFORCE; // For now only salesforce is returned with go back, In the futur, store the navigation events to go back !
        this.isBackButtonDisplayed = false;
        //this.previousPanel = null;
    };

    /** Methods **/

    connectToBackground = () => {
        this.port = chrome.runtime.connect({ name: 'sf-toolkit-sidepanel' });
        this.port.onDisconnect.addListener(() => {
            // Optionally handle disconnect in content script
            // e.g., cleanup, logging, etc.
        });
        this.port.onMessage.addListener(message => {
            LOGGER.log('--> SidePanel - onMessage <--', message);
            if (message.action === 'refresh') {
                store.dispatch(
                    EINSTEIN.reduxSlice.actions.loadCacheSettings({
                        alias: 'global_einstein',
                    })
                );
            }
        });
    };

    disconnectFromBackground = () => {
        if (this.port) {
            this.port.disconnect();
        }
    };

    @api
    resetToDefaultView = () => {
        //console.log('resetToDefaultView');
        this.panel = PANELS.DEFAULT;
    };

    loadFromNavigation = async ({ state }) => {
        //('documentation - loadFromNavigation');
        const { applicationName, attribute1 } = state;
        //console.log('applicationName',applicationName);
        if (applicationName === 'documentation' || applicationName === 'home') {
            this.handlePanelChange({
                detail: {
                    panel: PANELS.DEFAULT,
                    isBackButtonDisplayed: true,
                },
            });
        }
    };
}
