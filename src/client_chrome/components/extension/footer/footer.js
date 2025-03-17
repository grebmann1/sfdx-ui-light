import {LightningElement, wire} from "lwc";
import Toast from 'lightning/toast';
import {isNotUndefinedOrNull, isUndefinedOrNull} from "shared/utils";
import {chromeOpenInWindow} from 'extension/utils';
import LOGGER from "shared/logger";
import { CACHE_CONFIG,loadExtensionConfigFromCache } from 'shared/cacheManager';
/** Store **/
import {connectStore, store} from 'core/store';

export default class Footer extends LightningElement {

    connector;
    shortcutOpenPanel;

    @wire(connectStore, {store})
    applicationChange({application}) {
        // connector
        if (application.connector) {
            this.connector = null;
            this.connector = application.connector;
            LOGGER.log('connector', this.connector);
        }
    }

    connectedCallback() {
        this.getShortcutOpenPanel();
    }

    /** Methods **/

    getShortcutOpenPanel = async () => {
        this.shortcutOpenPanel = (await loadExtensionConfigFromCache([CACHE_CONFIG.SHORTCUT_OPEN_PANEL.key]))[CACHE_CONFIG.SHORTCUT_OPEN_PANEL.key] || '';
        LOGGER.log('shortcutOpenPanel',this.shortcutOpenPanel);
    }

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

    handleUsernameClick = (e) => {
        e.preventDefault();
        const targetUrl = encodeURIComponent(`/${this.connector.configuration?.userInfo?.user_id}?noredirect=1&isUserEntityOverride=1`);
        chromeOpenInWindow(
            `${this.connector.configuration?.userInfo?.urls?.custom_domain}/lightning/setup/ManageUsers/page?address=${targetUrl}`,
            this.usernameFormatted,
            false
        )
    }

    /** Getters **/

    get isConnectorDisplayed() {
        return isNotUndefinedOrNull(this.connector);
    }

    get isUsernameDisplayed() {
        return isNotUndefinedOrNull(this.connector.configuration.username);
    }

    get isShortcutOpenPanelDisplayed() {
        return !this.isUsernameDisplayed && isNotUndefinedOrNull(this.shortcutOpenPanel);
    }

    get usernameFormatted() {
        return isUndefinedOrNull(this.connector.configuration.username) ? '' : `${this.connector.configuration.username}`;
    }

    get accessTokenFormatted() {
        return isUndefinedOrNull(this.connector.conn.accessToken) ? '' : `${this.connector.conn.accessToken}`;
    }

    get versionFormatted() {
        return isUndefinedOrNull(this.connector.configuration.versionDetails) ? '' : `${this.connector.configuration.versionDetails.label} (${this.connector.configuration.versionDetails.version})`;
    }
}