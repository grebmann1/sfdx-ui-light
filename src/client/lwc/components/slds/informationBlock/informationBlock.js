import { LightningElement, api } from 'lwc';
import { classSet } from 'lightning/utils';

export default class InformationBlock extends LightningElement {
    @api title;
    @api variant; //default is empty | error (Need to be refactored)

    get quoteClass() {
        return classSet('doc')
            .add({
                error: this.variant === 'error',
                success: this.variant === 'success',
                reverse: this.variant === 'reverse',
            })
            .toString();
    }
}
