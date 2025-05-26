import { wire, api } from 'lwc';
import ToolkitElement from 'core/toolkitElement';
import {
    isEmpty,
    isNotUndefinedOrNull,
    isUndefinedOrNull,
    runActionAfterTimeOut,
    SETUP_LINKS,
    redirectToUrlViaChrome,
    getRecordId,
} from 'shared/utils';
import { connectStore, store,APPLICATION } from 'core/store';
import { TYPE } from 'overlay/utils';
import { directConnect, credentialStrategies } from 'connection/utils';

import moment from 'moment';
import jsforce from 'imported/jsforce';
import * as localForage from 'localforage';

const CACHE_KEY = 'sf_cached_data';
const CACHE_FILTER_SETTINGS = 'sf_cached_filter_settings';
const CACHE_TAB_SETTINGS = 'sf_cached_tab';
const CACHE_EXPIRY_KEY = 'sf_cache_expiry';
const CACHE_LAST_KEY = 'sf_cached_date';
const CACHE_DURATION = 1000 * 60 * 60 * 24; // 24 hours
const PAGE_LIST_SIZE = 70;

const TABS = {
    SEARCH: 'Search',
    QUICKLINK: 'Quick Links',
    USER: 'Users',
};

export default class Overlay extends ToolkitElement {
    @api isProxyDisabled = false;

    recordId;
    isConnectorLoaded = false;
    isLoading = false;
    hasRendered = false;
    isFetchingMetadata = false;
    cachedData;
    viewerTab = 'Search'; // 'QuickLinks'

    // current Info
    currentDomain;

    // Filtering
    searchResults = [];
    searchValue;
    // Scrolling
    pageNumber = 1;

    lastRefreshDate;
    lastRefreshDateFormatted;
    _forceRefresh = false;

    // Counter buffer
    _headerInterval;

    // custom filter
    filter_display = false;
    filter_value = [];

    _isOverlayDisplayed = false;
    _cancelBlur = false;
    set isOverlayDisplayed(value) {
        this._isOverlayDisplayed = value;
        if (this._isOverlayDisplayed) {
            this.refs.container.focus();
        }
    }
    get isOverlayDisplayed() {
        return this._isOverlayDisplayed;
    }

    @wire(connectStore, { store })
    applicationChange({ application }) {
        //('application',application,this.connector);
        if (
            isNotUndefinedOrNull(application.connector) &&
            isNotUndefinedOrNull(this.connector) &&
            application.connector?.conn?.accessToken != this.connector.connector?.conn?.accessToken
        ) {
            //console.log('Connected');
            this.isConnectorLoaded = true;
            this.init();
        }
    }

    connectedCallback() {
        window.jsforce = jsforce;
        window.defaultStore = window.defaultStore || localForage.createInstance({ name: 'defaultStore' });
        this.getSessionId();
        //this.checkRecordId();
        this.header_enableAutoDate();
        // Default filter options
        this.filter_setValue();
        this.viewerTab_setValue();
        //this.stopListening = this.onUrlChange(this.checkUrl);
    }

    disconnectedCallback() {
        clearInterval(this._headerInterval);
        //this.onUrlChange();
        this.refs.container.removeEventListener('focusout', this.listenToContainerFocus);
    }

    renderedCallback() {
        if (!this.hasRendered) {
            this.refs.container.addEventListener('focusout', this.listenToContainerFocus);
        }
        this.hasRendered = true;
    }

    /** Events **/

    handleSelectTab = e => {
        this.viewerTab = e.target.value;
        window.defaultStore.setItem(CACHE_TAB_SETTINGS, this.viewerTab);
        //this.manualSearch();
    };

    selectAll_handleClick = e => {
        this.filter_value = this.filter_options.map(x => x.value);
        this.filter_searchAfterChange();
    };

    unselectAll_handleClick = e => {
        this.filter_value = [];
        this.filter_searchAfterChange();
    };

    filter_handleVisibilityToggle = e => {
        this.filter_display = !this.filter_display;
    };

    filter_handleClose = e => {
        e.preventDefault();
        this._cancelBlur = true;
        this.filter_display = false;
    };

    filter_handleChange = e => {
        this.filter_value = e.detail.value;
        this.filter_searchAfterChange();
    };

    handleSearch = e => {
        runActionAfterTimeOut(
            e.detail.value,
            async value => {
                this.searchValue = value;
                this.searchResults = await this.search(value);
                this.pageNumber = 1;
            },
            1000
        );
    };

    handleOpenToolkit = e => {
        const application = e.currentTarget.dataset.application;
        const settings = {
            sessionId: this.connector.conn.accessToken,
            serverUrl: this.connector.conn.instanceUrl,
            baseUrl: chrome.runtime.getURL('/views/app.html'),
        };
        if (application) {
            const params = new URLSearchParams({
                applicationName: application,
            });
            settings.redirectUrl = encodeURIComponent(params.toString());
        }
        redirectToUrlViaChrome(settings);
    };

    handleOpenSideBar = async e => {
        await chrome.runtime.sendMessage({ action: 'open_side_panel', content: null });
    };

    @api
    toggleOverlay = e => {
        e.preventDefault();
        this.isOverlayDisplayed = !this.isOverlayDisplayed;
    };

    @api
    show = () => {
        this.isOverlayDisplayed = true;
    };

    @api
    hide = () => {
        this.isOverlayDisplayed = false;
    };

    handleRefresh = () => {
        this._forceRefresh = true;
        this.init();
    };

    /*onUrlChange = (callback) => {
        let currentUrl = window.location.href;
    
        const checkUrl = () => {
            if (currentUrl !== window.location.href) {
                currentUrl = window.location.href;
                callback(currentUrl);
            }
        };

        window.navigation.addEventListener("navigate",checkUrl)
        // Return a cleanup function to remove the event listeners
        return () => {
            window.navigation.removeEventListener('navigate', checkUrl);
        };
    }*/

    /** Methods **/

    /*
    checkUrl = (newUrl) => {
        runActionAfterTimeOut(newUrl,async (newUrlValue) => {
            console.log('newUrlValue',newUrlValue);
            this.checkRecordId();
        },{timeout:500});
    }

    checkRecordId = async () => {
        this.recordId = await getRecordId(window.location);
    }*/

    viewerTab_setValue = async () => {
        this.viewerTab = (await window.defaultStore.getItem(CACHE_TAB_SETTINGS)) || TABS.QUICKLINK;
    };

    filter_searchAfterChange = () => {
        window.defaultStore.setItem(CACHE_FILTER_SETTINGS, this.filter_value);
        this.manualSearch();
    };

    scrollToTop = () => {
        window.setTimeout(() => {
            if (this.template.querySelector('.scroll-container-header')) {
                this.template
                    .querySelector('.scroll-container-header')
                    .scrollTo({ top: 0, behavior: 'auto' });
            }
        }, 100);
    };

    listenToContainerFocus = event => {
        if (
            this._cancelBlur ||
            (this.refs.container.contains(event.relatedTarget) && this.isOverlayDisplayed)
        ) {
            // keep the focus, don't exit but reset the cancelBlur
            if (this._cancelBlur) {
                this._cancelBlur = false;
                this.refs.container.focus();
            }
            return;
        } else {
            this.isOverlayDisplayed = false;
        }
    };

    filter_setValue = async () => {
        const cachedData = await window.defaultStore.getItem(CACHE_FILTER_SETTINGS);
        if (cachedData) {
            this.filter_value = cachedData;
        } else {
            this.filter_value = this.filter_options.map(x => x.value);
        }
    };

    header_enableAutoDate = () => {
        this.header_formatDate();
        this._headerInterval = setInterval(() => {
            this.header_formatDate();
        }, 30000);
    };

    header_formatDate = () => {
        const _lastDate = this.lastRefreshDate ? parseInt(this.lastRefreshDate) : new Date();
        this.lastRefreshDateFormatted = _lastDate ? moment(_lastDate).fromNow() : null;
    };

    getSessionId = async () => {
        /** To be modified before deploying **/
        let cookieInfo;
        if (chrome.runtime) {
            cookieInfo = await chrome.runtime.sendMessage({ action: 'fetchCookie', content: null });
        } else {
            // Only for testing, replace it when testing with a sessionId
            cookieInfo = {
                session:
                    '00DHr0000074EN7!ARYAQCGAQu93mkYW9TORwVuqSqLUWIgAH7cm5u6PrmFb9j77jVBFEsT7QJv1SjAmTu4YUYZ_.ZZfpaPN7.eeJEvVa03pl2vF',
                domain: 'storm-454b5500dfa9a9.my.salesforce.com',
            };
        }

        // Use as key for storage
        this.currentDomain = cookieInfo.domain;
        // Direct Connection (refactored)
        const params = {
            sessionId: cookieInfo.session,
            serverUrl: cookieInfo.domain,
            extra: {
                isProxyDisabled: false,
                isAliasMatchingDisabled: true,
                isEnrichDisabled: true,
            },
        };
        try{
            let connector = await credentialStrategies.SESSION.connect(params);
            store.dispatch(APPLICATION.reduxSlice.actions.login({ connector }));
        } catch (e) {
            console.error(e);
        }
    };

    manualSearch = async () => {
        this.searchResults = await this.search(this.searchValue);
    };

    init = () => {
        this.isLoading = true;
        this.loadCachedData()
            .then(async data => {
                this.isLoading = false;
                this.cachedData = data;
                this.manualSearch();

                // For testing
                //this.searchResults = await this.search('test');
            })
            .catch(e => {
                console.error(e);
                this.isLoading = false;
                this.cachedData = {};
                // to display the default data !
                this.manualSearch();
            });
    };

    checkCategory(category) {
        return this.filter_value.includes(category);
    }

    search = async searchTerm => {
        this.scrollToTop();

        searchTerm = (searchTerm || '').trim();
        this.isFetchingMetadata = true;
        const lowerCaseTerm = (searchTerm || '').toLowerCase();
        // Initialize combined results array
        let combinedResults = [];

        // Filter Users
        try {
            if (!isEmpty(lowerCaseTerm) && this.checkCategory(TYPE.USER)) {
                const escapedTerm = searchTerm.replace(/'/g, "\\'"); // Escape single quotes
                const query = `SELECT Id, Name, Username,Email,Profile.Name,IsActive FROM User WHERE Name LIKE '%${escapedTerm}%' OR Username LIKE '%${escapedTerm}%' LIMIT 50`;
                const result = await this.connector.conn.query(query);
                //console.log('result',result);
                combinedResults.push(
                    ...result.records.map(x => ({
                        id: x.Id,
                        type: TYPE.USER,
                        name: x.Name,
                        email: x.Email,
                        profile: x.Profile.Name,
                        username: x.Username,
                        isActive: x.IsActive,
                        relevance: calculateRelevance(x.Name, searchTerm),
                    }))
                );
            }
        } catch (error) {
            console.error('Error searching users:', error);
        }

        // Setup Links
        if (true) {
            // this.viewerTab === TABS.QUICKLINK
            combinedResults.push(
                ...SETUP_LINKS.setupLinks
                    .filter(
                        x =>
                            x.label.toLowerCase().includes(lowerCaseTerm) ||
                            isUndefinedOrNull(searchTerm)
                    )
                    .map((x, index) => ({
                        id: `${index}-${x.label}`,
                        type: TYPE.LINK,
                        name: x.label,
                        label: x.label,
                        link: x.link,
                        section: x.section,
                        prod: x.prod,
                        relevance: calculateRelevance(x.label, searchTerm),
                    }))
            );
        }

        // Filter cached data for Objects, Profiles, PermissionSets, etc
        if (this.cachedData?.objects && this.checkCategory(TYPE.OBJECT)) {
            combinedResults.push(
                ...this.cachedData.objects
                    .filter(
                        x =>
                            x.label.toLowerCase().includes(lowerCaseTerm) ||
                            x.name.toLowerCase().includes(lowerCaseTerm) ||
                            isUndefinedOrNull(searchTerm)
                    )
                    .map(x => ({
                        id: x.Id,
                        type: TYPE.OBJECT,
                        name: x.name,
                        label: x.label,
                        keyPrefix: x.keyPrefix,
                        isCustomSetting: x.isCustomSetting,
                        durableId: x.durableId,
                        extra: x,
                        relevance: calculateRelevance(x.label, searchTerm),
                    }))
            );
        }

        if (this.cachedData?.profiles && this.checkCategory(TYPE.PROFILE)) {
            combinedResults.push(
                ...this.cachedData.profiles
                    .filter(
                        x =>
                            x.Name.toLowerCase().includes(lowerCaseTerm) ||
                            (x.Label || '').toLowerCase().includes(lowerCaseTerm) ||
                            isUndefinedOrNull(searchTerm)
                    )
                    .map(x => ({
                        id: x.Id,
                        type: TYPE.PROFILE,
                        name: x.Name,
                        label: x.Label,
                        //extra: profile,
                        relevance: calculateRelevance(x.Name, searchTerm),
                    }))
            );
        }

        if (this.cachedData?.permissionSets && this.checkCategory(TYPE.PERMISSION_SET)) {
            combinedResults.push(
                ...this.cachedData.permissionSets
                    .filter(
                        x =>
                            x.Name.toLowerCase().includes(lowerCaseTerm) ||
                            (x.Label || '').toLowerCase().includes(lowerCaseTerm) ||
                            isUndefinedOrNull(searchTerm)
                    )
                    .map(x => ({
                        id: x.Id,
                        type: TYPE.PERMISSION_SET,
                        name: x.Name,
                        label: x.Label,
                        //extra: permSet,
                        relevance: calculateRelevance(x.Name, searchTerm),
                    }))
            );
        }

        if (this.cachedData?.apexClass && this.checkCategory(TYPE.APEX_CLASS)) {
            combinedResults.push(
                ...this.cachedData.apexClass
                    .filter(
                        x =>
                            x.Name.toLowerCase().includes(lowerCaseTerm) ||
                            isUndefinedOrNull(searchTerm)
                    )
                    .map(x => ({
                        id: x.Id,
                        type: TYPE.APEX_CLASS,
                        name: x.Name,
                        label: x.Name,
                        apiVersion: x.ApiVersion,
                        //extra: permSet,
                        relevance: calculateRelevance(x.Name, searchTerm),
                    }))
            );
        }

        if (this.cachedData?.apexTrigger && this.checkCategory(TYPE.APEX_TRIGGER)) {
            combinedResults.push(
                ...this.cachedData.apexTrigger
                    .filter(
                        x =>
                            x.Name.toLowerCase().includes(lowerCaseTerm) ||
                            isUndefinedOrNull(searchTerm)
                    )
                    .map(x => ({
                        id: x.Id,
                        type: TYPE.APEX_TRIGGER,
                        name: x.Name,
                        label: x.Name,
                        apiVersion: x.ApiVersion,
                        //extra: permSet,
                        relevance: calculateRelevance(x.Name, searchTerm),
                    }))
            );
        }

        if (this.cachedData?.aura && this.checkCategory(TYPE.AURA)) {
            combinedResults.push(
                ...this.cachedData.aura
                    .filter(
                        x =>
                            x.DeveloperName.toLowerCase().includes(lowerCaseTerm) ||
                            isUndefinedOrNull(searchTerm)
                    )
                    .map(x => ({
                        id: x.Id,
                        type: TYPE.AURA,
                        name: x.DeveloperName,
                        label: x.MasterLabel || x.DeveloperName,
                        apiVersion: x.ApiVersion,
                        activeVersionId: x.ActiveVersionId,
                        latestVersionId: x.LatestVersionId,
                        relevance: calculateRelevance(x.DeveloperName, searchTerm),
                    }))
            );
        }

        if (this.cachedData?.lwc && this.checkCategory(TYPE.LWC)) {
            combinedResults.push(
                ...this.cachedData.lwc
                    .filter(
                        x =>
                            x.DeveloperName.toLowerCase().includes(lowerCaseTerm) ||
                            isUndefinedOrNull(searchTerm)
                    )
                    .map(x => ({
                        id: x.Id,
                        type: TYPE.LWC,
                        name: x.DeveloperName,
                        label: x.MasterLabel || x.DeveloperName,
                        apiVersion: x.ApiVersion,
                        activeVersionId: x.ActiveVersionId,
                        latestVersionId: x.LatestVersionId,
                        relevance: calculateRelevance(x.DeveloperName, searchTerm),
                    }))
            );
        }

        if (this.cachedData?.flows && this.checkCategory(TYPE.FLOW)) {
            combinedResults.push(
                ...this.cachedData.flows
                    .filter(
                        x =>
                            x.DeveloperName.toLowerCase().includes(lowerCaseTerm) ||
                            isUndefinedOrNull(searchTerm)
                    )
                    .map(x => ({
                        id: x.Id,
                        type: TYPE.FLOW,
                        name: x.DeveloperName,
                        label: x.MasterLabel || x.DeveloperName,
                        apiVersion: x.ApiVersion,
                        activeVersionId: x.ActiveVersionId,
                        latestVersionId: x.LatestVersionId,
                        relevance: calculateRelevance(x.DeveloperName, searchTerm),
                    }))
            );
        }

        // Sort combined results by relevance
        combinedResults.sort((a, b) => b.relevance - a.relevance);

        function calculateRelevance(itemName, searchTerm) {
            const nameLower = itemName.toLowerCase();
            const termLower = (searchTerm || '').toLowerCase();

            const index = nameLower.indexOf(termLower);

            if (index === -1) {
                return -1; // Search term not found in item name
            } else {
                return 100 - index; // Higher score for earlier position
            }
        }
        this.isFetchingMetadata = false;
        return combinedResults;
    };

    loadCachedData = async () => {
        const cachedData = await window.defaultStore.getItem(`${CACHE_KEY}-${this.currentDomain}`);
        const cacheExpiry = await window.defaultStore.getItem(
            `${CACHE_EXPIRY_KEY}-${this.currentDomain}`
        );
        this.lastRefreshDate = await window.defaultStore.getItem(
            `${CACHE_LAST_KEY}-${this.currentDomain}`
        );
        this.header_formatDate(); // direct reformating of the dates
        if (
            !this._forceRefresh &&
            cachedData &&
            cacheExpiry &&
            Date.now() < parseInt(cacheExpiry)
        ) {
            return JSON.parse(cachedData);
        }
        this._forceRefresh = false; // Reset
        try {
            // Fetch Objects
            const globalDescribe = await this.connector.conn.describeGlobal();
            const objects = globalDescribe.sobjects.map(x => ({
                label: x.label,
                name: x.name,
                keyPrefix: x.keyPrefix,
                isCustomSetting: x.isCustomSetting,
                durableId: x.durableId,
            }));

            // Fetch Apex Classes
            const apexClassQuery = this.connector.conn.query(
                'SELECT Id,Name,NamespacePrefix,Status,ApiVersion FROM ApexClass WHERE NamespacePrefix = null'
            );
            const apexClass =
                (await apexClassQuery.run({
                    responseTarget: 'Records',
                    autoFetch: true,
                    maxFetch: 100000,
                })) || [];

            // Fetch Apex Trigger
            const apexTriggerQuery = this.connector.conn.query(
                'SELECT Id,Name,NamespacePrefix,Status,ApiVersion FROM ApexTrigger WHERE NamespacePrefix = null'
            );
            const apexTrigger =
                (await apexTriggerQuery.run({
                    responseTarget: 'Records',
                    autoFetch: true,
                    maxFetch: 100000,
                })) || [];

            // Fetch Aura
            const auraQuery = this.connector.conn.query(
                'SELECT Id,DeveloperName,NamespacePrefix,ApiVersion,MasterLabel FROM AuraDefinitionBundle WHERE NamespacePrefix = null'
            );
            const aura =
                (await auraQuery.run({
                    responseTarget: 'Records',
                    autoFetch: true,
                    maxFetch: 100000,
                })) || [];

            // Fetch LWC
            const lwcQuery = this.connector.conn.tooling.query(
                'SELECT Id,DeveloperName,NamespacePrefix,ApiVersion,MasterLabel FROM LightningComponentBundle WHERE NamespacePrefix = null'
            );
            const lwc =
                (await lwcQuery.run({
                    responseTarget: 'Records',
                    autoFetch: true,
                    maxFetch: 100000,
                })) || [];

            // Fetch Profiles
            const profilesResult = await this.connector.conn.query('SELECT Id, Name FROM Profile');
            const profiles = profilesResult.records;

            // Fetch PermissionSets
            const permSetsResult = await this.connector.conn.query(
                'SELECT Id, Name FROM PermissionSet'
            );
            const permissionSets = permSetsResult.records;

            // Fetch Flow
            const flowQuery = this.connector.conn.tooling.query(
                'SELECT Id, ActiveVersionId,LatestVersionId, Description, MasterLabel, DeveloperName, NamespacePrefix FROM FlowDefinition WHERE NamespacePrefix = null'
            );
            const flows =
                (await flowQuery.run({
                    responseTarget: 'Records',
                    autoFetch: true,
                    maxFetch: 100000,
                })) || [];
            const data = {
                objects,
                profiles,
                permissionSets,
                apexClass,
                apexTrigger,
                flows,
                aura,
                lwc,
            };

            // Cache data with an expiry timestamp
            window.defaultStore.setItem(`${CACHE_KEY}-${this.currentDomain}`, JSON.stringify(data));
            window.defaultStore.setItem(
                `${CACHE_EXPIRY_KEY}-${this.currentDomain}`,
                (Date.now() + CACHE_DURATION).toString()
            );
            window.defaultStore.setItem(
                `${CACHE_LAST_KEY}-${this.currentDomain}`,
                Date.now().toString()
            );
            this.header_formatDate();
            return data;
        } catch (error) {
            console.error('Error loading data:', error);
            throw error;
        }
    };

    handleScroll(event) {
        const target = event.target;
        const scrollDiff = Math.abs(target.clientHeight - (target.scrollHeight - target.scrollTop));
        const isScrolledToBottom = scrollDiff < 5; //5px of buffer
        if (isScrolledToBottom) {
            // Fetch more data when user scrolls to the bottom
            this.pageNumber++;
        }
    }

    /** Getters **/

    get searchButtonClass() {
        return isUndefinedOrNull(this.recordId) ? 'slds-button-last' : '';
    }

    get editButtonClass() {
        return isNotUndefinedOrNull(this.recordId) ? 'slds-button-last' : 'slds-hide';
    }

    get tab_searchLabel() {
        return `Search (${this.formattedResults.filter(x => x.type !== TYPE.LINK).length})`;
    }

    get tab_quickLinkLabel() {
        return `Quick Links (${this.formattedResults.filter(x => x.type === TYPE.LINK).length})`;
    }

    get tab_userLabel() {
        return `Users (${this.formattedResults.filter(x => x.type === TYPE.USER).length})`;
    }

    get sldsPopupContainerClass() {
        return `slds-popup-container ${
            this.isFooterDisplayed ? '' : 'slds-popup-container-no-footer'
        }`;
    }

    get sldsButtonGroupClass() {
        return `sf-toolkit slds-toolkit-button-group ${
            this.isOverlayDisplayed ? 'slds-is-active' : ''
        }`;
    }

    get virtualList() {
        // Best UX Improvement !!!!
        const _filteredList = this.formattedResults.filter(
            x =>
                (this.viewerTab === TABS.SEARCH && x.type !== TYPE.LINK) ||
                (this.viewerTab === TABS.QUICKLINK && x.type === TYPE.LINK) ||
                (this.viewerTab === TABS.USER && x.type === TYPE.USER)
        );
        return _filteredList.slice(0, this.pageNumber * PAGE_LIST_SIZE);
    }

    get formattedResults() {
        return this.searchResults.map((x, index) => ({
            ...x,
            id: x.id || index,
        }));
    }
    get filter_variant() {
        return this.filter_value.length !== this.filter_options.length ? 'brand' : 'border-filled';
    }

    get filter_options() {
        return [
            { label: 'Apex Class', value: TYPE.APEX_CLASS },
            { label: 'Apex Trigger', value: TYPE.APEX_TRIGGER },
            { label: 'Aura', value: TYPE.AURA },
            { label: 'Flow', value: TYPE.FLOW },
            { label: 'LWC', value: TYPE.LWC },
            { label: 'Object', value: TYPE.OBJECT },
            { label: 'Profile', value: TYPE.PROFILE },
            { label: 'PermissionSet', value: TYPE.PERMISSION_SET },
            { label: 'User', value: TYPE.USER },
        ];
    }

    get hasItems() {
        return this.virtualList.length > 0;
    }

    get hasNoItems() {
        return !this.hasItems;
    }

    get isFooterDisplayed() {
        return this.isConnectorLoaded;
    }

    get isSearchResultDisplayed() {
        return this.formattedResults.length > 0;
    }

    get FORMATTED_TABS() {
        return TABS;
    }

    get isUserTabDisplayed() {
        return this.filter_value.includes(TYPE.USER);
    }
}
