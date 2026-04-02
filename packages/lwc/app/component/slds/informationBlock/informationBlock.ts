import { LightningElement, api } from 'lwc';
import { classSet } from 'lightning/utils';

export default class InformationBlock extends LightningElement {
    @api title;
    @api variant; //default is empty | error | warning (Need to be refactored)

    get quoteClass() {
        return classSet('doc')
            .add({
                error: this.variant === 'error',
                success: this.variant === 'success',
                warning: this.variant === 'warning',
                reverse: this.variant === 'reverse',
            })
            .toString();
    }
}
