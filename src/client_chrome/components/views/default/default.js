import { api, LightningElement, wire } from 'lwc';
import { store as legacyStore, store_application } from 'shared/store';
import { connectStore, store, EINSTEIN, APPLICATION } from 'core/store';

import { normalizeString as normalize,registerChromePort,disconnectChromePort } from 'shared/utils';
import { PANELS } from 'extension/utils';
import { CACHE_CONFIG, loadExtensionConfigFromCache } from 'shared/cacheManager';

import LOGGER from 'shared/logger';
export default class Default extends LightningElement {
    @api currentApplication;
    @api recordId;
    @api panel = PANELS.DEFAULT;

    previousPanel;
    isBackButtonDisplayed = false;
    betaSmartInputEnabled = false;

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
        this.loadFromCache();
        store.dispatch(APPLICATION.reduxSlice.actions.setIsSidePanel());
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

    loadFromCache = async () => {
        const configuration = await loadExtensionConfigFromCache([
            CACHE_CONFIG.UI_IS_APPLICATION_TAB_VISIBLE.key,
            CACHE_CONFIG.MISTRAL_KEY.key,
            CACHE_CONFIG.AI_PROVIDER.key,
            CACHE_CONFIG.OPENAI_KEY.key,
            CACHE_CONFIG.OPENAI_URL.key,
            CACHE_CONFIG.BETA_SMARTINPUT_ENABLED.key,
        ]);

        this.betaSmartInputEnabled = !!configuration[CACHE_CONFIG.BETA_SMARTINPUT_ENABLED.key];

        // Handle LLM keys and provider
        const openaiKey = configuration[CACHE_CONFIG.OPENAI_KEY.key];
        const openaiUrl = configuration[CACHE_CONFIG.OPENAI_URL.key];
        const mistralKey = configuration[CACHE_CONFIG.MISTRAL_KEY.key];
        const aiProvider = configuration[CACHE_CONFIG.AI_PROVIDER.key];
        LOGGER.debug('loadFromCache - openaiKey',openaiKey);
        LOGGER.debug('loadFromCache - openaiUrl',openaiUrl);
        LOGGER.debug('loadFromCache - mistralKey',mistralKey);
        LOGGER.debug('loadFromCache - aiProvider',aiProvider);
        if(openaiKey) {
            store.dispatch(APPLICATION.reduxSlice.actions.updateOpenAIKey({ openaiKey,openaiUrl }));
        }
        if(mistralKey) {
            store.dispatch(APPLICATION.reduxSlice.actions.updateMistralKey({ mistralKey }));
        }
        if(aiProvider) {
            store.dispatch(APPLICATION.reduxSlice.actions.updateAiProvider({ aiProvider }));
        }
    };

    connectToBackground = () => {
        const port = registerChromePort(
            chrome.runtime.connect({ name: 'sf-toolkit-sidepanel' })
        );
        // Copy for global access
        port.onDisconnect.addListener(() => {
            // Optionally handle disconnect in content script
            // e.g., cleanup, logging, etc.
        });
        port.onMessage.addListener(message => {
            LOGGER.log('--> SidePanel - onMessage <--', message);
            if (message.action === 'refresh') {
                store.dispatch(
                    EINSTEIN.reduxSlice.actions.loadCacheSettings({
                        alias: 'global_einstein',
                    })
                );
            } else if (message.action === 'show_input_quickpick') {
                // Ensure default panel is shown and set application to quickpick
                if (!this.betaSmartInputEnabled) return;
                legacyStore.dispatch(store_application.fakeNavigate({
                    type: 'application',
                    state: {
                        applicationName: 'smartinput',
                    },
                }));
            }
        });
    };

    disconnectFromBackground = () => {
        disconnectChromePort();
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
        if (
            applicationName === 'documentation' ||
            applicationName === 'home' ||
            (applicationName === 'smartinput' && this.betaSmartInputEnabled)
        ) {
            this.handlePanelChange({
                detail: {
                    panel: PANELS.DEFAULT,
                    isBackButtonDisplayed: true,
                },
            });
        }
    };
}
