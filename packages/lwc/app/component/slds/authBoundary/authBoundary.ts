import { api, wire } from 'lwc';
import ToolkitElement from 'core/toolkitElement';
import { credentialStrategies, OAUTH_TYPES } from 'core/connector';
import { connectStore, store, APPLICATION } from 'core/store';
import LOGGER from 'shared/logger';
import { isChromeExtension } from 'shared/utils';
import SessionRecoveryModal, { RESULT as SESSION_RECOVERY_RESULT } from 'slds/sessionRecoveryModal';

const MODAL_VARIANTS = {
    EXPIRED: 'expired',
    MISSING_SESSION: 'missing-session',
    RECONNECT_FAILED: 'reconnect-failed',
};

const DEFAULT_TITLE = 'No Salesforce Connection';
const DEFAULT_SUBTITLE = "It's required to be connected to an Org to use this feature";

const MODAL_COPY = {
    [MODAL_VARIANTS.EXPIRED]: {
        heading: 'Session Expired',
        message: 'Your Salesforce session has expired.',
        details:
            'If auto-reconnect is available, we can try to restore the same org session for you. Otherwise, log out and reconnect manually.',
    },
    [MODAL_VARIANTS.MISSING_SESSION]: {
        heading: 'Reconnect Unavailable',
        message: 'No reusable Salesforce session was found in your open browser tabs.',
        details:
            'Open the same org in another tab if you want to retry auto-reconnect, or log out and reconnect manually.',
    },
    [MODAL_VARIANTS.RECONNECT_FAILED]: {
        heading: 'Reconnect Failed',
        message: 'We could not restore your Salesforce session automatically.',
        details: 'You can retry auto-reconnect or log out and reconnect manually.',
    },
};

export default class AuthBoundary extends ToolkitElement {
    @api isRequired = false;
    @api isLoading = false;
    @api title = DEFAULT_TITLE;
    @api subTitle = DEFAULT_SUBTITLE;
    @api preserveContentWhenBlocked = false;
    @api suppressSessionRecovery = false;

    _sessionRecoveryInProgress = false;

    @wire(connectStore, { store })
    handleApplicationChange({ application }) {
        if (!this.suppressSessionRecovery && application?.sessionHasExpired) {
            void this.handleSessionRecovery();
        }
    }

    async handleSessionRecovery() {
        if (this._sessionRecoveryInProgress) {
            return;
        }

        this._sessionRecoveryInProgress = true;
        let modalVariant = MODAL_VARIANTS.EXPIRED;

        try {
            while (true) {
                const result = await SessionRecoveryModal.open(this.getModalOptions(modalVariant));
                if (
                    result === SESSION_RECOVERY_RESULT.AUTO_RECONNECT &&
                    this.isAutoReconnectEnabled
                ) {
                    const reconnectResult = await this.tryAutoReconnect();
                    if (reconnectResult === 'success') {
                        return;
                    }
                    modalVariant =
                        reconnectResult === 'missing-session'
                            ? MODAL_VARIANTS.MISSING_SESSION
                            : MODAL_VARIANTS.RECONNECT_FAILED;
                    continue;
                }

                store.dispatch(APPLICATION.reduxSlice.actions.logout());
                return;
            }
        } finally {
            this._sessionRecoveryInProgress = false;
        }
    }

    async tryAutoReconnect() {
        const configuration = this.connector?.configuration;
        if (configuration?.credentialType !== OAUTH_TYPES.SESSION || !isChromeExtension()) {
            return 'missing-session';
        }

        try {
            const result = await new Promise(resolve => {
                try {
                    chrome.runtime.sendMessage(
                        {
                            action: 'findExistingSession',
                            alias: configuration?.alias,
                            instanceUrl: configuration?.instanceUrl,
                        },
                        response => resolve(response)
                    );
                } catch {
                    resolve(undefined);
                }
            });

            if (result?.sessionId && result?.serverUrl) {
                const connector = await credentialStrategies.SESSION.connect({
                    sessionId: result.sessionId,
                    serverUrl: result.serverUrl,
                });
                store.dispatch(APPLICATION.reduxSlice.actions.login({ connector }));
                return 'success';
            }

            return 'missing-session';
        } catch (error) {
            LOGGER.error('authBoundary auto reconnect failed', error);
            return 'reconnect-failed';
        }
    }

    getModalOptions(variant = MODAL_VARIANTS.EXPIRED) {
        const copy = MODAL_COPY[variant] || MODAL_COPY[MODAL_VARIANTS.EXPIRED];
        return {
            size: 'small',
            heading: copy.heading,
            message: copy.message,
            details: copy.details,
            closeLabel: 'Log out',
            reconnectLabel: 'Auto-Reconnect',
            isAutoReconnectEnabled: this.isAutoReconnectEnabled,
        };
    }

    get isBlocked() {
        return Boolean(this.shouldRequireConnection && !this.isUserLoggedIn);
    }

    get shouldRequireConnection() {
        return Boolean(this.isRequired && !this.isLoading);
    }

    get shouldShowOverlay() {
        return this.preserveContentWhenBlocked && this.isBlocked;
    }

    get shouldRenderReplaceMode() {
        return !this.preserveContentWhenBlocked;
    }

    get overlayClass() {
        return this.isBlocked
            ? 'auth-boundary__overlay auth-boundary__overlay_visible'
            : 'auth-boundary__overlay';
    }

    get isAutoReconnectEnabled() {
        return (
            isChromeExtension() &&
            this.connector?.configuration?.credentialType === OAUTH_TYPES.SESSION
        );
    }
}
