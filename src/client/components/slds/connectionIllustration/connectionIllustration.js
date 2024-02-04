import {LightningElement,api} from 'lwc';
import { classSet } from 'lightning/utils';

export default class ConnectionIllustration extends LightningElement {
    @api title;
    @api subTitle;

    @api padding = false;

    get illustrationClass(){
        return classSet('slds-illustration slds-illustration_small')
             .add({
                'slds-padding-top-200':this.padding
             })
             .toString();
    }

}