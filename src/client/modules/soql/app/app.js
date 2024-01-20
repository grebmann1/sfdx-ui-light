import { LightningElement,api,wire,track} from "lwc";
import { isEmpty,runActionAfterTimeOut,isNotUndefinedOrNull } from 'shared/utils';
import FeatureElement from 'element/featureElement';
import { connectStore,store,login,fetchSObjectsIfNeeded } from 'shared/store';

export const isFullPage = true;
export default class FieldsPanel extends FeatureElement {
    @api connector;

    @track selectedSObject;

    connectedCallback() {
        console.log('connector',this.connector);
        //store.dispatch(login(this.connector));
        store.dispatch(fetchSObjectsIfNeeded({connector:this.connector.conn}));
    }

    @wire(connectStore, { store })
    storeChange({ ui }) {
        console.log('ui',ui.selectedSObject);
        //this.isLoggedIn = ui.isLoggedIn;
        if (ui.selectedSObject) {
            this.selectedSObject = ui.selectedSObject;
        } else {
            this.selectedSObject = null;
        }
    }

    /** Getters **/
    
    get sobjectsPanelClass() {
        return this.selectedSObject ? 'slds-hide' : '';
    }

    get isFieldsPanelDisplayed(){
        console.log('isFieldsPanelDisplayed',this.selectedSObject)
        return isNotUndefinedOrNull(this.selectedSObject);
    }


}