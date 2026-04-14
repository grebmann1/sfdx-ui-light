import { wire } from 'lwc';
import ToolkitElement from 'core/toolkitElement';
import { NavigationContext, navigate } from 'lwr/navigation';
import { isChromeExtension } from 'shared/utils';
import { listOrgSessionsViaBackground } from 'core/connector';

const GITHUB_ISSUES_URL = 'https://github.com/grebmann1/sf-toolkit-web/issues';

export default class Welcome extends ToolkitElement {
    @wire(NavigationContext)
    navContext;

    sessions = [];
    isLoadingSessions = true;

    async connectedCallback() {
        this.isLoadingSessions = true;
        try {
            const result = await listOrgSessionsViaBackground();
            if (Array.isArray(result)) {
                this.sessions = result;
            } else {
                this.sessions = [];
            }
        } catch {
            this.sessions = [];
        } finally {
            this.isLoadingSessions = false;
        }
    }

    /** Getters */

    get hasSessions() {
        return this.sessions.length > 0;
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
            state: {
                applicationName: 'home',
                sessionId,
                serverUrl,
            },
        });
    };

    handleSessionKeydown = event => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            this.handleSessionClick(event);
        }
    };

    handleGoToConnections = () => {
        if (isChromeExtension()) {
            const appUrl = new URL(chrome.runtime.getURL('/views/app.html'));
            appUrl.searchParams.set('applicationName', 'connections');
            window.location.assign(appUrl.toString());
            return;
        }

        navigate(this.navContext, {
            type: 'application',
            state: {
                applicationName: 'connections',
            },
        });
    };

    handleGitHub = () => {
        window.open(GITHUB_ISSUES_URL, '_blank', 'noopener,noreferrer');
    };
}
