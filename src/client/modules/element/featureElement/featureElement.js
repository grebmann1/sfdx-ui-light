import { LightningElement,api } from 'lwc';
import { isEmpty,isElectronApp,isNotUndefinedOrNull } from 'shared/utils';
import { classSet } from 'shared/utils';


export default class FeatureElement extends LightningElement {

    @api connector;

  
    /** Getters */
    
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