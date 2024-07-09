import {LightningElement,api} from "lwc";
import { isEmpty,isNotUndefinedOrNull } from 'shared/utils';
import { store,store_application } from 'shared/store';

export default class SobjectCell extends LightningElement {

    @api value;
    @api isBoolean;

    @api urlLink;
    @api urlLabel;

    /* Events */

    goToUrl = (e) => {
        const redirectUrl = e.currentTarget.dataset.url;
        //console.log('redirectUrl',redirectUrl);
        store.dispatch(store_application.navigate(redirectUrl));
    }

    /* Getters */

    get isLink(){
        return isNotUndefinedOrNull(this.urlLink);
    }

    
}