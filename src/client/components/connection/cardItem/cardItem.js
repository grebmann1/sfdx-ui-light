import { api } from "lwc";
import FeatureElement from 'element/featureElement';
import { isEmpty,isElectronApp,classSet,isUndefinedOrNull,isNotUndefinedOrNull,runActionAfterTimeOut,formatFiles,sortObjectsByField,removeDuplicates } from 'shared/utils';



export default class CardItem extends FeatureElement {

    @api item;

    /** events **/

    handleEventClick = (e) => {
        const eventName = e.currentTarget.dataset.event;
        console.log('eventName',eventName);
        this.dispatchEvent(new CustomEvent("rowaction", { detail:{action:{name:eventName},row:this.item},bubbles: true,composed: true }));
    }


    /** getters */

    get iconClass(){
        return classSet('slds-button__icon_left')
             .add({
                'icon-org-prod':!this.isSandbox,
                'icon-org-sandbox':this.isSandbox
             })
             .toString();
    }

    get id(){
        return this.item?.id || '';
    }

    get name(){
        return this.item?._name || '';
    }

    get username(){
        return this.item?._username || '';
    }

    get isSandbox(){
        return this.item?.isSandbox || (this.item?.instanceUrl || '').endsWith('sandbox.my.salesforce.com');
    }

}