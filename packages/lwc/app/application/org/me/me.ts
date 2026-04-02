import { api, track, wire } from 'lwc';
import ToolkitElement from 'core/toolkitElement';
import Toast from 'lightning/toast';
import {
    isEmpty,
    runSilent,
    isNotUndefinedOrNull,
    isUndefinedOrNull,
    refreshCurrentTab,
    classSet,
} from 'shared/utils';
import { store as legacyStore, store_application } from 'shared/store';
import { connectStore, store } from 'core/store';
import type { ConnectorLike } from 'core/connector';

export default class Me extends ToolkitElement {
    @api title = 'Current User';
    @api isInjected = false;
    @track user: Record<string, any> | null = {};

    _username: string | null = null; // Used to control reloading

    // Editing
    metadata: Record<string, any> | null = null;
    isEdit = false;
    isSaving = false;
    fieldErrors: Record<string, any> | null = null;

    _connector: ConnectorLike | null = null;
    set connector(value: ConnectorLike | null) {
        this._connector = value;
        if (
            this._connector?.configuration?.username &&
            this._connector?.configuration?.username != this._username
        ) {
            this.load_metadata();
            this.load_myUserInformation();
            this._username = this._connector.configuration.username;
        }
    }
    @api
    get connector(): ConnectorLike | null {
        return this._connector;
    }

    connectedCallback() {
        //this.isFilterting_limits = true;
        //console.log('store.getState()',store.getState());
        this.connector = store.getState().application?.connector;
    }

    @wire(connectStore, { store })
    applicationChange({ application }: { application: any }) {
        if (application.connector) {
            this.connector = null;
            this.connector = application.connector;
        }
    }

    /** Methods */

    goToUrl = (e: any): void => {
        const redirectUrl = e.currentTarget.dataset.url;
        legacyStore.dispatch(store_application.navigate(redirectUrl));
    };

    handleShare = async (): Promise<void> => {
        try {
            const sessionId = this.connector?.conn?.accessToken;
            const serverUrl = this.connector?.conn?.instanceUrl;
            if (isEmpty(sessionId) || isEmpty(serverUrl)) return;

            const origin =
                typeof window !== 'undefined' && window.location?.origin
                    ? window.location.origin
                    : '';
            const base =
                typeof chrome !== 'undefined' && chrome.runtime?.getURL
                    ? chrome.runtime.getURL('/views/app.html')
                    : origin
                      ? `${origin}/app`
                      : '/app';

            const url = new URL(base, origin || undefined);
            url.searchParams.set('sessionId', sessionId);
            url.searchParams.set('serverUrl', serverUrl);

            const message = [
                '--- Workbench 2.0 Current User ---',
                this.user?.Name ? `Name: ${this.user.Name}` : '',
                this.user?.Username ? `Username: ${this.user.Username}` : '',
                this.user?.Id ? `User Id: ${this.user.Id}` : '',
                this.connector?.configuration?.alias
                    ? `Alias: ${this.connector.configuration.alias}`
                    : '',
                `Server Url: ${serverUrl}`,
                '',
                'Open in Workbench 2.0:',
                url.toString(),
            ]
                .filter(Boolean)
                .join('\n');

            await navigator.clipboard.writeText(message);
            Toast.show({ label: 'Share copied to clipboard', variant: 'success' });
        } catch (e) {
            Toast.show({
                label: 'Share failed',
                message: e?.message || String(e),
                variant: 'error',
                mode: 'dismissible',
            });
        }
    };

    load_metadata = async (): Promise<void> => {
        this.metadata = await runSilent(async () => {
            return await this.connector.conn.sobject('user').describe();
        }, null);
    };

    load_myUserInformation = async (): Promise<void> => {
        if (isUndefinedOrNull(this.connector?.conn?.userInfo)) return;
        const fields = [
            'Id',
            'LastName',
            'FirstName',
            'Username',
            'Email',
            'FederationIdentifier',
            'CompanyName',
            'Name',
            'IsActive',
            'LanguageLocaleKey',
        ];
        const exceptionFields = ['CurrencyIsoCode'];
        const query = (fields: string[]): string =>
            `SELECT ${fields.join(',')} FROM User WHERE id = '${this.connector.conn.userInfo.id}'`;
        var _user = await runSilent(async () => {
            return (await this.connector.conn.query(query([].concat(fields, exceptionFields))))
                .records[0];
        }, null);
        if (_user === null) {
            // Temporary solution, in case we don't have CurrencyIsoCode
            _user = await runSilent(async () => {
                return (await this.connector.conn.query(query(fields))).records[0];
            }, null);
        }
        this.user = null;
        this.user = _user;
    };

    renderFieldErrors = (): void => {
        if (isUndefinedOrNull(this.fieldErrors)) return;

        this.template.querySelectorAll('slds-input-field').forEach(element => {
            if (!this.fieldErrors.hasOwnProperty(element.fieldName)) return;

            element.setErrors(this.fieldErrors);
        });
    };

    reset = (): void => {
        this.fieldErrors = null;
        this.isEdit = false;
        this.load_myUserInformation();
    };

    /** Events */

    handle_copyClick = (e: any): void => {
        const value = e.target.dataset.value;
        const field = e.target.dataset.field;
        navigator.clipboard.writeText(value);
        Toast.show({
            label: `${field} exported to your clipboard`,
            variant: 'success',
        });
    };

    handle_editClick = (): void => {
        this.isEdit = true;
        setTimeout(async () => {
            this.template.querySelectorAll('slds-input-field').forEach(element => {
                const uiField = this.metadata.fields.find(x => x.name === element.fieldName);
                element.wireRecordAndMetadata({
                    record: this.user,
                    objectInfo: this.metadata,
                    uiField,
                });
                // only picklist
                if (uiField.type == 'picklist' || uiField.type == 'multipicklist') {
                    //const picklistValues = this.metadata.fields.filter(x => x.type == 'picklist' || x.type == 'multipicklist').reduce((a, v) => ({ ...a, [v.name]: v.picklistValues}), {})
                    const picklistValues = [uiField].reduce(
                        (a, v) => ({ ...a, [v.name]: v.picklistValues }),
                        {}
                    );
                    element.wirePicklistValues(picklistValues);
                }
            });
        }, 1);
    };

    handle_save = async (): Promise<void> => {
        this.isSaving = true;
        const userUpdate = { Id: this.user.Id }; //
        this.template.querySelectorAll('slds-input-field').forEach(element => {
            // Only add changed fields !
            if (this.user[element.fieldName] !== element.value) {
                userUpdate[element.fieldName] = element.value;
            }
        });
        const response = (await this.connector.conn.sobject('User').update([userUpdate]))[0];
        //console.log('###### userUpdate/response ######',userUpdate,response);
        this.isSaving = false;
        if (response.success) {
            this.reset();
            refreshCurrentTab();
            Toast.show({
                label: 'User saved successfully',
                variant: 'success',
            });
        } else {
            const fieldErrorSet = {};
            const fieldErrorGlobal = [];
            // Need to improve in the futur
            response.errors.forEach(error => {
                error.fields.forEach(field => {
                    fieldErrorSet[field] = error;
                });
                if (error.fields.length == 0) {
                    fieldErrorGlobal.push(error);
                }
            });
            this.fieldErrors = fieldErrorSet;
            this.renderFieldErrors();
            var error_label, error_message;
            if (fieldErrorGlobal.length > 0) {
                error_label = fieldErrorGlobal[0].statusCode;
                error_message = fieldErrorGlobal[0].message;
            } else {
                error_label = response.errors[0].statusCode;
                error_message = response.errors[0].message;
            }
            Toast.show({
                message: error_message || 'Unknown Error',
                label: error_label || 'Error',
                variant: 'error',
                mode: 'sticky',
            });
        }
    };

    handle_cancel = (): void => {
        this.reset();
    };

    /** Getters */

    get isEditButtonDisabled() {
        return isUndefinedOrNull(this.metadata);
    }

    get isShareDisabled() {
        return (
            this.isEdit ||
            isEmpty(this.connector?.conn?.accessToken) ||
            isEmpty(this.connector?.conn?.instanceUrl)
        );
    }

    get isReadOnly() {
        return !this.isEdit;
    }

    get goToMyUserUrl() {
        const userId = this.connector?.conn?.userInfo?.id;
        return `/lightning/setup/ManageUsers/page?address=${encodeURIComponent(
            `/${userId}?noredirect=1&isUserEntityOverride=1`
        )}`;
    }

    get containerClass() {
        return classSet('slds-col slds-size_1-of-1 slds-p-top_x-small slds-p-left_x-small')
            .add({
                'slds-large-size_1-of-2': !this.isInjected,
            })
            .toString();
    }
}
