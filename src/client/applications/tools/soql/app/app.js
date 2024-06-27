import { LightningElement,api,wire,track} from "lwc";
import { isEmpty,runActionAfterTimeOut,isNotUndefinedOrNull,fullApiName } from 'shared/utils';
import FeatureElement from 'element/featureElement';
import { connectStore,store,fetchSObjectsIfNeeded } from 'soql/store';
import { store as appStore,store_application  }  from 'shared/store';

export const isFullPage = true;
export default class App extends FeatureElement {

    @track selectedSObject;
    @track isLeftToggled = true;
    @api namespace;

    connectedCallback() {
        store.dispatch(fetchSObjectsIfNeeded({
            connector:this.connector.conn,
            useToolingApi:false
        }));
        appStore.dispatch(store_application.collapseMenu('soql'));
    }

    @wire(connectStore, { store })
    storeChange({ ui,sobjects }) {
        if(this.validateSobject(ui?.selectedSObject,sobjects?.data)){
            this.selectedSObject = ui.selectedSObject;
        }else{
            this.selectedSObject = null;
        }
    }

    validateSobject = (selectedSObject,data) => {
        if(!selectedSObject || !data) return false;

        const fullSObjectName = fullApiName(selectedSObject,this.namespace) || '';
        return data.sobjects.find(o => o.name.toLowerCase() === fullSObjectName.toLowerCase());
    }
    /** Events **/

    handleLeftToggleChange = (e) => {
        this.isLeftToggled = e.detail.value;
    }

    /** Getters **/
    
    get sobjectsPanelClass() {
        return this.selectedSObject ? 'slds-hide' : '';
    }

    get isFieldsPanelDisplayed(){
        return isNotUndefinedOrNull(this.selectedSObject);
    }


}