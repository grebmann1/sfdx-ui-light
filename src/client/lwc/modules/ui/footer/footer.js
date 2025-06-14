import { LightningElement, wire, api } from 'lwc';
import Toast from 'lightning/toast';
import { isUndefinedOrNull, isNotUndefinedOrNull } from 'shared/utils';
import { chromeOpenInWindow } from 'extension/utils';

/** Store **/
import { store, connectStore } from 'core/store';

export default class Footer extends LightningElement {
    @api version;

    isFooterDisplayed = true;

    connector;

    @wire(connectStore, { store })
    applicationChange({ application }) {
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
        //console.log('this.connector',this.connector);
        navigator.clipboard.writeText(this.accessTokenFormatted);
        Toast.show({
            label: 'Access Token exported to your clipboard',
            variant: 'success',
        });
    };

    handleUsernameClick = e => {
        e.preventDefault();
        const targetUrl = encodeURIComponent(
            `/${this.connector.configuration?.userInfo?.user_id}?noredirect=1&isUserEntityOverride=1`
        );
        chromeOpenInWindow(
            `${this.connector.configuration?.userInfo?.urls?.custom_domain}/lightning/setup/ManageUsers/page?address=${targetUrl}`,
            this.usernameFormatted,
            false
        );
    };

    /** Getters **/

    get isConnectorDisplayed() {
        return isNotUndefinedOrNull(this.connector);
    }

    get usernameFormatted() {
        return isUndefinedOrNull(this.connector.configuration.username)
            ? ''
            : `${this.connector.configuration.username}`;
    }

    get accessTokenFormatted() {
        return isUndefinedOrNull(this.connector.conn.accessToken)
            ? ''
            : `${this.connector.conn.accessToken}`;
    }

    get versionFormatted() {
        return isNotUndefinedOrNull(this.version) ? this.version + ' / ' : '';
    }

    get salesforceVersionFormatted() {
        const version = this.connector?.conn?._versions?.find(
            x => x.version === this.connector.conn.version
        );
        return version ? `${version.label} (${version.version})` : 'Unknown';
    }
}
