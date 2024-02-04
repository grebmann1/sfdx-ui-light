import { LightningElement,api,wire,track} from "lwc";
import { isEmpty,runActionAfterTimeOut,isNotUndefinedOrNull } from 'shared/utils';
import FeatureElement from 'element/featureElement';
import { connectStore,store,fetchSObjectsIfNeeded } from 'soql/store';
import { store as appStore,store_application  }  from 'shared/store';

export const isFullPage = true;
export default class App extends FeatureElement {

    @track selectedSObject;

    connectedCallback() {
        store.dispatch(fetchSObjectsIfNeeded({connector:this.connector.conn}));
        appStore.dispatch(store_application.collapseMenu('soql'));
    }

    @wire(connectStore, { store })
    storeChange({ ui }) {
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
        return isNotUndefinedOrNull(this.selectedSObject);
    }


}