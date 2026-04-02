import { LightningElement, api, wire } from 'lwc';
import Toast from 'lightning/toast';
import { isUndefinedOrNull, isObject } from 'shared/utils';
import { store as legacyStore, store_application } from 'shared/store';
import { store, connectStore, SELECTORS, DESCRIBE, SOBJECT, UI } from 'core/store';
import { navigate, NavigationContext } from 'lwr/navigation';

export default class OutputCell extends LightningElement {
    @wire(NavigationContext)
    navContext;

    @api value;
    @api column;
    @api recordId;

    /** Events */

    handleClick() {
        //console.log('handleClick');
        //const records =
        const _cloned = {
            recordId: this.recordId,
            column: this.column,
            ...JSON.parse(JSON.stringify(this.value)),
        };

        store.dispatch(
            UI.reduxSlice.actions.selectChildRelationship({ childRelationship: _cloned })
        );
    }

    handle_copyClick = e => {
        e.preventDefault();
        e.stopPropagation();
        navigator.clipboard.writeText(this.value);
        Toast.show({
            label: `${this.column} exported to your clipboard`,
            variant: 'success',
        });
    };

    handle_editClick = e => {
        const params = {
            type: 'application',
            state: {
                applicationName: 'recordviewer',
                recordId: this.recordId,
            },
        };
        navigate(this.navContext, params);
    };

    handleRedirection = e => {
        e.preventDefault();
        e.stopPropagation();
        legacyStore.dispatch(store_application.navigate(this.value));
    };

    /** Getters */

    get isRecordIdField() {
        return this.column === 'Id';
    }

    get formattedValue() {
        return isObject(this.value) ? null : this.value;
    }

    get isNotEmpty() {
        return !isUndefinedOrNull(this.value);
    }

    get formattedTotalSize() {
        return `${
            Array.isArray(this.value)
                ? this.value.length
                : isObject(this.value)
                  ? this.value.totalSize
                  : 0
        } records`;
    }

    get isChildRelationship() {
        return this.value && isObject(this.value); //this.value.rawData && this.value.rawData.totalSize;
    }

    get url() {
        if (!/^[0-9A-Za-z]{18}$/.test(this.formattedValue)) return null;
        return this.formattedValue;
    }

    get isDataDisplayed() {
        return isUndefinedOrNull(this.url);
    }
}
