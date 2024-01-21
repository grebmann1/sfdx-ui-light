import { LightningElement,api,wire,track} from "lwc";
import { isEmpty,runActionAfterTimeOut,isNotUndefinedOrNull } from 'shared/utils';
import FeatureElement from 'element/featureElement';
import { connectStore,store,fetchSObjectsIfNeeded } from 'soql/store';

export const isFullPage = true;
export default class FieldsPanel extends FeatureElement {
    @api connector;

    @track selectedSObject;

    connectedCallback() {
        store.dispatch(fetchSObjectsIfNeeded({connector:this.connector.conn}));
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