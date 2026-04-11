import { api, wire } from 'lwc';
import ToolkitElement from 'core/toolkitElement';
import {
    connectSessionFromBackgroundResult,
    credentialStrategies,
    findExistingSessionViaBackground,
    OAUTH_TYPES,
} from 'core/connector';
import { connectStore, store, APPLICATION } from 'core/store';
import LOGGER from 'shared/logger';
import { isChromeExtension } from 'shared/utils';
import SessionRecoveryModal, { RESULT as SESSION_RECOVERY_RESULT } from 'slds/sessionRecoveryModal';
import {
    DEFAULT_SUBTITLE,
    DEFAULT_TITLE,
    EXPIRED_SUBTITLE,
    EXPIRED_TITLE,
    MODAL_COPY,
    MODAL_VARIANTS,
} from './constants.js';

export default class AuthBoundary extends ToolkitElement {
    @api isRequired = false;
    @api isLoading = false;
    @api title = DEFAULT_TITLE;
    @api subTitle = DEFAULT_SUBTITLE;
    @api preserveContentWhenBlocked = false;
    @api suppressSessionRecovery = false;

    _sessionRecoveryInProgress = false;
    sessionHasExpired = false;

    @wire(connectStore, { store })
    handleApplicationChange({ application }) {
        this.sessionHasExpired = Boolean(application?.sessionHasExpired);
        if (!this.suppressSessionRecovery && this.sessionHasExpired) {
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
            for (;;) {
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

                store.dispatch(APPLICATION.reduxSlice.actions.logout({}));
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
            const result = await findExistingSessionViaBackground({
                alias: configuration?.alias,
                instanceUrl: configuration?.instanceUrl,
            });

            if (result?.sessionId && result?.serverUrl) {
                const connector =
                    (await connectSessionFromBackgroundResult({
                        sessionId: result.sessionId,
                        serverUrl: result.serverUrl,
                    })) ||
                    (await credentialStrategies.SESSION.connect({
                        sessionId: result.sessionId,
                        serverUrl: result.serverUrl,
                    }));
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
        return Boolean(
            this.shouldRequireConnection && (!this.isUserLoggedIn || this.sessionHasExpired)
        );
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

    get resolvedTitle() {
        return this.sessionHasExpired ? EXPIRED_TITLE : this.title;
    }

    get resolvedSubTitle() {
        return this.sessionHasExpired ? EXPIRED_SUBTITLE : this.subTitle;
    }

    get isAutoReconnectEnabled() {
        return (
            isChromeExtension() &&
            this.connector?.configuration?.credentialType === OAUTH_TYPES.SESSION
        );
    }
}
