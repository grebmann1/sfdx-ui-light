import { LightningElement,api } from 'lwc';
import { classSet,normalizeString as normalize  } from 'shared/utils';

export default class Illustration extends LightningElement {

    @api title;
    @api subTitle;
    //slds-illustration_large

    @api
    get size() {
        return this._size;
    }
    set size(val) {
        this._size = val;
    }
    

    /** Getter */
    get normalizedSize(){
        return normalize(this.size, {
            fallbackValue: 'small',
            validValues: ['small','large'],
        });
    }

    get illustrationClass(){
        return classSet('slds-illustration').add(`slds-illustration_${this.normalizedSize}`).toString();
    }
}