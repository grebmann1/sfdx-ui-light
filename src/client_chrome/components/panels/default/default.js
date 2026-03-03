import { api, LightningElement, wire } from 'lwc';
import { store as legacyStore, store_application } from 'shared/store';
import { isNotUndefinedOrNull, redirectToUrlViaChrome, isEmpty, isUndefinedOrNull } from 'shared/utils';
import { APPLICATION, connectStore, store } from 'core/store';
import LOGGER from 'shared/logger';
import { CACHE_CONFIG, loadSingleExtensionConfigFromCache } from 'shared/cacheManager';

const APPLICATIONS = {
    CONNECTION: 'connection',
    DOCUMENTATION: 'documentation',
    ASSISTANT: 'assistant',
    AGENT: 'agent',
    SMARTINPUT: 'smartinput',
};

export default class Default extends LightningElement {
    @api isBackButtonDisplayed = false;

    _currentApplication; //APPLICATIONS.ASSISTANT;//
    betaSmartInputEnabled = false;

    connectedCallback() {
        this.loadBetaFlags();
    }

    loadBetaFlags = async () => {
        try {
            this.betaSmartInputEnabled = !!(await loadSingleExtensionConfigFromCache(
                CACHE_CONFIG.BETA_SMARTINPUT_ENABLED.key
            ));
        } catch (e) {
            this.betaSmartInputEnabled = false;
        }
    };

    @api
    get currentApplication() {
        return this._currentApplication || APPLICATIONS.CONNECTION; // Default to CONNECTION
    }

    set currentApplication(value) {
        this._currentApplication = value;
        store.dispatch(
            APPLICATION.reduxSlice.actions.updateCurrentApplication({
                application: value,
            })
        );
    }

    isAgentDisplayed = false;

    /** Getters **/

    get connectionVariant() {
        return this.isConnection ? 'brand' : 'standard';
    }

    get assistantVariant() {
        return this.isAssistant ? 'brand' : 'standard';
    }

    get agentVariant() {
        return this.isAgent ? 'brand' : 'standard';
    }

    get documentationVariant() {
        return this.isDocumentation ? 'brand' : 'standard';
    }

    get isConnection() {
        return this.currentApplication == APPLICATIONS.CONNECTION;
    }

    get isDocumentation() {
        return this.currentApplication == APPLICATIONS.DOCUMENTATION;
    }

    get isAssistant() {
        return this.currentApplication == APPLICATIONS.ASSISTANT;
    }

    get isAgent() {
        return this.currentApplication == APPLICATIONS.AGENT;
    }

    get isSmartInput() {
        return this.currentApplication == APPLICATIONS.SMARTINPUT;
    }

    get isSmartInputDisplayed() {
        return this.betaSmartInputEnabled && this.isSmartInput;
    }

    get isAssistantDisplayed() {
        return true; //isNotUndefinedOrNull(this.openaiAssistantId) && isNotUndefinedOrNull(this.openaiKey);
    }

    // Legacy Store
    @wire(connectStore, { store: legacyStore })
    applicationChange({ application }) {
        //console.log('application',application)
        if (application?.type === 'FAKE_NAVIGATE') {
            const pageRef = application.target;
            this.loadFromNavigation(pageRef);
        }
        //console.log('application in default',application)
    }

    // New Store
    @wire(connectStore,{store: store})
    stateChange({ application }) {
        if(application?.openaiKey){
            this.isAgentDisplayed = !isEmpty(application.openaiKey);
        }
    }


    /** Events **/

    einsteinClick = () => {
        legacyStore.dispatch(store_application.fakeNavigate({
            type: 'application',
            state: {
                applicationName: APPLICATIONS.ASSISTANT,
            },
        }));
    };

    openConnectionClick = () => {
        legacyStore.dispatch(store_application.fakeNavigate({
            type: 'application',
            state: {
                applicationName: APPLICATIONS.CONNECTION,
            },
        }));
    };

    documentationClick = e => {
        legacyStore.dispatch(store_application.fakeNavigate({
            type: 'application',
            state: {
                applicationName: APPLICATIONS.DOCUMENTATION,
            },
        }));
    };

    openAgentClick = () => {
        legacyStore.dispatch(store_application.fakeNavigate({
            type: 'application',
            state: {
                applicationName: APPLICATIONS.AGENT,
            },
        }));
    };

    openSmartInputClick = () => {
        if (!this.betaSmartInputEnabled) return;
        legacyStore.dispatch(store_application.fakeNavigate({
            type: 'application',
            state: {
                applicationName: APPLICATIONS.SMARTINPUT,
            },
        }));
    };

    openToolkitClick = () => {
        const params = new URLSearchParams({
            applicationName: 'home',
        });
        redirectToUrlViaChrome({
            baseUrl: chrome.runtime.getURL('/views/app.html'),
            redirectUrl: encodeURIComponent(params.toString()),
        });
    };

    handleBackClick = () => {
        this.dispatchEvent(new CustomEvent('back', { bubbles: true, composed: true }));
    };

    handleSearch = e => {
        const { value } = e.detail;
        if (this.isConnection && isNotUndefinedOrNull(value)) {
            this.handleSearchConnection(value);
        } else if (this.isDocumentation && isNotUndefinedOrNull(value)) {
            this.handleSearchDocumentation(value);
        }
    };

    exportClick = e => {
        if (this.refs.connection) {
            this.refs.connection.exportClick();
        }
    };

    importClick = e => {
        if (this.refs.connection) {
            this.refs.connection.importClick();
        }
    };

    /** Methods **/

    loadFromNavigation = async ({ state }) => {
        //('documentation - loadFromNavigation');
        const { applicationName } = state || {};
        // `home` is used by the org-view ellipsis (and some inject actions) to mean
        // "open the default panel". In the side panel, `currentApplication` must be
        // a concrete app (connection/docs/agent/smartinput). Default to Connections.
        let targetApplication = applicationName === 'home' ? APPLICATIONS.CONNECTION : applicationName;
        if (isUndefinedOrNull(targetApplication) || isEmpty(targetApplication)) {
            targetApplication = APPLICATIONS.CONNECTION;
        }
        if (!Object.values(APPLICATIONS).includes(targetApplication)) {
            targetApplication = APPLICATIONS.CONNECTION;
        }
        if (targetApplication === APPLICATIONS.SMARTINPUT && !this.betaSmartInputEnabled) {
            targetApplication = APPLICATIONS.CONNECTION;
        }
        this.currentApplication = targetApplication;
    };

    handleSearchConnection = value => {
        if (this.refs.connection) {
            this.refs.connection.applyFilter(value);
        }
    };

    handleSearchDocumentation = value => {
        if (this.refs.documentation) {
            this.refs.documentation.externalSearch(value);
        }
    };

    @api
    connection_refresh = () => {
        if (this.refs.connection) {
            this.refs.connection.fetchAllConnections();
        }
    };

    get applications() {
        return APPLICATIONS;
    }
}
