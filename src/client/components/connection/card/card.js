import { api } from "lwc";
import FeatureElement from 'element/featureElement';
import { isEmpty,isElectronApp,classSet,isUndefinedOrNull,isNotUndefinedOrNull,runActionAfterTimeOut,formatFiles,sortObjectsByField,removeDuplicates } from 'shared/utils';



export default class Card extends FeatureElement {

    @api item;
    @api isOpen = false;

    /** events **/

    handleCardHeaderClick = (e) => {
        e.stopPropagation();
        e.preventDefault();
        this.isOpen = !this.isOpen;
    } 

    dummyCardMenuClick = (e) => {
        e.stopPropagation();
        e.preventDefault();
    }


    /** getters */

    get isOpenFormatted(){
        return this.isOpen && this.items.length > 0;
    }

    get cardItemsClass(){
        return classSet('card-items')
             .add({
                'slds-is-open':this.isOpenFormatted,
                'slds-hide':!this.isOpenFormatted
             })
             .toString();
    }

    get buttonIcon(){
        return this.isOpenFormatted?'utility:chevrondown':'utility:chevronright';
    }

    get title(){
        return this.item?.title;
    }

    get items(){
        return this.item?.items || [];
    }

    get itemMessage(){
        return `${this.items.length} orgs`;
    }

}