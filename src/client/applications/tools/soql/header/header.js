import { wire } from 'lwc';
import FeatureElement from 'element/featureElement';
import {
    connectStore,
    store
} from 'soql/store';

export default class Header extends FeatureElement{
    _apiUsage;

    isFullPage = false;

    @wire(connectStore, { store })
    storeChange({ ui }) {
        this._apiUsage = ui.apiUsage;
    }

    connectedCallback(){
        //this.handleToggle();
    }

    /** Events **/
/*
    handleToggle = (e) => {
        this.isFullPage = ! this.isFullPage;
        if(this.isFullPage){
            appStore.dispatch(store_application.hideMenu());
        }else{
            appStore.dispatch(store_application.showMenu());
        }
    }
    */
    /** Getters **/

    get apiUsage() {
        if (!this._apiUsage) return '';
        return `${this._apiUsage.used}/${this._apiUsage.limit}`;
    }

}
