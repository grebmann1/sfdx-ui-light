import { api } from 'lwc';
import Illustration from 'illustration/illustration';
import { classSet } from 'lightning/utils';

export default class ConnectionIllustration extends Illustration {
    @api padding = false;

    get connectionClass() {
        return classSet(this.illustrationClass)
            .add({
                'slds-padding-top-200': this.padding,
            })
            .toString();
    }
}
