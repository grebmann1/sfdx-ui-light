import { LightningElement,wire } from 'lwc';
import { isEmpty,isElectronApp,isNotUndefinedOrNull } from 'shared/utils';
import { classSet } from 'shared/utils';
import { I18nMixin } from 'element/i18n';
import { connectStore,store,store_application } from 'shared/store';

export default class FeatureElement extends I18nMixin(LightningElement) {

    //@api connector;
    isLoggedIn = false;
    
    @wire(connectStore, { store })
    applicationChange({application}) {
        if(application.isLoggedIn){
           this.isLoggedIn = true;
        }else if(application.isLoggedOut){
            this.isLoggedIn = false;
        }
    }

  
    /** Getters */
    
    get connector(){
        return window.connector;
    }

    get alias(){
        return window.connector?.header?.alias;
    }
    
    get isUserLoggedIn(){
        return isNotUndefinedOrNull(this.connector) || this.isLoggedIn;
    }

    get isLimitedMode(){
        return window.isLimitedMode;
    }

    get isUnlimitedMode(){
        return !this.isLimitedMode;
    }

    get pageClass(){
        return classSet('full-page')
            .add({
                'full-page-connected':this.isUserLoggedIn
            })
            .toString()
    }
}