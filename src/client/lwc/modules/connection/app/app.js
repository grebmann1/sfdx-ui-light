import { api, track } from 'lwc';
import Toast from 'lightning/toast';
import ToolkitElement from 'core/toolkitElement';
import ConnectionNewModal from 'connection/connectionNewModal';
import ConnectionDetailModal from 'connection/connectionDetailModal';
import ConnectionRenameModal from 'connection/connectionRenameModal';
import ConnectionImportModal from 'connection/connectionImportModal';
import ConnectionManualModal from 'connection/connectionManualModal';
import {
    download,
    classSet,
    runActionAfterTimeOut,
    checkIfPresent,
    isEmpty,
    isUndefinedOrNull,
    isNotUndefinedOrNull,
    isElectronApp,
    isChromeExtension,
    normalizeString as normalize,
    groupBy,
} from 'shared/utils';
import {
    getConfigurations,
    setConfigurations,
    removeConfiguration,
    getConfiguration,
    getCurrentTab,
    credentialStrategies,
    notificationService,
    OAUTH_TYPES,
    Connector,
} from 'connection/utils';
import { store, APPLICATION } from 'core/store';
import LOGGER from 'shared/logger';

const { showToast, handleError } = notificationService;
const ACTIONS = [
    { label: 'Connect', name: 'login' },
    { label: 'Browser', name: 'openBrowser' },
    { label: 'Export', name: 'export' },
    { label: 'See Details', name: 'seeDetails' },
    { label: 'Edit', name: 'setAlias' },
    { label: 'Remove', name: 'removeConfiguration' },
];

export default class App extends ToolkitElement {
    @api variant = 'table';
    @api isHeaderLess = false;
    @track data = [];
    @track formattedData = [];
    isLoading = false;
    customLoadingMessage;

    // Injection
    isInjected = false;
    loadFromExtension = false;
    @track injectedConnections = [];

    // Search
    filter;

    async connectedCallback() {
        await this.fetchAllConnections();
        this.checkForInjected();
        window.setTimeout(() => {
            //this.addConnectionClick();
        }, 10);
    }

    /** Actions */
    checkForInjected = async () => {
        let el = document.getElementsByClassName('injected-connections');
        if (el) {
            let content = el[0]?.textContent;
            if (isEmpty(content)) return;
            this.isInjected = true;
            try {
                //let content = (content || "{'connections':[]}").trim();
                this.injectedConnections = JSON.parse(content)?.connections || [];
                this.loadFromExtension =
                    (await window.defaultStore.getItem('connection-extension-toggle')) === true;
                if (this.loadFromExtension) {
                    this.fetchInjectedConnections();
                }
            } catch (e) {
                console.error('Issue while injecting', e);
            }
        }
    };

    @api
    applyFilter = value => {
        this.filter = value;
    };

    @api
    addConnectionClick = () => {
        this.addNewOrg({ connections: this.data });
    };

    @api
    directConnectClick = () => {
        console.log('directConnectClick');
    };

    @api
    manualSessionClick = () => {
        ConnectionManualModal.open({
            size: 'medium',
        }).then(res => {
            if (res) {
                console.log('res',res);
                if(isElectronApp()){
                    window.electron.ipcRenderer.invoke('OPEN_INSTANCE', {alias:res.conn.alias,username:res.configuration.username});
                }else{
                    store.dispatch(APPLICATION.reduxSlice.actions.login({ connector: res }));
                    this.dispatchEvent(
                        new CustomEvent('login', { detail: { value: res }, bubbles: true })
                    );
                }
                
            }
        });
    };

    handleRowAction = event => {
        //console.log('event.detail',event.detail);
        const actionName = event.detail.action.name;
        const { row, redirect } = event.detail;
        switch (actionName) {
            case 'login': // Used for login & logout (in UI)
                if (row._connectAction === 'logout') {
                    store.dispatch(APPLICATION.reduxSlice.actions.logout());
                } else if (row._hasError && row.credentialType !== OAUTH_TYPES.USERNAME) {
                    LOGGER.debug('authorizeExistingOrg');
                    this.authorizeExistingOrg(row);
                } else {
                    this.login(row);
                }
                break;
            case 'openBrowser':
                this.openBrowser(row, '_blank');
                break;
            case 'incognito':
                this.openBrowser(row, 'incognito');
                break;
            case 'openToolkit':
                this.openToolkit(row, redirect);
                break;
            case 'seeDetails':
                this.seeDetails(row);
                break;
            case 'removeConfiguration':
                this.removeConfiguration(row);
                break;
            case 'setAlias':
                this.setAlias(row);
                break;
            case 'export':
                this.exportRow(row);
                break;
            default:
        }
    };

    handleLoadFromExtensionChange = async e => {
        // e.detail.checked;
        this.loadFromExtension = e.detail.checked;
        await window.defaultStore.setItem('connection-extension-toggle', this.loadFromExtension);
        if (this.loadFromExtension) {
            this.fetchInjectedConnections();
        }
    };

    /** Methods */

    /* forceAuthorization = row => {
        const selectedDomain = row.loginUrl.startsWith(LOGIN_URL)
            ? LOGIN_URL
            : row.loginUrl.startsWith(TEST_URL)
              ? TEST_URL
              : CUSTOM_URL;
        const authorizeParams = {
            selectedDomain,
            customDomain: selectedDomain === CUSTOM_URL ? row.loginUrl : null,
            alias: row.alias,
        };
        this.authorizeExistingOrg(authorizeParams);
    }; */

    @api
    fetchAllConnections = async () => {
        // Browser & Electron version
        this.isLoading = true;
        this.customLoadingMessage = 'Loading Credentials from Cache';
        const configurations = await getConfigurations();
        console.log('configurations', configurations);
        this.data = this.formatConfigurations(configurations);
        console.log('getConfigurations', this.data);
        this.formattedData = this.formatDataForCardView();
        this.isLoading = false;
        this.customLoadingMessage = null;
    };

    formatConfigurations = data => {
        const _username = this.connector?.configuration?.username;
        return data.map(x => {
            const isMatch = x.username && x.username === _username && !x._hasError;
            const isUsernameType = x.credentialType === OAUTH_TYPES.USERNAME;
            return {
                ...x,
                id: x.id || x.alias,
                _connectLabel: isMatch
                    ? 'Logout'
                    : x._hasError && !isUsernameType
                      ? 'Authorize'
                      : 'Connect',
                _connectVariant: isMatch ? 'destructive' : x._hasError ? 'brand-outline' : 'brand',
                _connectAction: isMatch
                    ? 'logout'
                    : x._hasError && !isUsernameType
                      ? 'authorize'
                      : 'login',
                _isRedirect: x.credentialType === OAUTH_TYPES.REDIRECT,
            };
        });
    };

    fetchInjectedConnections = async () => {
        this.isLoading = true;
        this.customLoadingMessage = 'Loading Credentials from Extension';
        const newConnections = this.injectedConnections.map(x => {
            return {
                ...x,
                _isInjected: true,
            };
        });
        await setConfigurations(JSON.parse(JSON.stringify(newConnections)));

        /** Fetch Again **/
        this.fetchAllConnections();
        this.isLoading = false;
        this.customLoadingMessage = null;
    };

    formatDataForCardView = () => {
        let grouped = groupBy(this.data, 'company');
        return Object.keys(grouped).map(key => ({
            key: key,
            title: key,
            items: grouped[key],
        }));
    };

    login = async row => {
        if (isElectronApp() && row.credentialType === OAUTH_TYPES.OAUTH) {
            await window.electron.ipcRenderer.invoke('OPEN_INSTANCE', row);
        } else {
            let configuration = this.data.find(x => x.id == row.id);
            let { alias, credentialType, ...settings } = configuration;
            store.dispatch(
                APPLICATION.reduxSlice.actions.startLoading({ message: `Connecting to ${alias}` })
            );
            try {
                const strategy = credentialStrategies[credentialType || 'OAUTH'];
                if (!strategy)
                    throw new Error(`No strategy for credential type: ${credentialType}`);

                console.log('Connecting with configuration', configuration);
                const connector = await strategy.connect(configuration);
                if(isElectronApp() && row.credentialType === OAUTH_TYPES.USERNAME){
                    const params = {
                        alias: row.alias,
                        username: row.username,
                        sessionId: connector.conn.accessToken,
                        serverUrl: connector.conn.instanceUrl,
                    };
                    LOGGER.log('login - electron - params', params);
                    store.dispatch(APPLICATION.reduxSlice.actions.stopLoading());
                    await window.electron.ipcRenderer.invoke('OPEN_INSTANCE', params);
                    return;
                }
                if (!connector.hasError) {
                    store.dispatch(APPLICATION.reduxSlice.actions.login({ connector }));
                    this.dispatchEvent(
                        new CustomEvent('login', { detail: { value: connector }, bubbles: true })
                    );
                } else {
                    store.dispatch(APPLICATION.reduxSlice.actions.stopLoading());
                    this.fetchAllConnections();
                    showToast({
                        label: `OAuth Issue | Check your settings [re-authorize the org]`,
                        variant: 'error',
                        mode: 'dismissible',
                    });
                }
            } catch (e) {
                console.error('login error', e);
                handleError(e, 'Login Error');
                store.dispatch(APPLICATION.reduxSlice.actions.stopLoading());
                this.fetchAllConnections();
            }
        }
    };

    authorizeExistingOrg = async row => {
        if (isElectronApp()) return;
        
        this.isLoading = true;
        let { alias, loginUrl, ...settings } = this.data.find(x => x.id == row.id);
        const connector = await credentialStrategies[OAUTH_TYPES.OAUTH].connect(
            { alias, loginUrl },
            { saveFullConfiguration: true, bypass: true }
        );
        if (connector.hasError) {
            LOGGER.error('authorizeExistingOrg', connector.errorMessage);
            throw new Error(connector.errorMessage);
        }
        store.dispatch(APPLICATION.reduxSlice.actions.login({ connector }));
        this.dispatchEvent(
            new CustomEvent('login', { detail: { value: connector }, bubbles: true })
        );
        this.fetchAllConnections();
    };

    openBrowser = async (row, target) => {
        //console.log('openBrowser',target);

        if (isElectronApp()) {
            // Electron version
            /* if (row._hasError) {
                this.forceAuthorization(row);
            } else {
                window.electron.ipcRenderer.invoke('org-openOrgUrl', row);
            } */
            window.electron.ipcRenderer.invoke('org-openOrgUrl', row);
        } else {
            this.isLoading = true;
            try {
                const configuration = this.data.find(x => x.id === row.id);
                const { alias, redirectUrl, credentialType } = configuration;
                let url;
                if (isEmpty(redirectUrl)) {
                    const strategy = credentialStrategies[credentialType || 'OAUTH'];
                    if (!strategy)
                        throw new Error(`No strategy for credential type: ${credentialType}`);

                    console.log('Connecting with configuration --> 1', configuration);
                    const connector = await strategy.directConnect(configuration);
                    console.log('connector --> 1', connector);
                    url = connector.frontDoorUrl;
                } else {
                    url = redirectUrl;
                }

                //console.log('isChromeExtension',isChromeExtension(),target);
                if (isChromeExtension()) {
                    if (target === 'incognito') {
                        const windows = await chrome.windows.getAll({
                            populate: false,
                            windowTypes: ['normal'],
                        });
                        for (let w of windows) {
                            if (w.incognito) {
                                // Use this window.
                                const tab = await chrome.tabs.create({ url: url, windowId: w.id });
                                await this.createOrAddToTabGroup(tab, alias, w.id);
                                return;
                            }
                        }
                        // No incognito window found, open a new one.
                        chrome.windows.create({ url: url, incognito: true });
                    } else {
                        const current = await chrome.windows.getCurrent();
                        const tab = await chrome.tabs.create({ url: url, windowId: current.id });
                        await this.createOrAddToTabGroup(tab, alias, current.id);
                    }
                } else {
                    window.open(url, target);
                }
            } catch (e) {
                LOGGER.error(e);
                this.fetchAllConnections();
                Toast.show({
                    label: `OAuth Issue | Check your settings [re-authorize the org]`,
                    variant: 'error',
                    mode: 'dismissible',
                });
            }
            this.isLoading = false;
        }
    };
    /*
    updateRowFromError = (row) => {
        const _newValue = this.formattedData;
        _newValue.forEach((x,index) => {
            const itemIndex = x.items.findIndex( y => y.id === row.id);
            if(itemIndex > -1){
                _newValue[itemIndex]
            }
        })
    }*/

    openToolkit = async (row, redirect) => {
        this.isLoading = true;
        try {
            let url = new URL(
                isChromeExtension()
                    ? chrome.runtime.getURL('/views/app.html')
                    : 'https://sf-toolkit.com/extension'
            );

            const { alias, credentialType, ...settings } = this.data.find(x => x.id == row.id);
            const strategy = credentialStrategies[credentialType || 'OAUTH'];
            if (!strategy) throw new Error(`No strategy for credential type: ${credentialType}`);
            const connector = await strategy.connect({ ...settings, alias, disableEvent: true });

            // Build URL
            let params = new URLSearchParams();
            params.append('sessionId', connector.conn.accessToken);
            params.append('serverUrl', connector.conn.instanceUrl);
            if (redirect) {
                params.append('redirectUrl', encodeURIComponent(redirect));
            }
            // Add params
            url.search = params.toString();
            window.open(url.href, '_blank');
        } catch (e) {
            this.fetchAllConnections();
            Toast.show({
                label: `${e.name} | ${e.message}`,
                variant: 'error',
                mode: 'dismissible',
            });
        }
        this.isLoading = false;
    };

    exportRow = async row => {
        const { alias, sfdxAuthUrl } = row;
        const exportedRow = [
            {
                alias,
                sfdxAuthUrl,
            },
        ];

        //navigator.clipboard.writeText(JSON.stringify(exportedRow, null, 4));
        download(JSON.stringify(exportedRow), 'application/json', `${alias}_sftoolkit_config.json`);
        Toast.show({
            label: `${alias} has been exported.`,
            //message: 'Exported to your clipboard', // Message is hidden in small screen
            variant: 'success',
        });
    };

    addNewOrg = param => {
        ConnectionNewModal.open({
            ...param,
            size: isChromeExtension() ? 'full' : 'medium',
        }).then(async res => {
            if (isNotUndefinedOrNull(res)) {
                //console.log('force refresh');
                await this.fetchAllConnections();
            }
            if (isElectronApp()) {
                await window.electron.ipcRenderer.invoke('org-killOauth');
            }
        });
    };

    seeDetails = async row => {
        var { company, orgId, name, username, instanceUrl, sfdxAuthUrl, redirectUrl } = row;
        const { alias, credentialType, ...settings } = this.data.find(x => x.id == row.id);
        if (isNotUndefinedOrNull(redirectUrl)) {
            // redirect credential
            ConnectionDetailModal.open({
                company,
                name,
                alias,
                redirectUrl,
                size: isChromeExtension() ? 'full' : 'medium',
            });
        } else {
            const strategy = credentialStrategies[credentialType || 'OAUTH'];
            if (!strategy) throw new Error(`No strategy for credential type: ${credentialType}`);
            const connector = await strategy.connect({ ...settings, alias, disableEvent: true });
            const accessToken = connector ? connector.conn.accessToken : null;
            const frontDoorUrl = connector ? connector.frontDoorUrl : null;
            if (isElectronApp()) {
                let settings = await getConfiguration(alias);
                sfdxAuthUrl = settings.sfdxAuthUrl || sfdxAuthUrl;
            }
            ConnectionDetailModal.open({
                company,
                orgId,
                name,
                alias,
                username,
                instanceUrl,
                sfdxAuthUrl,
                accessToken,
                frontDoorUrl,
                redirectUrl,
                size: isChromeExtension() ? 'full' : 'medium',
            });
        }
    };

    setAlias = row => {
        ConnectionRenameModal.open({
            oldAlias: row.alias,
            category: row.company,
            orgName: row.name,
            username: row.username,
            isRedirect: !isEmpty(row.redirectUrl),
            redirectUrl: row.redirectUrl,
            connections: this.data,
            size: isChromeExtension() ? 'full' : 'medium',
        }).then(async result => {
            await this.fetchAllConnections();
        });
    };

    removeConfiguration = async row => {
        var confirmed = window.confirm(
            `Are you sure you wish to remove this Connection : ${row.alias}:${row.username} ?`
        );
        if (confirmed) {
            await removeConfiguration(row.alias);
            await this.fetchAllConnections();
        }
    };

    createOrAddToTabGroup = async (tab, groupName, windowId) => {
        const groups = await chrome.tabGroups.query({ windowId: windowId });
        let group = groups.find(g => g.title === groupName);
        if (group) {
            // Group exists, add the tab to this group
            await chrome.tabs.group({ groupId: group.id, tabIds: tab.id });
        } else {
            // Group does not exist, create a new group with this tab
            const newGroupId = await chrome.tabs.group({ createProperties: {}, tabIds: tab.id });
            await chrome.tabGroups.update(newGroupId, { title: groupName });
        }
    };

    handleFieldsFilter = e => {
        runActionAfterTimeOut(e.detail.value, newValue => {
            this.filter = newValue;
            //this.updateFieldsTable();
        });
    };

    formatSpecificField = content => {
        var regex = new RegExp('(' + this.filter + ')', 'gi');
        if (regex.test(content)) {
            return content
                .replace(/<?>?/, '')
                .replace(regex, '<span style="font-weight:Bold; color:blue;">$1</span>');
        } else {
            return content;
        }
    };

    @api
    exportClick = e => {
        download(JSON.stringify(this.exportedData), 'application/json', 'sftoolkit_config.json');
        navigator.clipboard.writeText(JSON.stringify(this.exportedData, null, 4));
        Toast.show({
            label: 'Exported to your clipboard',
            //message: 'Exported to your clipboard', // Message is hidden in small screen
            variant: 'success',
        });
    };

    @api
    importClick = e => {
        ConnectionImportModal.open({
            existingConnections: this.data,
            size: isChromeExtension() ? 'full' : 'small',
        }).then(async res => {
            //console.log('force refresh');
            await this.fetchAllConnections();
        });
    };

    displayCard = () => {
        if (!this.isCardVariant) {
            this.variant = 'card';
        }
    };

    displayTable = () => {
        if (!this.isTableVariant) {
            this.variant = 'table';
        }
    };

    getRowActions(row, doneCallback) {
        let actions = ACTIONS;
        if (row._isRedirect) {
            actions = actions.filter(x => !['login'].includes(x.name));
        }
        // simulate a trip to the server
        setTimeout(() => {
            doneCallback(actions);
        }, 200);
    }

    /** Getters  */

    get isNoRecord() {
        return this.formattedData.length == 0;
    }

    get isSearchDisplayed() {
        return !this.isSearchHidden;
    }

    get exportedData() {
        return this.data
            .filter(x => !isEmpty(x.sfdxAuthUrl))
            .map(x => {
                const { sfdxAuthUrl, alias } = x;
                return {
                    alias,
                    sfdxAuthUrl,
                };
            });
    }

    get filteredFormatted() {
        return this.formattedData.map(group => ({
            ...group,
            items: group.items
                .filter(
                    x =>
                        isUndefinedOrNull(this.filter) ||
                        (isNotUndefinedOrNull(this.filter) &&
                            (checkIfPresent(x.alias, this.filter) ||
                                checkIfPresent(x.username, this.filter)))
                )
                .map(x => ({
                    ...x,
                    _name: this.formatSpecificField(x.name || ''),
                    _username: this.formatSpecificField(x.username || ''),
                })),
        }));
    }

    get filteredOriginal() {
        let filtered = this.data.filter(
            x =>
                isUndefinedOrNull(this.filter) ||
                (isNotUndefinedOrNull(this.filter) &&
                    (checkIfPresent(x.alias, this.filter) ||
                        checkIfPresent(x.username, this.filter)))
        );
        return filtered;
    }

    get normalizedVariant() {
        return normalize(this.variant, {
            fallbackValue: 'table',
            validValues: ['table', 'card'],
        });
    }

    get isTableVariant() {
        return this.normalizedVariant == 'table';
    }

    get isCardVariant() {
        return this.normalizedVariant == 'card';
    }

    get pageClass() {
        return super.pageClass + ' slds-overflow-hidden';
    }

    get headerRowClass() {
        return classSet('slds-page-header__row').toString();
    }

    get detailRowClass() {
        return classSet(
            'slds-page-header__detail-row slds-is-relative min-height-200 slds-row-container'
        ).toString();
    }

    get columns() {
        let _columns = [
            {
                label: 'Category',
                fieldName: 'company',
                type: 'text',
                cellAttributes: {
                    class: 'slds-text-title_bold slds-color-brand  slds-text-title_caps',
                },
            },
            {
                label: 'Name',
                fieldName: 'name',
                type: 'text',
                cellAttributes: {
                    class: { fieldName: '_typeClass' },
                },
            },
            {
                label: 'Alias',
                fieldName: 'alias',
                type: 'text',
                cellAttributes: {
                    class: { fieldName: '_typeClass' },
                },
            },
            {
                label: 'Type',
                fieldName: '_type',
                type: 'text',
                _filter: 'electron',
                cellAttributes: {
                    class: { fieldName: '_typeClass' },
                },
            },
            {
                label: 'Status',
                fieldName: '_status',
                type: 'text',
                initialWidth: 120,
                cellAttributes: {
                    class: { fieldName: '_statusClass' },
                },
            },/* 
            {
                label: 'Expire',
                fieldName: 'expirationDate',
                type: 'text',
                initialWidth: 100,
                _filter: 'electron',
            },
            {
                label: 'API',
                fieldName: 'instanceApiVersion',
                type: 'text',
                initialWidth: 70,
                _filter: 'electron',
            }, */
            {
                label: 'User Name',
                fieldName: 'username',
                type: 'text',
                initialWidth: 400,
                cellAttributes: {
                    class: { fieldName: '_typeClass' },
                },
            },
            {
                label: 'Connect',
                type: 'button',
                initialWidth: 120,
                typeAttributes: {
                    name: 'login',
                    label: { fieldName: '_connectLabel' },
                    title: { fieldName: '_connectLabel' },
                    variant: { fieldName: '_connectVariant' },
                    disabled: { fieldName: '_isRedirect' },
                },
                cellAttributes: {
                    class: { fieldName: '_typeClass' },
                },
            },
            {
                type: 'action',
                typeAttributes: { rowActions: this.getRowActions },
            },
        ];

        if (isElectronApp()) {
            return _columns.filter(x => x._filter == null || x._filter === 'electron');
        } else {
            return _columns.filter(x => x._filter == null || x._filter === 'web');
        }
    }

    get loadingMessage() {
        return this.customLoadingMessage || 'Authorizing & Redirecting';
    }
}
