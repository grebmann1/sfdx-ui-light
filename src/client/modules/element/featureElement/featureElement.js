import { LightningElement,api } from 'lwc';
import { isEmpty,isElectronApp,isNotUndefinedOrNull } from 'shared/utils';
import { classSet } from 'shared/utils';
import { I18nMixin } from 'element/i18n';

export default class FeatureElement extends I18nMixin(LightningElement) {

    //@api connector;
    
    

  
    /** Getters */
    
    get connector(){
        return window.connector;
    }

    get alias(){
        return window.connector?.header?.alias;
    }
    
    get isUserLoggedIn(){
        return isNotUndefinedOrNull(this.connector);
    }

    get pageClass(){
        return classSet('full-page')
            .add({
                'full-page-connected':this.isUserLoggedIn
            })
            .toString()
    }
}