import {LightningElement, wire} from "lwc";
import Toast from 'lightning/toast';
import {isNotUndefinedOrNull, isUndefinedOrNull} from "shared/utils";
import {chromeOpenInWindow} from 'extension/utils';

/** Store **/
import {connectStore, store} from 'core/store';

export default class Footer extends LightningElement {

    connector;

    /** Getters **/

    get isConnectorDisplayed() {
        return isNotUndefinedOrNull(this.connector);
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

    @wire(connectStore, {store})
    applicationChange({application}) {
        // connector
        if (application.connector) {
            this.connector = null;
            this.connector = application.connector;
        }
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
        console.log('this.connector', this.connector);
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
}