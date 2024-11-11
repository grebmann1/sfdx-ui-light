import {api, LightningElement, wire} from "lwc";
import {store as deprecatedStore} from 'shared/store';
import {isNotUndefinedOrNull,CACHE_CONFIG, loadExtensionConfigFromCache} from "shared/utils";
import {APPLICATION, connectStore, store} from 'core/store';


const APPLICATIONS = {
    CONNECTION: 'connection',
    DOCUMENTATION: 'documentation',
    ASSISTANT: 'assistant'
};


export default class Default extends LightningElement {

    @api isBackButtonDisplayed = false;
    openaiKey;
    openaiAssistantId;

    _currentApplication = APPLICATIONS.CONNECTION;//APPLICATIONS.ASSISTANT;//

    @api
    get currentApplication() {
        return this._currentApplication;
    }

    set currentApplication(value) {
        this._currentApplication = value;
        store.dispatch(APPLICATION.reduxSlice.actions.updateCurrentApplication({
            application: value
        }));
    }

    /** Getters **/

    get connectionVariant() {
        return this.isConnection ? 'brand' : 'standard';
    }

    get assistantVariant() {
        return this.isAssistant ? 'brand' : 'standard';
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

    get isAssistantDisplayed() {
        return true;//isNotUndefinedOrNull(this.openaiAssistantId) && isNotUndefinedOrNull(this.openaiKey);
    }

    @wire(connectStore, {store: deprecatedStore})
    applicationChange({application}) {
        //console.log('application',application)
        if (application?.type === 'FAKE_NAVIGATE') {
            const pageRef = application.target;
            this.loadFromNavigation(pageRef);
        }
        //console.log('application in default',application)
    }

    connectedCallback() {
        this.loadAssistantConfig();
    }

    /** Events **/

    einsteinClick = () => {
        this.currentApplication = APPLICATIONS.ASSISTANT;
    };

    openConnectionClick = () => {
        this.currentApplication = APPLICATIONS.CONNECTION;
    };

    documentationClick = (e) => {
        this.currentApplication = APPLICATIONS.DOCUMENTATION;
    };

    handleBackClick = () => {
        this.dispatchEvent(new CustomEvent("back", {bubbles: true, composed: true}));
    };

    handleSearch = (e) => {
        const {value} = e.detail;
        if (this.isConnection && isNotUndefinedOrNull(value)) {
            this.handleSearchConnection(value);
        } else if (this.isDocumentation && isNotUndefinedOrNull(value)) {
            this.handleSearchDocumentation(value);
        }
    };

    exportClick = (e) => {
        if (this.refs.connection) {
            this.refs.connection.exportClick();
        }
    };

    importClick = (e) => {
        if (this.refs.connection) {
            this.refs.connection.importClick();
        }
    };

    /** Methods **/

    loadAssistantConfig = async () => {
        const configuration = await loadExtensionConfigFromCache([
            CACHE_CONFIG.OPENAI_KEY,
            CACHE_CONFIG.OPENAI_ASSISTANT_ID
        ]);
        this.openaiKey = configuration[CACHE_CONFIG.OPENAI_KEY];
        this.openaiAssistantId = configuration[CACHE_CONFIG.OPENAI_ASSISTANT_ID];
    };

    loadFromNavigation = async ({state}) => {
        //('documentation - loadFromNavigation');
        const {applicationName, attribute1} = state;
        //console.log('applicationName',applicationName);
        if (applicationName == 'documentation') {
            this.currentApplication = APPLICATIONS.DOCUMENTATION;
        } else if (applicationName == 'home') {
            this.currentApplication = APPLICATIONS.CONNECTION;
        }

    };

    handleSearchConnection = (value) => {
        if (this.refs.connection) {
            this.refs.connection.applyFilter(value);
        }
    };

    handleSearchDocumentation = (value) => {
        if (this.refs.documentation) {
            this.refs.documentation.externalSearch(value);
        }
    };

    @api
    connection_refresh = () => {
        if (this.refs.connection) {
            this.refs.connection.fetchAllConnections();
        }
    }

}