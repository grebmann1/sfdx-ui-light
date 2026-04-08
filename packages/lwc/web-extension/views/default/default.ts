import { api, LightningElement, wire } from 'lwc';
import { store as legacyStore, store_application } from 'shared/store';
import { connectStore, store, EINSTEIN, APPLICATION, AGENT } from 'core/store';

import {
    getChromePort,
    normalizeString as normalize,
    registerChromePort,
    disconnectChromePort,
} from 'shared/utils';
import { PANELS } from 'extension/utils';
import {
    CACHE_CONFIG,
    getAiProviderFromConfig,
    getLlmProviderConfigCacheKeys,
    loadExtensionConfigFromCache,
    resolveLlmProviderConfigMap,
} from 'shared/cacheManager';
import {
    buildAvailableAgentModelOptions,
    fetchLlmModelsEndpoint,
    getProviderForModel,
    normalizeModelSelection,
} from 'shared/llm';

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
        store.dispatch(APPLICATION.reduxSlice.actions.setIsSidePanel({}));
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
            if (this.isSalesforcePanel) {
                this.notifyBackgroundApplicationChange('salesforce');
            }
        }

        // Temporary solution to force refresh of connection list
        if (this.refs.default) {
            (this.refs.default as any).connection_refresh();
        }
    };

    handleApplicationChange = e => {
        const applicationName = e?.detail?.applicationName;
        this.notifyBackgroundApplicationChange(applicationName);
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
            ...getLlmProviderConfigCacheKeys(),
            CACHE_CONFIG.BETA_SMARTINPUT_ENABLED.key,
        ]);

        this.betaSmartInputEnabled = !!configuration[CACHE_CONFIG.BETA_SMARTINPUT_ENABLED.key];

        const providerConfigs = resolveLlmProviderConfigMap(configuration);
        const openaiKey = providerConfigs.openai.apiKey;
        const openaiUrl = providerConfigs.openai.baseUrl;
        const mistralKey = providerConfigs.mistral.apiKey;
        const aiProvider = getAiProviderFromConfig(configuration);
        LOGGER.debug('loadFromCache - openaiKey', openaiKey);
        LOGGER.debug('loadFromCache - openaiUrl', openaiUrl);
        LOGGER.debug('loadFromCache - mistralKey', mistralKey);
        LOGGER.debug('loadFromCache - aiProvider', aiProvider);
        store.dispatch(APPLICATION.reduxSlice.actions.updateProviderConfigs({ providerConfigs }));
        store.dispatch(APPLICATION.reduxSlice.actions.updateAiProvider({ aiProvider }));
        try {
            const response = await fetchLlmModelsEndpoint({
                provider: aiProvider,
                providerConfigs,
            });
            store.dispatch(
                APPLICATION.reduxSlice.actions.updateProviderCatalogs({
                    catalogs: response.catalogs,
                })
            );
            const availableModels = buildAvailableAgentModelOptions({
                availableModelsByProvider: response.catalogs,
                providerConfigs,
            });
            if (availableModels.length > 0) {
                const currentModel = store.getState()?.agent?.selectedModel;
                const normalizedModel = normalizeModelSelection(currentModel, availableModels);
                if (normalizedModel && normalizedModel !== currentModel) {
                    store.dispatch(
                        AGENT.reduxSlice.actions.updateSelectedModel({ model: normalizedModel })
                    );
                }
                const resolvedProvider = getProviderForModel(normalizedModel, availableModels);
                if (resolvedProvider !== aiProvider) {
                    store.dispatch(
                        APPLICATION.reduxSlice.actions.updateAiProvider({
                            aiProvider: resolvedProvider,
                        })
                    );
                }
            }
        } catch (error) {
            LOGGER.warn('loadFromCache - failed to refresh LLM catalog', error);
        }
    };

    connectToBackground = () => {
        const port = registerChromePort(
            chrome.runtime.connect({ name: 'sf-toolkit-sidepanel' })
        ) as any;
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
                legacyStore.dispatch(
                    store_application.fakeNavigate({
                        type: 'application',
                        state: {
                            applicationName: 'smartinput',
                        },
                    })
                );
            }
        });
    };

    disconnectFromBackground = () => {
        disconnectChromePort();
    };

    notifyBackgroundApplicationChange = applicationName => {
        const port = getChromePort() as any;
        if (!port) return;
        try {
            port.postMessage({
                action: 'sidepanel_application_changed',
                applicationName,
            });
        } catch (e) {
            LOGGER.debug('notifyBackgroundApplicationChange failed', e);
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
