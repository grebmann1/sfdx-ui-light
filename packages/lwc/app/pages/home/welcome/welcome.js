import { wire } from 'lwc';
import ToolkitElement from 'core/toolkitElement';
import { NavigationContext, navigate } from 'lwr/navigation';
import { isChromeExtension } from 'shared/utils';
import { listOrgSessionsViaBackground } from 'core/connector';
import { loadLlmProviderConfigMapFromCache } from 'shared/cacheManager';
import { GITHUB_DISCUSSIONS_URL, QUICK_TIPS, AI_DOC_URL } from './constants.js';

export default class Welcome extends ToolkitElement {
    @wire(NavigationContext)
    navContext;

    sessions = [];
    isLoadingSessions = true;

    latestRelease = null;
    tips = QUICK_TIPS;

    isAiConfigured = true; // default true to avoid flashing the setup card

    async connectedCallback() {
        await Promise.all([
            this._loadSessions(),
            this._loadLatestRelease(),
            this._checkAiConfiguration(),
        ]);
    }

    async _loadSessions() {
        this.isLoadingSessions = true;
        try {
            const result = await listOrgSessionsViaBackground();
            this.sessions = Array.isArray(result) ? result : [];
        } catch {
            this.sessions = [];
        } finally {
            this.isLoadingSessions = false;
        }
    }

    async _loadLatestRelease() {
        try {
            const url = isChromeExtension()
                ? `${chrome.runtime.getURL('releaseNotes.json')}`
                : '/public/releaseNotes.json';
            const res = await fetch(url);
            if (!res.ok) return;
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
                this.latestRelease = data[0];
            }
        } catch {
            // Non-blocking.
        }
    }

    async _checkAiConfiguration() {
        try {
            const configMap = await loadLlmProviderConfigMapFromCache();
            this.isAiConfigured = Object.values(configMap).some(c => c?.apiKey);
        } catch {
            this.isAiConfigured = true; // assume configured on error to avoid nagging
        }
    }

    /** Getters */

    get hasSessions() {
        return this.sessions.length > 0;
    }

    get hasLatestRelease() {
        return this.latestRelease != null;
    }

    get latestReleaseLabel() {
        if (!this.latestRelease) return '';
        return `v${this.latestRelease.version} — ${this.latestRelease.date}`;
    }

    get latestReleaseSummary() {
        if (!this.latestRelease?.sections?.length) return '';
        const first = this.latestRelease.sections[0];
        const cats = first?.categories ?? [];
        const total = cats.reduce((n, c) => n + (c.items?.length ?? 0), 0);
        return `${first.title}: ${total} change${total !== 1 ? 's' : ''}`;
    }

    get showAiSetup() {
        return !this.isAiConfigured;
    }

    /** Events */

    handleSessionClick = event => {
        const el = event.currentTarget;
        const serverUrl = el.dataset.serverUrl;
        const sessionId = el.dataset.sessionId;
        if (!serverUrl || !sessionId) return;

        if (isChromeExtension()) {
            const appUrl = new URL(chrome.runtime.getURL('/views/app.html'));
            appUrl.searchParams.set('sessionId', sessionId);
            appUrl.searchParams.set('serverUrl', serverUrl);
            window.location.assign(appUrl.toString());
            return;
        }

        navigate(this.navContext, {
            type: 'application',
            state: { applicationName: 'home', sessionId, serverUrl },
        });
    };

    handleSessionKeydown = event => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            this.handleSessionClick(event);
        }
    };

    handleGoToConnections = () => {
        navigate(this.navContext, {
            type: 'application',
            state: { applicationName: 'connections' },
        });
    };

    handleGoToAiSettings = () => {
        navigate(this.navContext, {
            type: 'application',
            state: { applicationName: 'settings' },
        });
    };

    handleViewAiDoc = () => {
        navigate(this.navContext, {
            type: 'application',
            state: { applicationName: AI_DOC_URL },
        });
    };

    handleViewReleaseNotes = () => {
        navigate(this.navContext, {
            type: 'application',
            state: { applicationName: 'release' },
        });
    };

    handleGitHub = () => {
        window.open(GITHUB_DISCUSSIONS_URL, '_blank', 'noopener,noreferrer');
    };
}
