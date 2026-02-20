import { wire, api } from 'lwc';
import ToolkitElement from 'core/toolkitElement';
import Toast from 'lightning/toast';
import {
    isEmpty,
    classSet,
    isNotUndefinedOrNull,
    isUndefinedOrNull,
    runActionAfterTimeOut,
    SETUP_LINKS,
    redirectToUrlViaChrome,
    getRecordId,
} from 'shared/utils';
import { connectStore, store, APPLICATION } from 'core/store';
import { TYPE } from 'overlay/utils';
import { credentialStrategies } from 'connection/utils';

import moment from 'moment';
import jsforce from 'imported/jsforce';
import * as localForage from 'localforage';

const CACHE_KEY = 'sf_cached_data';
const CACHE_FILTER_SETTINGS = 'sf_cached_filter_settings';
const CACHE_TAB_SETTINGS = 'sf_cached_tab';
const CACHE_EXPIRY_KEY = 'sf_cache_expiry';
const CACHE_LAST_KEY = 'sf_cached_date';
const CACHE_DURATION = 1000 * 60 * 60 * 24; // 24 hours
const ORG_CACHE_KEY = 'sf_org_info';
const ORG_CACHE_EXPIRY_KEY = 'sf_org_info_expiry';
const ORG_CACHE_LAST_KEY = 'sf_org_info_date';
const ORG_CACHE_DURATION = 1000 * 60 * 60; // 1 hour
const RECENT_OBJECTS_KEY = 'sf_recent_objects';
const RECENTLY_VIEWED_KEY = 'sf_recently_viewed_objects';
const RECENTLY_VIEWED_EXPIRY_KEY = 'sf_recently_viewed_objects_expiry';
const RECENTLY_VIEWED_DURATION = 1000 * 60 * 5; // 5 minutes
const OBJECT_FILTER_KEY = 'sf_object_filter';
const PAGE_LIST_SIZE = 70;

const OBJECT_FILTER = {
    RECENT: 'Recent',
    ALL: 'All',
    STANDARD: 'Standard',
    CUSTOM: 'Custom',
};

const TABS = {
    ORGANIZATION: 'Organization',
    QUICKLINK: 'Quick Links',
    OBJECT: 'Object',
    USER: 'Users',
    DEV: 'Dev Tools',
};

export default class Overlay extends ToolkitElement {
    @api isProxyDisabled = false;

    recordId;
    isConnectorLoaded = false;
    isLoading = false;
    overlayErrorMessage = null;
    overlayErrorDetails = null;
    hasRendered = false;
    hasFocused = false;
    isFetchingMetadata = false;
    isFetchingUsers = false;
    cachedData;
    viewerTab = 'Organization';
    userBrowseResults = [];

    // current Info
    currentDomain;
    isDeveloperServer = false;

    // Filtering
    searchResults = [];
    searchValue;
    // Scrolling
    pageNumber = 1;

    lastRefreshDate;
    lastRefreshDateFormatted;
    _forceRefresh = false;
    _forceOrgRefresh = false;

    // Organization info (Organization tab)
    orgInfo;
    orgUser;
    orgRefreshDate;
    orgRefreshDateFormatted;
    isFetchingOrgInfo = false;

    // Object tab filtering
    objectFilter = OBJECT_FILTER.ALL;
    recentObjects = [];
    recentlyViewedObjects = [];
    isFetchingRecentlyViewed = false;

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
            //this.refs.container.focus();
            this.refs.header?.focusSearchInput();
        } else {
            this.hasFocused = false;
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
            this.clearOverlayError();
            this.isConnectorLoaded = true;
            this.init();
        }
    }

    _setOverlayError = ({ message, details } = {}) => {
        const safeMessage =
            typeof message === 'string' && message.trim().length > 0
                ? message.trim()
                : 'Overlay initialization failed';

        let safeDetails = null;
        if (typeof details === 'string' && details.trim().length > 0) {
            safeDetails = details.trim();
        } else if (details && typeof details === 'object') {
            const msg = details?.message;
            safeDetails = typeof msg === 'string' && msg.trim().length > 0 ? msg.trim() : null;
        }

        this.overlayErrorMessage = safeMessage;
        this.overlayErrorDetails = safeDetails;
    };

    clearOverlayError = () => {
        this.overlayErrorMessage = null;
        this.overlayErrorDetails = null;
    };

    connectedCallback() {
        const lf = localForage?.default || localForage;
        try {
            // eslint-disable-next-line no-console
            console.log('[SF-TOOLKIT][Overlay] connectedCallback', {
                hasLocalForage: !!lf,
                hasCreateInstance: typeof lf?.createInstance === 'function',
            });
        } catch (e) {}
        window.jsforce = jsforce;
        window.defaultStore = window.defaultStore || lf.createInstance({ name: 'defaultStore' });
        this.getSessionId();
        //this.checkRecordId();
        this.header_enableAutoDate();
        // Default filter options
        this.filter_setValue();
        this.viewerTab_setValue();
        this.objectFilter_setValue();
        this.recentObjects_setValue();
        this.recentlyViewedObjects_setValue();
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
        // Autofocus search input when overlay is displayed
        if (
            this.isOverlayDisplayed &&
            this.refs.header &&
            this.refs.header.focusSearchInput &&
            !this.hasFocused
        ) {
            this.refs.header.focusSearchInput();
            this.hasFocused = true;
        }
        this.hasRendered = true;
    }

    /** Events **/

    handleSelectTab = e => {
        this.viewerTab = e.target.value;
        window.defaultStore.setItem(CACHE_TAB_SETTINGS, this.viewerTab);
        this.pageNumber = 1;
        this.scrollToTop();
        // Load a default list for Users tab when no search is provided
        void this.ensureUsersLoaded();
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
        this._forceOrgRefresh = true;
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
        const cached = (await window.defaultStore.getItem(CACHE_TAB_SETTINGS)) || TABS.ORGANIZATION;
        this.viewerTab = Object.values(TABS).includes(cached) ? cached : TABS.QUICKLINK;
    };

    objectFilter_setValue = async () => {
        try {
            const cached =
                (await window.defaultStore.getItem(`${OBJECT_FILTER_KEY}-${this.currentDomain}`)) ||
                OBJECT_FILTER.ALL;
            this.objectFilter = Object.values(OBJECT_FILTER).includes(cached)
                ? cached
                : OBJECT_FILTER.ALL;
        } catch (e) {
            this.objectFilter = OBJECT_FILTER.ALL;
        }
    };

    recentObjects_setValue = async () => {
        try {
            const cached = await window.defaultStore.getItem(
                `${RECENT_OBJECTS_KEY}-${this.currentDomain}`
            );
            const parsed = cached ? JSON.parse(cached) : [];
            this.recentObjects = Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            this.recentObjects = [];
        }
    };

    recentlyViewedObjects_setValue = async () => {
        try {
            const cached = await window.defaultStore.getItem(
                `${RECENTLY_VIEWED_KEY}-${this.currentDomain}`
            );
            const expiry = await window.defaultStore.getItem(
                `${RECENTLY_VIEWED_EXPIRY_KEY}-${this.currentDomain}`
            );
            if (cached && expiry && Date.now() < parseInt(expiry)) {
                const parsed = JSON.parse(cached);
                this.recentlyViewedObjects = Array.isArray(parsed) ? parsed : [];
            }
        } catch (e) {
            this.recentlyViewedObjects = [];
        }
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
                //this.refs.container.focus();
                this.refs.header?.focusSearchInput();
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

        const _orgDate = this.orgRefreshDate ? parseInt(this.orgRefreshDate) : null;
        this.orgRefreshDateFormatted = _orgDate ? moment(_orgDate).fromNow() : null;
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

        if (!cookieInfo || this.isBlankValue(cookieInfo.session) || this.isBlankValue(cookieInfo.domain)) {
            this._setOverlayError({
                message: 'Overlay injection failed (no Salesforce session found)',
                details: 'Could not read the SID cookie for this tab (or the tab is not a Salesforce page).',
            });
            return;
        }

        // Use as key for storage
        this.currentDomain = cookieInfo.domain;
        this.isDeveloperServer = !!(cookieInfo && cookieInfo.isDeveloperServer);
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
        try {
            let connector = await credentialStrategies.SESSION.connect(params);
            this.clearOverlayError();
            store.dispatch(APPLICATION.reduxSlice.actions.login({ connector }));
        } catch (e) {
            this._setOverlayError({
                message: 'Overlay injection failed (session connect)',
                details: e?.message || String(e),
            });
            try {
                // eslint-disable-next-line no-console
                console.debug('[SF-TOOLKIT][Overlay] getSessionId connect failed', e?.message || e);
            } catch (_) {}
        }
    };

    manualSearch = async () => {
        this.searchResults = await this.search(this.searchValue);
    };

    init = () => {
        // Clear prior overlay errors when retrying init
        this.clearOverlayError();
        this.isLoading = true;
        Promise.all([this.loadCachedData(), this.loadOrgAndUserInfo()])
            .then(async results => {
                this.isLoading = false;
                this.cachedData = results?.[0] || {};
                this.manualSearch();
                void this.ensureUsersLoaded();
            })
            .catch(e => {
                this._setOverlayError({
                    message: 'Overlay initialization failed',
                    details: e?.message || String(e),
                });
                try {
                    // eslint-disable-next-line no-console
                    console.debug('[SF-TOOLKIT][Overlay] init failed', e?.message || e);
                } catch (_) {}
                this.isLoading = false;
                this.cachedData = {};
                // to display the default data !
                this.manualSearch();
                void this.ensureUsersLoaded();
            });
    };

    ensureUsersLoaded = async () => {
        // Only preload users when Users tab is active and search is empty.
        if (this.viewerTab !== TABS.USER) return;
        if (!this.isBlankValue((this.searchValue || '').trim())) return;
        if (this.isFetchingUsers) return;
        // Avoid refetching if we already have a list (unless user refreshed metadata)
        if (Array.isArray(this.userBrowseResults) && this.userBrowseResults.length > 0) return;
        await this.loadInitialUsers();
    };

    loadInitialUsers = async () => {
        try {
            if (!this.connector?.conn) return;
            this.isFetchingUsers = true;
            const result = await this.connector.conn.query(
                'SELECT Id, Name, Username, Email, Profile.Name, IsActive FROM User ORDER BY Name LIMIT 50'
            );
            const records = result?.records || [];
            this.userBrowseResults = records.map(x => ({
                id: x.Id,
                type: TYPE.USER,
                name: x.Name,
                email: x.Email,
                profile: x.Profile?.Name,
                username: x.Username,
                isActive: x.IsActive,
                relevance: 0,
            }));
        } catch (e) {
            // Non-blocking: Users list is optional
            try {
                // eslint-disable-next-line no-console
                console.debug('[SF-TOOLKIT][Overlay] loadInitialUsers failed', e?.message || e);
            } catch (_) {}
            this.userBrowseResults = [];
        } finally {
            this.isFetchingUsers = false;
        }
    };

    isBlankValue(value) {
        if (isUndefinedOrNull(value)) return true;
        return String(value).trim().length === 0;
    }

    getUserIdFromPageContext() {
        try {
            const direct = window?.UserContext?.userId;
            if (!this.isBlankValue(direct)) return direct;

            const auraUserId =
                typeof window?.$A?.get === 'function'
                    ? window.$A.get('$SObjectType.CurrentUser.Id')
                    : undefined;
            if (!this.isBlankValue(auraUserId)) return auraUserId;
        } catch (e) {
            // ignore
        }
        return undefined;
    }

    getUserIdFromChatterMe = async () => {
        try {
            const version = this.connector?.conn?.version;
            if (this.isBlankValue(version)) return undefined;
            const me = await this.connector.conn.request(
                `/services/data/v${version}/chatter/users/me`
            );
            const id = me?.id;
            if (!this.isBlankValue(id)) return id;
        } catch (e) {
            // ignore
        }
        return undefined;
    };

    loadOrgAndUserInfo = async () => {
        try {
            if (!this.connector?.conn || !window.defaultStore) return;
            const domainKey = this.currentDomain || this.connector?.conn?.instanceUrl || 'unknown';

            this.isFetchingOrgInfo = true;
            const cached = await window.defaultStore.getItem(`${ORG_CACHE_KEY}-${domainKey}`);
            const expiry = await window.defaultStore.getItem(
                `${ORG_CACHE_EXPIRY_KEY}-${domainKey}`
            );
            const last = await window.defaultStore.getItem(`${ORG_CACHE_LAST_KEY}-${domainKey}`);
            if (!this._forceOrgRefresh && cached && expiry && Date.now() < parseInt(expiry)) {
                const parsed = JSON.parse(cached);
                this.orgInfo = parsed?.orgInfo;
                this.orgUser = parsed?.orgUser;
                this.orgRefreshDate = last;
                this.header_formatDate();
                this.isFetchingOrgInfo = false;
                return parsed;
            }

            this._forceOrgRefresh = false;

            // Organization
            const orgResult = await this.connector.conn.query(
                'SELECT Id, Name, IsSandbox, OrganizationType, InstanceName FROM Organization LIMIT 1'
            );
            const orgInfo = orgResult?.records?.[0] || {};

            // Current user
            const userId =
                this.connector?.configuration?.userInfo?.user_id ||
                this.connector?.conn?.userInfo?.id ||
                this.getUserIdFromPageContext() ||
                (await this.getUserIdFromChatterMe());

            let orgUser;
            if (!this.isBlankValue(userId)) {
                const escapedId = String(userId).replace(/'/g, "\\'");
                const userResult = await this.connector.conn.query(
                    `SELECT Id, Username, Email, Name FROM User WHERE Id = '${escapedId}' LIMIT 1`
                );
                orgUser = userResult?.records?.[0];
            }

            this.orgInfo = orgInfo;
            this.orgUser = orgUser;

            const now = Date.now();
            window.defaultStore.setItem(
                `${ORG_CACHE_KEY}-${domainKey}`,
                JSON.stringify({ orgInfo, orgUser })
            );
            window.defaultStore.setItem(
                `${ORG_CACHE_EXPIRY_KEY}-${domainKey}`,
                (now + ORG_CACHE_DURATION).toString()
            );
            window.defaultStore.setItem(`${ORG_CACHE_LAST_KEY}-${domainKey}`, now.toString());
            this.orgRefreshDate = now;
            this.header_formatDate();
            this.isFetchingOrgInfo = false;
            return { orgInfo, orgUser };
        } catch (e) {
            this.isFetchingOrgInfo = false;
            // Non-blocking: Organization tab can show partial info
            try {
                // eslint-disable-next-line no-console
                console.debug('[SF-TOOLKIT][Overlay] loadOrgAndUserInfo failed', e?.message || e);
            } catch (_) {}
            return null;
        }
    };

    handleCopyOrgValue = e => {
        try {
            const { value, label } = e.currentTarget.dataset;
            if (this.isBlankValue(value)) return;
            navigator.clipboard.writeText(value);
            Toast.show({
                label: label || 'Copied to clipboard',
                variant: 'success',
            });
        } catch (err) {
            // ignore
        }
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

        // Dev Server specific links
        if (this.isDeveloperServer) {
            const devLinks = [
                {
                    label: 'Hose My Org (Sir)',
                    link: '/qa/hoseMyOrgPleaseSir.jsp',
                },
                {
                    label: 'Hose My Org',
                    link: '/qa/hoseMyOrgPlease.jsp',
                },
                {
                    label: 'Access Check Explorer',
                    link: '/qa/accessCheckExplorer.jsp',
                },
                {
                    label: 'LWC Dev Preview',
                    link: '/lwr/application/e/devpreview/ai/localdev%2Fpreview',
                },
                {
                    label: 'Curated Experience Framework',
                    link: '/cef/info.apexp',
                },
                {
                    label: 'Release Version',
                    link: '/sfdc/releaseVersion.jsp',
                },
                {
                    label: 'Eager Developer',
                    link: '/qa/eagerDeveloper.jsp',
                },
                {
                    label: 'Sign-up',
                    link: '/qa/signup.jsp',
                },
                {
                    label: 'Oauth2',
                    link: '/qa/initSdxOauth.jsp',
                },
                {
                    label: 'QA',
                    link: '/qa',
                },
                {
                    label: 'Get Label',
                    link: '/qa/getLabel.jsp',
                },
                {
                    label: 'Label Reload',
                    link: '/qa/labelreload.jsp',
                },
                {
                    label: 'View Gack',
                    link: '/qa/gack/viewGacks.jsp',
                },
                {
                    label: 'Scratch Org Features',
                    link: '/qa/scratch/features.jsp',
                },
                {
                    label: 'CDP Setup',
                    link: '/qa/cdp/cdp.jsp',
                },
                {
                    label: 'B2B Search',
                    link: '/qa/b2b/search.jsp',
                },
                {
                    label: 'Make An Org',
                    link: '/qa/makeAnOrg.jsp',
                },
                {
                    label: 'Tagalog Tests',
                    link: '/qa/tagalog/',
                },
                {
                    label: 'Static Asset Console',
                    link: '/qa/staticasset/console.jsp',
                },
                {
                    label: 'FTest Console',
                    link: '/qa/ftests/console.html',
                },
                {
                    label: 'Add File Based Flow',
                    link: '/qa/addFileBasedFlow.jsp',
                },
                {
                    label: 'Edit File Based Flow',
                    link: '/qa/editFileBasedFlows.jsp',
                },
            ];
            combinedResults.push(
                ...devLinks.map((x, index) => ({
                    id: `dev-${index}-${x.label}`,
                    type: TYPE.DEV_LINK,
                    name: x.label,
                    label: x.label,
                    link: x.link,
                    section: 'Dev Tools',
                    relevance: 100, // Always visible on Dev tab
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
                        queryable: x.queryable,
                        createable: x.createable,
                        updateable: x.updateable,
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

        if (this.cachedData?.agentforce && this.checkCategory(TYPE.AGENTFORCE)) {
            combinedResults.push(
                ...this.cachedData.agentforce
                    .filter(
                        x =>
                            x.DeveloperName.toLowerCase().includes(lowerCaseTerm) ||
                            x.MasterLabel.toLowerCase().includes(lowerCaseTerm) ||
                            isUndefinedOrNull(searchTerm)
                    )
                    .map(x => ({
                        id: x.Id,
                        type: TYPE.AGENTFORCE,
                        name: x.DeveloperName,
                        label: x.MasterLabel || x.DeveloperName,
                        //description: x.Description,
                        //apiVersion: x.ApiVersion,
                        //activeVersionId: x.ActiveVersionId,
                        //latestVersionId: x.LatestVersionId,
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
            const parsed = JSON.parse(cachedData);
            const needsUpgrade =
                Array.isArray(parsed?.objects) &&
                parsed.objects.length > 0 &&
                typeof parsed.objects[0]?.queryable === 'undefined';
            if (!needsUpgrade) {
                return parsed;
            }
        }
        this._forceRefresh = false; // Reset
        try {
            const safeLoad = async (label, fn, fallback) => {
                try {
                    return await fn();
                } catch (e) {
                    try {
                        // eslint-disable-next-line no-console
                        console.debug(
                            `[SF-TOOLKIT][Overlay] ${label} metadata unavailable`,
                            e?.message || e
                        );
                    } catch (_) {}
                    return fallback;
                }
            };

            // Fetch Objects
            const globalDescribe = await safeLoad(
                'GlobalDescribe',
                async () => this.connector.conn.describeGlobal(),
                { sobjects: [] }
            );
            const objects = (globalDescribe?.sobjects || []).map(x => ({
                label: x.label,
                name: x.name,
                keyPrefix: x.keyPrefix,
                isCustomSetting: x.isCustomSetting,
                durableId: x.durableId,
                queryable: x.queryable,
                createable: x.createable,
                updateable: x.updateable,
            }));

            // Fetch Apex Classes
            const apexClass = await safeLoad(
                'ApexClass',
                async () => {
                    const apexClassQuery = this.connector.conn.query(
                        'SELECT Id,Name,NamespacePrefix,Status,ApiVersion FROM ApexClass WHERE NamespacePrefix = null'
                    );
                    return (
                        (await apexClassQuery.run({
                            responseTarget: 'Records',
                            autoFetch: true,
                            maxFetch: 100000,
                        })) || []
                    );
                },
                []
            );

            // Fetch Apex Trigger
            const apexTrigger = await safeLoad(
                'ApexTrigger',
                async () => {
                    const apexTriggerQuery = this.connector.conn.query(
                        'SELECT Id,Name,NamespacePrefix,Status,ApiVersion FROM ApexTrigger WHERE NamespacePrefix = null'
                    );
                    return (
                        (await apexTriggerQuery.run({
                            responseTarget: 'Records',
                            autoFetch: true,
                            maxFetch: 100000,
                        })) || []
                    );
                },
                []
            );

            // Fetch Aura
            const aura = await safeLoad(
                'Aura',
                async () => {
                    const auraQuery = this.connector.conn.query(
                        'SELECT Id,DeveloperName,NamespacePrefix,ApiVersion,MasterLabel FROM AuraDefinitionBundle WHERE NamespacePrefix = null'
                    );
                    return (
                        (await auraQuery.run({
                            responseTarget: 'Records',
                            autoFetch: true,
                            maxFetch: 100000,
                        })) || []
                    );
                },
                []
            );

            // Fetch LWC
            const lwc = await safeLoad(
                'LWC',
                async () => {
                    const lwcQuery = this.connector.conn.tooling.query(
                        'SELECT Id,DeveloperName,NamespacePrefix,ApiVersion,MasterLabel FROM LightningComponentBundle WHERE NamespacePrefix = null'
                    );
                    return (
                        (await lwcQuery.run({
                            responseTarget: 'Records',
                            autoFetch: true,
                            maxFetch: 100000,
                        })) || []
                    );
                },
                []
            );

            // Fetch Profiles
            const profiles = await safeLoad(
                'Profiles',
                async () => {
                    const profilesResult = await this.connector.conn.query(
                        'SELECT Id, Name FROM Profile'
                    );
                    return profilesResult?.records || [];
                },
                []
            );

            // Fetch PermissionSets
            const permissionSets = await safeLoad(
                'PermissionSets',
                async () => {
                    const permSetsResult = await this.connector.conn.query(
                        'SELECT Id, Name FROM PermissionSet'
                    );
                    return permSetsResult?.records || [];
                },
                []
            );

            // Fetch Flow
            const flows = await safeLoad(
                'FlowDefinition',
                async () => {
                    const flowQuery = this.connector.conn.tooling.query(
                        'SELECT Id, ActiveVersionId,LatestVersionId, Description, MasterLabel, DeveloperName, NamespacePrefix FROM FlowDefinition WHERE NamespacePrefix = null'
                    );
                    return (
                        (await flowQuery.run({
                            responseTarget: 'Records',
                            autoFetch: true,
                            maxFetch: 100000,
                        })) || []
                    );
                },
                []
            );

            // Fetch Agentforce
            // BotDefinition is not available in all orgs/editions and can raise INVALID_TYPE.
            // Treat as optional to avoid failing the entire overlay metadata load.
            const agentforce = await safeLoad(
                'Agentforce',
                async () => {
                    const agentforceQuery = this.connector.conn.tooling.query(
                        'SELECT Id, DeveloperName, MasterLabel FROM BotDefinition'
                    );
                    return (
                        (await agentforceQuery.run({
                            responseTarget: 'Records',
                            autoFetch: true,
                            maxFetch: 100000,
                        })) || []
                    );
                },
                []
            );
            const data = {
                objects,
                profiles,
                permissionSets,
                apexClass,
                apexTrigger,
                flows,
                aura,
                lwc,
                agentforce,
            };

            const now = Date.now();
            // Cache data with an expiry timestamp
            window.defaultStore.setItem(`${CACHE_KEY}-${this.currentDomain}`, JSON.stringify(data));
            window.defaultStore.setItem(
                `${CACHE_EXPIRY_KEY}-${this.currentDomain}`,
                (now + CACHE_DURATION).toString()
            );
            window.defaultStore.setItem(`${CACHE_LAST_KEY}-${this.currentDomain}`, now.toString());
            this.lastRefreshDate = now;
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

    @api
    get currentOrg() {
        return {
            sessionId: this.connector.conn.accessToken,
            serverUrl: this.connector.conn.instanceUrl,
        };
    }

    get searchButtonClass() {
        return isUndefinedOrNull(this.recordId) ? 'slds-button-last' : '';
    }

    get editButtonClass() {
        return isNotUndefinedOrNull(this.recordId) ? 'slds-button-last' : 'slds-hide';
    }

    get tab_searchLabel() {
        // Legacy (keep getter name to avoid downstream breakage)
        return 'Organization';
    }

    get tab_quickLinkLabel() {
        return `Quick Links (${this.formattedResults.filter(x => x.type === TYPE.LINK && !x._isCustom).length})`;
    }

    get tab_userLabel() {
        const isBlankSearch = this.isBlankValue((this.searchValue || '').trim());
        const count = isBlankSearch
            ? this.userBrowseResults?.length || 0
            : this.formattedResults.filter(x => x.type === TYPE.USER).length;
        return `Users (${count})`;
    }

    get tab_objectLabel() {
        return `Object (${this.formattedResults.filter(x => x.type === TYPE.OBJECT).length})`;
    }

    get tab_devLabel() {
        return `Dev Tools (${this.formattedResults.filter(x => x.type === TYPE.DEV_LINK).length})`;
    }

    get isOrganizationTab() {
        return this.viewerTab === TABS.ORGANIZATION;
    }

    get isQuickLinkTab() {
        return this.viewerTab === TABS.QUICKLINK;
    }

    get isObjectTab() {
        return this.viewerTab === TABS.OBJECT;
    }

    get quickLinkGroups() {
        if (!this.isQuickLinkTab) return [];
        const items = Array.isArray(this.virtualList) ? this.virtualList : [];
        const groups = new Map();

        for (const item of items) {
            const raw = item?.section || 'Other';
            const section = String(raw).trim() || 'Other';
            if (!groups.has(section)) {
                groups.set(section, []);
            }
            groups.get(section).push(item);
        }

        return Array.from(groups.entries()).map(([section, list]) => {
            const sorted = (list || []).slice().sort((a, b) => {
                const la = String(a?.label || a?.name || '');
                const lb = String(b?.label || b?.name || '');
                return la.localeCompare(lb);
            });
            return {
                key: section,
                label: section,
                count: sorted.length,
                items: sorted,
            };
        });
    }

    get objectFilters() {
        const list = [
            { label: 'Recent', value: OBJECT_FILTER.RECENT },
            { label: 'All', value: OBJECT_FILTER.ALL },
            { label: 'Standard', value: OBJECT_FILTER.STANDARD },
            { label: 'Custom', value: OBJECT_FILTER.CUSTOM },
        ];
        return list.map(x => ({
            ...x,
            className: classSet('sf-pill')
                .add({ 'is-active': this.objectFilter === x.value })
                .toString(),
        }));
    }

    get isRecentObjectFilter() {
        return this.objectFilter === OBJECT_FILTER.RECENT;
    }

    get refreshLabel() {
        return this.isOrganizationTab ? 'Org info refreshed' : 'Metadata refreshed';
    }

    get refreshDateFormatted() {
        return this.isOrganizationTab
            ? this.orgRefreshDateFormatted
            : this.lastRefreshDateFormatted;
    }

    get orgRows() {
        const org = this.orgInfo || {};
        const instanceUrl = this.connector?.conn?.instanceUrl || '';
        const sandbox =
            org?.IsSandbox === true ? 'Yes' : org?.IsSandbox === false ? 'No' : undefined;
        return [
            { label: 'Org Name', value: org?.Name || '-' },
            { label: 'Org Id', value: org?.Id || '-', isCopyable: !this.isBlankValue(org?.Id) },
            {
                label: 'Instance URL',
                value: instanceUrl || '-',
                isCopyable: !this.isBlankValue(instanceUrl),
            },
            { label: 'Sandbox', value: sandbox || '-' },
            { label: 'Org Type', value: org?.OrganizationType || '-' },
            { label: 'API Version', value: this.connector?.conn?.version || '-' },
        ];
    }

    get userRows() {
        const user = this.orgUser || {};
        return [
            { label: 'User Name', value: user?.Name || '-' },
            { label: 'User Id', value: user?.Id || '-', isCopyable: !this.isBlankValue(user?.Id) },
            {
                label: 'Username',
                value: user?.Username || '-',
                isCopyable: !this.isBlankValue(user?.Username),
            },
            {
                label: 'Email',
                value: user?.Email || '-',
                isCopyable: !this.isBlankValue(user?.Email),
            },
        ];
    }

    get sldsPopupContainerClass() {
        return classSet('slds-popup-container')
            .add({
                dev: this.isDeveloperServer,
                'slds-popup-container-no-footer': !this.isFooterDisplayed,
            })
            .toString();
    }

    get sldsButtonGroupClass() {
        return classSet('sf-toolkit slds-toolkit-button-group')
            .add({
                'slds-is-active': this.isOverlayDisplayed,
            })
            .toString();
    }

    get virtualList() {
        // Best UX Improvement !!!!
        return this.tabResults.slice(0, this.pageNumber * PAGE_LIST_SIZE);
    }

    get tabResults() {
        const results = this.formattedResults;
        switch (this.viewerTab) {
            case TABS.ORGANIZATION:
                return [];
            case TABS.QUICKLINK:
                return results.filter(x => x.type === TYPE.LINK && !x._isCustom);
            case TABS.OBJECT:
                return this.filterObjectsForTab(results.filter(x => x.type === TYPE.OBJECT));
            case TABS.USER:
                if (this.isBlankValue((this.searchValue || '').trim())) {
                    return Array.isArray(this.userBrowseResults) ? this.userBrowseResults : [];
                }
                return results.filter(x => x.type === TYPE.USER);
            case TABS.DEV:
                return results.filter(x => x.type === TYPE.DEV_LINK);
            default:
                return results;
        }
    }

    isCustomObject(item) {
        const name = item?.name || '';
        const isKnownCustomSuffix = ['__c', '__mdt', '__e', '__b', '__x'].some(s =>
            name.endsWith(s)
        );
        return !!item?.isCustomSetting || isKnownCustomSuffix;
    }

    filterObjectsForTab(list) {
        const objects = Array.isArray(list) ? list : [];
        switch (this.objectFilter) {
            case OBJECT_FILTER.CUSTOM:
                return objects.filter(x => this.isCustomObject(x));
            case OBJECT_FILTER.STANDARD:
                return objects.filter(x => !this.isCustomObject(x));
            case OBJECT_FILTER.RECENT: {
                const recent =
                    Array.isArray(this.recentlyViewedObjects) && this.recentlyViewedObjects.length
                        ? this.recentlyViewedObjects
                        : Array.isArray(this.recentObjects)
                          ? this.recentObjects
                          : [];
                const idx = new Map(recent.map((n, i) => [String(n), i]));
                return objects
                    .filter(x => idx.has(x.name))
                    .sort((a, b) => idx.get(a.name) - idx.get(b.name));
            }
            case OBJECT_FILTER.ALL:
            default:
                return objects;
        }
    }

    get currentTabCountLabel() {
        const count = this.tabResults.length;
        switch (this.viewerTab) {
            case TABS.ORGANIZATION:
                return '';
            case TABS.OBJECT:
                return `${count} objects`;
            case TABS.QUICKLINK:
                return `${count} quick links`;
            case TABS.USER:
                return `${count} users`;
            case TABS.DEV:
                return `${count} dev links`;
            default:
                return `${count} results`;
        }
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
            { label: 'Agentforce', value: TYPE.AGENTFORCE },
        ];
    }

    get hasItems() {
        return this.virtualList.length > 0;
    }

    get hasNoItems() {
        return !this.hasItems;
    }

    get isFetchingList() {
        return this.isFetchingMetadata || (this.viewerTab === TABS.USER && this.isFetchingUsers);
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

    get isObjectTabDisplayed() {
        return this.filter_value.includes(TYPE.OBJECT);
    }

    get isDevTabDisplayed() {
        return this.isDeveloperServer;
    }

    /** Object tab events **/

    handleObjectFilterClick = async e => {
        const value = e.currentTarget?.dataset?.value;
        if (!Object.values(OBJECT_FILTER).includes(value)) return;
        this.objectFilter = value;
        this.pageNumber = 1;
        this.scrollToTop();
        try {
            await window.defaultStore.setItem(`${OBJECT_FILTER_KEY}-${this.currentDomain}`, value);
        } catch (err) {
            // ignore
        }
        if (value === OBJECT_FILTER.RECENT) {
            void this.loadRecentlyViewedObjects();
        }
    };

    handleOpenObjectManagerSetup = e => {
        e.preventDefault();
        window.open('/lightning/setup/ObjectManager/home', '_blank', 'noopener');
    };

    handleRecentObject = async e => {
        try {
            const name = e?.detail?.name;
            if (this.isBlankValue(name)) return;
            const next = [name, ...(this.recentObjects || []).filter(x => x !== name)].slice(0, 20);
            this.recentObjects = next;
            await window.defaultStore.setItem(
                `${RECENT_OBJECTS_KEY}-${this.currentDomain}`,
                JSON.stringify(next)
            );
        } catch (err) {
            // ignore
        }
    };

    loadRecentlyViewedObjects = async () => {
        try {
            if (!this.connector?.conn || !window.defaultStore) return [];
            if (this.isFetchingRecentlyViewed) return this.recentlyViewedObjects;
            this.isFetchingRecentlyViewed = true;

            const cached = await window.defaultStore.getItem(
                `${RECENTLY_VIEWED_KEY}-${this.currentDomain}`
            );
            const expiry = await window.defaultStore.getItem(
                `${RECENTLY_VIEWED_EXPIRY_KEY}-${this.currentDomain}`
            );
            if (cached && expiry && Date.now() < parseInt(expiry)) {
                const parsed = JSON.parse(cached);
                this.recentlyViewedObjects = Array.isArray(parsed) ? parsed : [];
                this.isFetchingRecentlyViewed = false;
                return this.recentlyViewedObjects;
            }

            // Recently viewed records in Salesforce (we extract distinct sObject types)
            const result = await this.connector.conn.query(
                'SELECT Type, LastViewedDate FROM RecentlyViewed WHERE Type != null ORDER BY LastViewedDate DESC LIMIT 200'
            );
            const types = [];
            const seen = new Set();
            (result?.records || []).forEach(r => {
                const t = r?.Type;
                if (!t || seen.has(t)) return;
                seen.add(t);
                types.push(t);
            });

            this.recentlyViewedObjects = types;
            const now = Date.now();
            await window.defaultStore.setItem(
                `${RECENTLY_VIEWED_KEY}-${this.currentDomain}`,
                JSON.stringify(types)
            );
            await window.defaultStore.setItem(
                `${RECENTLY_VIEWED_EXPIRY_KEY}-${this.currentDomain}`,
                (now + RECENTLY_VIEWED_DURATION).toString()
            );
            this.isFetchingRecentlyViewed = false;
            return types;
        } catch (e) {
            this.isFetchingRecentlyViewed = false;
            // Non-blocking: keep fallback local recent list
            return this.recentlyViewedObjects;
        }
    };
}
