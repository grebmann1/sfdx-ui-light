import { LightningElement, api, track, wire } from 'lwc';
import Toast from 'lightning/toast';
import ToolkitElement from 'core/toolkitElement';
import { isUndefinedOrNull, isNotUndefinedOrNull, isEmpty, guid, classSet, ASSISTANT as ASSISTANT_UTILS } from 'shared/utils';
import { getConfigurations, credentialStrategies } from 'connection/utils';
import { store, connectStore, EINSTEIN, APPLICATION, SELECTORS } from 'core/store';

export default class App extends ToolkitElement {
    isLoading = false;
    _hasRendered = false;

    @api isMobile = false;

    // Tabs
    @track dialogs = [];
    currentDialogId;

    // Salesforce Instance
    @track salesforceIntance_connections = [];
    salesforceInstance_alias;
    salesforceInstance_connector;

    @track provider = EINSTEIN.PROVIDER_OPTIONS[0].value;
    @track providerOptions = EINSTEIN.PROVIDER_OPTIONS;

    @track model = EINSTEIN.MODEL_OPTIONS[0].value;
    @track modelOptions = EINSTEIN.MODEL_OPTIONS;

    handleModelChange = e => {
        this.model = e.detail.value;
        store.dispatch(
            EINSTEIN.reduxSlice.actions.updateModel({
                model: this.model,
                alias: ASSISTANT_UTILS.GLOBAL_EINSTEIN,
            })
        );
    };

    get isApexProvider() {
        return this.provider === 'apex';
    }

    handleProviderChange = e => {
        this.provider = e.detail.value;
        store.dispatch(
            EINSTEIN.reduxSlice.actions.updateProvider({
                provider: this.provider,
                alias: ASSISTANT_UTILS.GLOBAL_EINSTEIN,
            })
        );
    };

    async connectedCallback() {
        //this.isLoading = true;
        await this.fetchAllConnections();
        this.setDefaultEinsteinConnection();
        store.dispatch(async (dispatch, getState) => {
            dispatch(
                EINSTEIN.reduxSlice.actions.loadCacheSettings({
                    alias: ASSISTANT_UTILS.GLOBAL_EINSTEIN,
                })
            );
            // We init the connection only if it's not setup !

            //dispatch(EINSTEIN.reduxSlice.actions.initTabs());
        });
    }

    renderedCallback() {
        this._hasRendered = true;

        if (this._hasRendered && this.template.querySelector('slds-tabset')) {
            this.template.querySelector('slds-tabset').activeTabValue = this.currentDialogId;
        }
    }

    fetchAllConnections = async () => {
        // Browser & Electron version
        this.salesforceIntance_connections = await getConfigurations();
    };

    @wire(connectStore, { store })
    storeChange({ einstein, application }) {
        //console.log('application.currentApplication',application.currentApplication,this.applicationName);
        const isCurrentApp = this.verifyIsActive(application.currentApplication);
        if (!isCurrentApp) return;
        //console.log('einstein',einstein);
        //const entities = SELECTORS.einstein.selectAll({einstein});
        //console.log('entities',entities);
        //this.tabs = einstein.tabs;
        //console.log('einstein',einstein)
        this.dialogs = SELECTORS.einstein.selectAll({ einstein });
        this.currentDialogId = einstein.currentDialogId;
        
        if (einstein.provider && this.provider !== einstein.provider) {
            this.provider = einstein.provider;
        }

        if (einstein.model && this.model !== einstein.model) {
            this.model = einstein.model;
        }

        if (isUndefinedOrNull(this.currentDialogId) && this.dialogs.length > 0) {
            this.currentDialogId = this.dialogs[0].id;
        }
        if (
            isNotUndefinedOrNull(einstein.connectionAlias) &&
            this.salesforceInstance_alias != einstein.connectionAlias &&
            this.isApexProvider
        ) {
            // Only reconnect if the connction is different
            if (this.salesforceInstance_alias !== einstein.connectionAlias) {
                this.salesforceInstance_alias = einstein.connectionAlias;
                this.salesforceInstance_connect(einstein.connectionAlias);
            } else {
                this.setDefaultEinsteinConnection();
            }
        }
        
    }

    /** Events **/

    handleAddTab = e => {
        store.dispatch(
            EINSTEIN.reduxSlice.actions.addTab({
                tab: {
                    id: guid(),
                    body: '',
                },
            })
        );
    };

    handleSelectTab = e => {
        const tabId = e.target.value;
        store.dispatch(
            EINSTEIN.reduxSlice.actions.selectionTab({
                id: tabId,
                alias: ASSISTANT_UTILS.GLOBAL_EINSTEIN,
            })
        );
    };

    handleCloseTab = async e => {
        const tabId = e.detail.value;
        store.dispatch(
            EINSTEIN.reduxSlice.actions.removeTab({
                id: tabId,
                alias: ASSISTANT_UTILS.GLOBAL_EINSTEIN,
            })
        );
    };

    salesforceInstance_handleChange = e => {
        this.salesforceInstance_connect(e.detail.value);
    };

    /** Methods **/

    salesforceInstance_connect = alias => {
        //console.log('salesforceInstance_connect');
        if (isEmpty(alias)) return;
        this.connectToOrg(alias);
        store.dispatch(
            EINSTEIN.reduxSlice.actions.updateConnectionAlias({
                connectionAlias: alias, // Used for the connection
                alias: ASSISTANT_UTILS.GLOBAL_EINSTEIN, // Used for the local storage
            })
        );
    };

    // This method is call in case there is no existing default connector
    setDefaultEinsteinConnection = () => {
        this.salesforceInstance_alias = this.alias; // using another one to bypass the alias
        this.salesforceInstance_connector = this.connector;
    };

    connectToOrg = async alias => {
        // Check if sharing the same connection (If yes, exist)
        await this.fetchAllConnections();
        let settings = this.salesforceIntance_connections.find(
            x => x.alias === alias || x.username === alias
        );
        if (
            isNotUndefinedOrNull(settings?.username) &&
            settings?.username == this.connector?.configuration?.username
        )
            return;
        //console.log('connectToOrg',alias,settings?.username,this.connector?.configuration?.username,this.salesforceIntance_connections);

        store.dispatch(
            APPLICATION.reduxSlice.actions.startLoading({
                message: `Connecting Einstein to ${alias}`,
            })
        );
        try {
            const strategy = credentialStrategies[settings.credentialType || 'OAUTH'];
            if (!strategy)
                throw new Error(`No strategy for credential type: ${settings.credentialType}`);
            let _newConnection = await strategy.connect({ ...settings, alias, disableEvent: true });
            this.salesforceInstance_connector = null;
            this.salesforceInstance_connector = _newConnection;
            store.dispatch(APPLICATION.reduxSlice.actions.stopLoading());
            if (!this.salesforceInstance_connector) {
                Toast.show({
                    label: `OAuth Issue | Check your settings [re-authorize the org]`,
                    variant: 'error',
                    mode: 'dismissible',
                });
            }
        } catch (e) {
            store.dispatch(APPLICATION.reduxSlice.actions.stopLoading());
        }
    };

    /** Getters **/

    get salesforceInstance_options() {
        // use the username to smooth the process instead of relying on the alias
        return this.salesforceIntance_connections
            .filter(x => !x._isRedirect)
            .map(x => ({ value: x.alias, label: x.alias }));
    }

    get pageClass() {
        //Overwrite
        return `${super.pageClass} ${this.isMobile ? '' : ' slds-p-around_small'}`;
    }

    get formattedTabs() {
        return this.dialogs.map((x, index) => {
            return {
                ...x,
                key: x.id || String(index), // Facing some issues with Id being null. To investigate
                name: `Dialog ${index + 1}`,
                isCloseable: this.dialogs.length > 1,
                class: classSet('slds-tabs_scoped__item').toString(),
            };
        });
    }

    get picklistClass() {
        return this.isMobile ? 'slds-max-150' : '';
    }
}
