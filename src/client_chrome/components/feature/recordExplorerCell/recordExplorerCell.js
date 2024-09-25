import {api, LightningElement} from "lwc";
import {isEmpty, isNotUndefinedOrNull, isSalesforceId, isUndefinedOrNull} from "shared/utils";

export default class RecordExplorerCell extends LightningElement {

    @api value;
    @api type;
    @api name;
    @api label;
    @api filter;
    @api currentOrigin;

    /** Getters */

    get isTrue() {
        return this.value === true;
    }

    get isBoolean() {
        return this.type === 'boolean';
    }

    get isCopyDisplayed() {
        return isNotUndefinedOrNull(this.value);
    }

    get isSalesforceId() {
        return isNotUndefinedOrNull(this.value) && isSalesforceId(this.value);
    }

    get formattedValue() {
        if (isUndefinedOrNull(this.value)) return '';
        if (isEmpty(this.filter)) return this.value;

        var regex = new RegExp('(' + this.filter + ')', 'gi');
        if (isNotUndefinedOrNull(this.value) && regex.test(this.value)) {
            return this.value.toString().replace(/<?>?/, '').replace(regex, '<span style="font-weight:Bold; color:blue;">$1</span>');
        }

        return this.value.toString();
    }

    connectedCallback() {
    }

    renderedCallback() {
        if (this.template.querySelector('.injector')) {
            // Issue will happen with "HTML values";
            let formattedHtml = this.formattedValue;
            if (this.type === 'address') {
                formattedHtml = `<pre>${this.formattedValue}</pre>`;
            } else if (this.isSalesforceId) {
                formattedHtml = `<a href="${this.currentOrigin}/${this.value}" target="_blank">${this.formattedValue}</a>`;
            }

            this.template.querySelector('.injector').innerHTML = formattedHtml;

        }
    }

    handleCopy = () => {
        navigator.clipboard.writeText(this.value);
    }

}