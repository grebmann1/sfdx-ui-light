import { LightningElement, wire, api } from 'lwc';
import Toast from 'lightning/toast';
import { isUndefinedOrNull, isNotUndefinedOrNull, classSet } from 'shared/utils';
import { chromeOpenInWindow } from 'extension/utils';
import moment from 'moment';

/** Store **/
import { ERROR, store, connectStore } from 'core/store';

export default class Footer extends LightningElement {
    @api version;

    isFooterDisplayed = true;

    connector;

    // Error panel state
    isErrorPanelOpen = false;
    selectedError = null;
    errors = [];
    filterText = '';

    @wire(connectStore, { store })
    applicationChange({ application, errors }) {
        // connector
        if (application.connector) {
            this.connector = null;
            this.connector = application.connector;
        }
        // errors from store
        if (errors) {
            this.errors = errors;
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

    handleErrorClick = () => {
        this.isErrorPanelOpen = !this.isErrorPanelOpen;
        this.selectedError = null;
    };

    handleErrorItemClick = (event) => {
        const errorId = event.currentTarget.dataset.id;
        if (this.selectedError && this.selectedError.id == errorId) {
            // Deselect if already selected
            this.selectedError = null;
        } else {
            this.selectedError = this.errors.find(e => e.id == errorId);
        }
    };

    handleClosePanel = () => {
        this.isErrorPanelOpen = false;
        this.selectedError = null;
    };

    handleFilterInput = (event) => {
        this.filterText = event.target.value;
    };

    handleClearErrors = () => {
        store.dispatch(ERROR.reduxSlice.actions.clearErrors());
        this.selectedError = null;
    };

    /** Getters **/

    get hasErrors() {
        return this.errors && this.errors.length > 0;
    }

    get latestErrorMessage() {
        return this.hasErrors ? this.errors[this.errors.length - 1].message : '';
    }

    get isConnectorDisplayed() {
        return isNotUndefinedOrNull(this.connector);
    }

    get usernameFormatted() {
        return isUndefinedOrNull(this.connector?.configuration?.username)
            ? ''
            : `${this.connector.configuration.username}`;
    }

    get accessTokenFormatted() {
        return isUndefinedOrNull(this.connector?.conn?.accessToken)
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

    get formattedErrorCount() {
        return this.errors.length > 0 ? `(${this.errors.length})` : '';
    }

    get filteredErrors() {
        let filtered = this.errors;
        if (this.filterText && this.filterText.trim()) {
            const search = this.filterText.trim().toLowerCase();
            filtered = filtered.filter(e => {
                const formattedTime = moment(e.time).format('YYYY-MM-DD HH:mm:ss');
                return (
                    (e.name && e.name.toLowerCase().includes(search)) ||
                    (e.message && e.message.toLowerCase().includes(search)) ||
                    (e.details && e.details.toLowerCase().includes(search)) ||
                    (formattedTime && formattedTime.toLowerCase().includes(search))
                );
            });
        }
        // Show latest error first and add class for selection
        return filtered.slice().reverse().map(e => ({
            ...e,
            formattedTime: moment(e.time).format('YYYY-MM-DD HH:mm:ss'),
            selected: this.selectedError && e.id === this.selectedError.id,
            class: this.getErrorListItemClass(e)
        }));
    }

    get errorListClass() {
        return classSet('footer-error-list scrollable-error-list slds-flex-column')
        .add({
            'with-details': this.selectedError,
        }).toString();
    }

    getErrorListItemClass(error) {
        return (
            'footer-error-list-item' +
            (this.selectedError && error.id === this.selectedError.id ? ' slds-is-active' : '')
        );
    }
}
