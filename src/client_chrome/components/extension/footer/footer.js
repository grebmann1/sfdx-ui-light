import { LightningElement, wire } from 'lwc';
import Toast from 'lightning/toast';
import { isNotUndefinedOrNull, isUndefinedOrNull } from 'shared/utils';
import { chromeOpenInWindow } from 'extension/utils';
import LOGGER from 'shared/logger';
/** Store **/
import { connectStore, store } from 'core/store';

export default class Footer extends LightningElement {
    connector;
    resolvedUsername;
    resolvedUserInfo;
    resolvedUserId;
    _identityFetchPromise;

    @wire(connectStore, { store })
    applicationChange({ application }) {
        // connector
        if (application.connector) {
            this.connector = null;
            this.connector = application.connector;
            this.resolvedUsername = undefined;
            this.resolvedUserInfo = undefined;
            this.resolvedUserId = undefined;
            this._identityFetchPromise = undefined;
            LOGGER.log('connector', this.connector);
            void this.ensureUsernameResolved();
        }
    }

    connectedCallback() {
    }

    /** Methods **/

    ensureUsernameResolved = async () => {
        try {
            if (!this.connector || !this.connector.conn) return;

            const configuredUsername = this.connector.configuration?.username;
            if (!this.isBlankValue(configuredUsername)) {
                // Prefer the configured username (already enriched elsewhere)
                this.resolvedUsername = undefined;
                this.resolvedUserInfo = undefined;
                this.resolvedUserId = undefined;
                return;
            }

            if (!this.isBlankValue(this.resolvedUsername)) return;
            if (this._identityFetchPromise) return await this._identityFetchPromise;
            // IMPORTANT: Avoid conn.identity() here (CORS in injected Lightning pages).

            this._identityFetchPromise = (async () => {
                try {
                    // 1) Resolve current user id (try known sources first)
                    const userId =
                        this.connector.configuration?.userInfo?.user_id ||
                        this.connector.conn?.userInfo?.id ||
                        this.getUserIdFromPageContext() ||
                        (await this.getUserIdFromChatterMe());

                    if (this.isBlankValue(userId)) return;
                    this.resolvedUserId = userId;

                    // 2) Use SOQL to fetch username (preferred)
                    const escapedId = String(userId).replace(/'/g, "\\'");
                    const soql = `SELECT Id, Username FROM User WHERE Id = '${escapedId}' LIMIT 1`;
                    const result = await this.connector.conn.query(soql);
                    const record = result?.records?.[0];
                    this.resolvedUsername = record?.Username || '';
                } catch (e) {
                    // Non-blocking: footer will just not show username
                    LOGGER.debug('Footer.ensureUsernameResolved failed', e?.message || e);
                } finally {
                    this._identityFetchPromise = undefined;
                }
            })();

            return await this._identityFetchPromise;
        } catch (e) {
            // Defensive: never throw from UI render helpers
            this._identityFetchPromise = undefined;
            return;
        }
    };

    isBlankValue(value) {
        if (isUndefinedOrNull(value)) return true;
        return String(value).trim().length === 0;
    }

    getUserIdFromPageContext() {
        try {
            // Common Salesforce global on some pages
            const direct = window?.UserContext?.userId;
            if (!this.isBlankValue(direct)) return direct;

            // Aura context (Lightning Experience)
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
            // ignore; not all orgs have chatter enabled / CORS may differ
        }
        return undefined;
    };

    /** Events **/

    handleCopyUsername = () => {
        navigator.clipboard.writeText(this.usernameFormatted);
        Toast.show({
            label: 'Username exported to your clipboard',
            variant: 'success',
        });
    };

    handleCopyAccessToken = () => {
        navigator.clipboard.writeText(this.accessTokenFormatted);
        Toast.show({
            label: 'Access Token exported to your clipboard',
            variant: 'success',
        });
    };

    handleUsernameClick = async e => {
        e.preventDefault();
        await this.ensureUsernameResolved();
        const userId =
            this.connector?.configuration?.userInfo?.user_id ||
            this.connector?.conn?.userInfo?.id ||
            this.resolvedUserId;
        const domain =
            this.connector?.conn?.instanceUrl || this.connector?.configuration?.instanceUrl;
        if (this.isBlankValue(userId) || this.isBlankValue(domain)) return;

        const targetUrl = encodeURIComponent(`/${userId}?noredirect=1&isUserEntityOverride=1`);
        chromeOpenInWindow(
            `${domain}/lightning/setup/ManageUsers/page?address=${targetUrl}`,
            this.usernameFormatted,
            false
        );
    };

    /** Getters **/

    get isConnectorDisplayed() {
        return isNotUndefinedOrNull(this.connector);
    }

    get isUsernameDisplayed() {
        return !this.isBlankValue(this.usernameResolved);
    }

    get userInfoResolved() {
        return this.connector?.configuration?.userInfo || this.resolvedUserInfo;
    }

    get usernameResolved() {
        const configuredUsername = this.connector?.configuration?.username;
        if (!this.isBlankValue(configuredUsername)) return configuredUsername;
        if (!this.isBlankValue(this.resolvedUsername)) return this.resolvedUsername;
        return '';
    }

    get usernameFormatted() {
        return `${this.usernameResolved || ''}`;
    }

    get accessTokenFormatted() {
        return isUndefinedOrNull(this.connector?.conn?.accessToken)
            ? ''
            : `${this.connector.conn.accessToken}`;
    }

    get versionFormatted() {
        return isUndefinedOrNull(this.connector?.configuration?.versionDetails)
            ? ''
            : `${this.connector.configuration.versionDetails.label} (${this.connector.configuration.versionDetails.version})`;
    }
}
