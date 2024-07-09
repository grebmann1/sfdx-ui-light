import { LightningElement,api,wire,track} from "lwc";
import { isEmpty,runActionAfterTimeOut,isNotUndefinedOrNull,fullApiName } from 'shared/utils';
import ToolkitElement from 'core/toolkitElement';
import { store as appStore,store_application  }  from 'shared/store';
import { store,connectStore,SELECTORS,DESCRIBE,UI } from 'core/store';

export const isFullPage = true;
export default class App extends ToolkitElement {

    @track selectedSObject;
    @track isLeftToggled = true;
    @track isRecentToggled = false;
    @api namespace;

    connectedCallback() {
        store.dispatch(DESCRIBE.describeSObjects({
            connector:this.connector.conn,
            useToolingApi:false
        }));
        store.dispatch(DESCRIBE.describeSObjects({
            connector:this.connector.conn,
            useToolingApi:true
        }));
        appStore.dispatch(store_application.collapseMenu('soql'));
    }

    @wire(connectStore, { store })
    storeChange({ ui,describe }) {
        if(ui && ui.hasOwnProperty('useToolingApi')){
            this._useToolingApi = ui.useToolingApi;
        }

        const sobjects = SELECTORS.describe.selectById({describe},DESCRIBE.getDescribeTableName(this._useToolingApi));
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

    handleLeftToggle = (e) => {
        this.isLeftToggled = !this.isLeftToggled;
    }

    handleRecentToggle = (e) => {
        this.isRecentToggled = !this.isRecentToggled;
    }

    /** Getters **/
    
    get sobjectsPanelClass() {
        return this.selectedSObject ? 'slds-hide' : '';
    }

    get isFieldsPanelDisplayed(){
        return isNotUndefinedOrNull(this.selectedSObject);
    }

    get toggleLeftIconName(){
        return this.isLeftToggled?'utility:toggle_panel_right':'utility:toggle_panel_left';
    }

    get toggleRecentIconName(){
        return this.isRecentToggled?'utility:toggle_panel_right':'utility:toggle_panel_left';
    }


}