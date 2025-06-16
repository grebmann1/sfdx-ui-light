import { LightningElement, api } from 'lwc';
import { classSet, isEmpty } from 'shared/utils';
import LOGGER from 'shared/logger';

export default class Field extends LightningElement {
    //static delegatesFocus = true;

    @api isEdit = false;
    @api label;
    @api isLoading = false;
    @api isReadOnly = false;

    // manually set the error state
    @api hasError = false;
    @api errorMessage = '';

    _currentValue;

    connectedCallback() {
        this.template.host.addEventListener('focus', this.handleFocus);
    }

    handleFocus = (event) => {
        if (this.isReadOnly) {
            return;
        }
        this.handleEdit();
    };

    disconnectedCallback() {
        // Clean up to prevent memory leaks
        this.template.host.removeEventListener('focus', this.handleFocus);
    }

    /** Methods **/

    focusInput = (withFocus = true) => {
        if (this.inputField) {
            this.inputField.addEventListener('blur', this.handleBlur);
            this.inputField.addEventListener('keydown', this.handleKeyDown);
            setTimeout(() => {

                this._currentValue = this.inputField.value;
                if (withFocus) {
                    this.inputField.focus();
                    this.inputField.value = this._currentValue; // force a reset
                }
            }, 0);
        }
    };

    validateInput = (inputField) => {
        if (!inputField.checkValidity()) {
            inputField.reportValidity();
            return false;
        }
        return true;
    };

    @api
    setCustomValidity(message) {
        //this.inputField.setCustomValidity(message);
        this.errorMessage = message;
    }

    @api
    reportValidity() {
        this.hasError = !isEmpty(this.errorMessage);
        if (this.hasError) {
            this.inputField.setCustomValidity(this.errorMessage);
            this.inputField.reportValidity();
            this.focusInput(false);
            this.isEdit = true;
        } else {
            this.resetError();
        }
    }

    resetError = () => {
        this.hasError = false;
        this.errorMessage = '';
        this.isEdit = false;
    };

    /** Events */

    handleEdit = (withFocus = true) => {
        this.isEdit = true;
        this.focusInput(withFocus);
        this.dispatchEvent(new CustomEvent('edit', { bubbles: true }));
    };

    handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault(); // Prevent the default behavior of Enter key
            this.inputField.blur();
        }
    };

    handleBlur = (e) => {
        e.preventDefault();
        e.stopPropagation();
        //LOGGER.debug('handleBlur');
        this.resetError();
        // Remove event listeners
        this.inputField?.removeEventListener('blur', this.handleBlur);
        this.inputField?.removeEventListener('keydown', this.handleKeyDown);

        if (this.inputField) {
            if (this.validateInput(this.inputField)) {
                this.isEdit = false;
                this.dispatchEvent(
                    new CustomEvent('blur', {
                        bubbles: true,
                        detail: {
                            field: e.target.dataset.field,
                        },
                    }),
                );
            }
            //LOGGER.debug('diff value',this._currentValue !== this.inputField.value);
            if (this._currentValue !== this.inputField.value) {
                this.dispatchEvent(
                    new CustomEvent('change', {
                        bubbles: true,
                        detail: {
                            value: this.inputField.value,
                        },
                    }),
                ); // Propagate the event with "e"
            }
        } else {
            this.isEdit = false;
        }
    };

    /** Getters **/

    get inputField() {
        return this.template.querySelector('slot[name="input"]').assignedElements()[0];
    }

    get editClass() {
        return classSet('slds-form-element slds-form-element_edit')
            .add({
                'slds-hide': !this.isEdit || this.isLoading,
                'slds-has-error': this.hasError,
            })
            .toString();
    }

    get readonlyClass() {
        return classSet('slds-form-element slds-form-element_edit')
            .add({
                'slds-hide': this.isEdit || this.isLoading,
                'slds-has-error': this.hasError,
            })
            .toString();
    }
}
