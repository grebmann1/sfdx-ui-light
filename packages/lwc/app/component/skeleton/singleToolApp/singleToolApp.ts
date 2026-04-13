import { api, LightningElement, track, wire } from 'lwc';
import { NavigationContext, CurrentPageReference } from 'lwr/navigation';
import LOGGER from 'shared/logger';

import { APP_LIST } from 'core/applications';
import { store, APPLICATION } from 'core/store';

import { loadFullMode, loadLimitedMode } from '../app/session';
import {
    buildPageRefForPath,
    DEFAULT_TOOL_PATH,
    getRequestedPathFromPage,
    resolveSingleToolConfig,
} from './singleToolAppHelpers';

const LIMITED_MODE = 'limited';

export default class SingleToolApp extends LightningElement {
    @wire(NavigationContext)
    navContext;

    @api alias;
    @api applicationName = DEFAULT_TOOL_PATH;
    @api mode = 'full';
    @api redirectUrl;
    @api serverUrl;
    @api sessionId;

    pageHasLoaded = false;
    targetPage;
    @track currentTool = null;
    @track noticeMessage = '';

    @wire(CurrentPageReference)
    handleNavigation(pageRef) {
        this.targetPage = pageRef;
        if (!this.pageHasLoaded) {
            return;
        }
        this.loadRequestedTool(pageRef);
    }

    connectedCallback() {
        void this.init();
    }

    async init() {
        window.isLimitedMode = this.isLimitedMode;
        const defaultPage = this.defaultTargetPage;
        try {
            if (this.isLimitedMode) {
                await loadLimitedMode({
                    alias: this.alias,
                    handleNavigation: this.handleNavigation.bind(this),
                    navContext: this.navContext,
                    redirectUrl: this.redirectUrl,
                    serverUrl: this.serverUrl,
                    sessionId: this.sessionId,
                    targetPage: defaultPage,
                });
            } else {
                await loadFullMode({
                    handleNavigation: this.handleNavigation.bind(this),
                    loadModule: () => undefined,
                    navContext: this.navContext,
                    redirectUrl: this.redirectUrl,
                    serverUrl: this.serverUrl,
                    sessionId: this.sessionId,
                    targetPage: defaultPage,
                });
            }
        } catch (error) {
            LOGGER.error('single-tool-app init error', error);
        }
        this.pageHasLoaded = true;
        this.loadRequestedTool(defaultPage);
    }

    loadRequestedTool(pageRef) {
        const requestedPath = getRequestedPathFromPage(pageRef);
        let config = resolveSingleToolConfig(requestedPath, APP_LIST);
        if (!config) {
            this.noticeMessage = `Tool "${requestedPath}" is unavailable in this single-tool page. Falling back to API Explorer.`;
            config = resolveSingleToolConfig(DEFAULT_TOOL_PATH, APP_LIST);
        } else {
            this.noticeMessage = '';
        }
        if (!config) {
            this.currentTool = null;
            return;
        }

        this.currentTool = {
            attributes: {
                applicationName: config.name,
                isActive: true,
            },
            constructor: config.module,
            name: config.name,
            requireConnection: !config.isOfflineAvailable,
        };

        store.dispatch(
            APPLICATION.reduxSlice.actions.updateCurrentApplication({
                application: config.name,
            })
        );
    }

    get defaultTargetPage() {
        if (this.targetPage?.type === 'application') {
            const fromRoute = String(this.targetPage?.state?.applicationName || '').trim();
            if (fromRoute) {
                return this.targetPage;
            }
        }
        return buildPageRefForPath(this.applicationName);
    }

    get hasTool() {
        return Boolean(this.currentTool?.constructor);
    }

    get isLimitedMode() {
        return this.mode === LIMITED_MODE;
    }
}
