import { api, wire } from 'lwc';
import ToolkitElement from 'core/toolkitElement';
import { connectStore, store, APPLICATION } from 'core/store';
import { store as legacyStore, store_application } from 'shared/store';
import {
    isEmpty,
    isNotUndefinedOrNull,
    isSalesforceId,
    redirectToUrlViaChrome,
} from 'shared/utils';
import { CACHE_CONFIG, loadExtensionConfigFromCache } from 'shared/cacheManager';


const APPLICATIONS = {
    RECORD_EXPLORER: 'recordExplorer',
    USER_EXPLORER: 'userExplorer',
    ORG_INFO: 'orgInfo',
    TOOLS: 'tools',
};

export default class Salesforce extends ToolkitElement {
    @api currentOrigin;

    @api currentApplication = APPLICATIONS.RECORD_EXPLORER;
    @api isBackButtonDisplayed = false;
    isConnectorLoaded = false;

    _recordId;

    @api
    get recordId() {
        return this._recordId;
    }

    // this.openSpecificTab(APPLICATIONS.RECORD_EXPLORER);

    set recordId(value) {
        this._recordId = value;
        if (isNotUndefinedOrNull(this._recordId)) {
            this.openSpecificTab(APPLICATIONS.RECORD_EXPLORER);
        }
    }

    /** Getters **/

    get APPLICATIONS() {
        return APPLICATIONS;
    }

    get currentActiveTab() {
        return this.template.querySelector('slds-tabset')?.activeTabValue;
    }

    //orgInfo

    get isDefaultMenu() {
        return true;
    }

    get isRecordExplorerAvailable() {
        return !isEmpty(this.recordId) && isSalesforceId(this.recordId) && /\d/.test(this.recordId);
    }

    get isUserExplorerAvailable() {
        return true; // No specific logic yet to reduce the visibility
    }

    get isFooterDisplayed() {
        return this.isConnectorLoaded;
    }

    get instanceUrl() {
        return this.connector?.conn?.instanceUrl;
    }

    connectedCallback() {
        this.loadFromCache();
    }

    @wire(connectStore, { store })
    applicationChange({ application }) {
        //console.log('application',application,this.connector);
        if (
            isNotUndefinedOrNull(application.connector) &&
            isNotUndefinedOrNull(this.connector) &&
            application.connector?.conn?.accessToken != this.connector.connector?.conn?.accessToken
        ) {
            this.isConnectorLoaded = true;
            this.openSpecificTab(APPLICATIONS.RECORD_EXPLORER);
        }
    }

    /** Events **/

    redirectToWebsite = () => {
        redirectToUrlViaChrome({
            sessionId: this.connector.conn.accessToken,
            serverUrl: this.connector.conn.instanceUrl,
            baseUrl: chrome.runtime.getURL('/views/app.html'),
        });
    };

    redirectToAnonymousApex = () => {
        const params = new URLSearchParams({
            applicationName: 'anonymousapex',
        });
        redirectToUrlViaChrome({
            sessionId: this.connector.conn.accessToken,
            serverUrl: this.connector.conn.instanceUrl,
            baseUrl: chrome.runtime.getURL('/views/app.html'),
            redirectUrl: encodeURIComponent(params.toString()),
        });
    };

    redirectToSoqlBuilder = () => {
        const params = new URLSearchParams({
            applicationName: 'soql',
        });
        redirectToUrlViaChrome({
            sessionId: this.connector.conn.accessToken,
            serverUrl: this.connector.conn.instanceUrl,
            baseUrl: chrome.runtime.getURL('/views/app.html'),
            redirectUrl: encodeURIComponent(params.toString()),
        });
    };

    handleSearch = e => {
        //console.log('handleSearch',this.refs.userexplorer);
        const { value } = e.detail;
        if (
            this.refs.recordexplorer &&
            isNotUndefinedOrNull(value) &&
            this.currentActiveTab === APPLICATIONS.RECORD_EXPLORER
        ) {
            this.refs.recordexplorer.updateFilter(value);
        } else if (
            this.refs.userexplorer &&
            isNotUndefinedOrNull(value) &&
            this.currentActiveTab === APPLICATIONS.USER_EXPLORER
        ) {
            this.refs.userexplorer.updateFilter(value);
        }
    };

    einsteinClick = () => {
        const params = {
            type: 'application',
            state: {
                applicationName: 'assistant',
            },
        };

        legacyStore.dispatch(store_application.fakeNavigate(params));
    };

    openDefaultPanel = () => {
        const params = {
            type: 'application',
            state: {
                applicationName: 'home',
            },
        };

        legacyStore.dispatch(store_application.fakeNavigate(params));
    };

    addConnection_authorize = e => {};

    addConnection_hide = e => {};

    /** Methods **/

    loadFromCache = async () => {
        const configuration = await loadExtensionConfigFromCache([
            CACHE_CONFIG.OPENAI_KEY.key,
            CACHE_CONFIG.MISTRAL_KEY.key,
            CACHE_CONFIG.AI_PROVIDER.key,
        ]);

        // Handle LLM keys and provider
        const openaiKey = configuration[CACHE_CONFIG.OPENAI_KEY.key];
        const mistralKey = configuration[CACHE_CONFIG.MISTRAL_KEY.key];
        const aiProvider = configuration[CACHE_CONFIG.AI_PROVIDER.key];

        if(openaiKey) {
            store.dispatch(APPLICATION.reduxSlice.actions.updateOpenAIKey({ openaiKey }));
        }
        if(mistralKey) {
            store.dispatch(APPLICATION.reduxSlice.actions.updateMistralKey({ mistralKey }));
        }
        if(aiProvider) {
            store.dispatch(APPLICATION.reduxSlice.actions.updateAiProvider({ aiProvider }));
        }
    };

    openSpecificTab = tabName => {
        //if(isUndefinedOrNull(this.connector)) return;

        window.setTimeout(() => {
            if (this.template.querySelector('slds-tabset')) {
                this.template.querySelector('slds-tabset').activeTabValue = tabName;
            }
        }, 100);
    };

    handleSearchRecordExplorer = value => {
        if (this.refs.recordexplorer) {
            this.refs.recordexplorer.updateFilter(value);
        }
    };
}
