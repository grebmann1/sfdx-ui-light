import { LightningElement, api } from 'lwc';
import { isEmpty, isNotUndefinedOrNull } from 'shared/utils';
import { store as legacyStore, store_application } from 'shared/store';
import Toast from 'lightning/toast';

export default class SobjectCell extends LightningElement {
    @api value;
    @api isBoolean;

    @api urlLink;
    @api urlLabel;

    @api fieldInfo;

    /* Events */

    goToUrl = e => {
        const redirectUrl = e.currentTarget.dataset.url;
        //console.log('redirectUrl',redirectUrl);
        legacyStore.dispatch(store_application.navigate(redirectUrl));
    };

    handleFormulaClick = () => {
        navigator.clipboard.writeText(this.tooltip_formula);
        Toast.show({
            label: 'Formula exported to your clipboard',
            variant: 'success',
        });
    };

    /* Getters */

    get isLink() {
        return isNotUndefinedOrNull(this.urlLink);
    }

    get isFormula() {
        return this.fieldInfo?.calculated || false;
    }

    get tooltip_formula() {
        return this.fieldInfo?.calculatedFormula;
    }
}
