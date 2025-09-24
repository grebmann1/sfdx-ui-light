import { LightningElement, api } from 'lwc';
import { normalizeString as normalize, classSet } from 'shared/utils';
const VARIANTS = {
    INFO: 'info',
    ERROR: 'error',
    WARNING: 'warning',
    OFFLINE: 'offline',
    BRAND: 'brand',
}

export default class Notify extends LightningElement {
    @api isCloseDiplayed = false;
    @api variant = VARIANTS.INFO;

    /** Events */

    handleClose = e => {
        this.dispatchEvent(new CustomEvent('close'));
    };

    /** Getters */

    get normalizedVariant() {
        return normalize(this.variant, {
            fallbackValue: VARIANTS.INFO,
            validValues: [VARIANTS.INFO, VARIANTS.ERROR, VARIANTS.WARNING, VARIANTS.OFFLINE, VARIANTS.BRAND],
        });
    }

    get notifyClass() {
        return classSet(
            `slds-notify slds-notify_alert`
        ).add({
            'slds-notify-brand': this.normalizedVariant === VARIANTS.BRAND,
            'slds-alert_warning': this.normalizedVariant === VARIANTS.WARNING,
            'slds-alert_error': this.normalizedVariant === VARIANTS.ERROR,
            'slds-alert_offline': this.normalizedVariant === VARIANTS.OFFLINE,
        }).toString();
    }
}
