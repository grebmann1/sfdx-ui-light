import { api,track,wire } from "lwc";
import ToolkitElement from 'core/toolkitElement';
import { lowerCaseKey,isUndefinedOrNull,isNotUndefinedOrNull,isEmpty,guid,classSet,runActionAfterTimeOut,compareString,splitTextByTimestamp } from 'shared/utils';
import { store,connectStore,PACKAGE,SELECTORS } from 'core/store';
import { VIEWERS } from 'api/utils';
import Toast from 'lightning/toast';
import moment from 'moment';
import ModalDeploy from "package/modalDeploy";


export default class Deploy extends ToolkitElement {

    _hasRendered = false;

    // requests
    @track requests = [];

    _selectedItem;
    get selectedItem() {
        return this._selectedItem;
    }

    set selectedItem(value) {
        if(this._hasRendered){
            const inputEl = this.refs?.response?.currentModel;
            if (inputEl && this._selectedItem != value){
                inputEl.setValue(isUndefinedOrNull(value)?'':this.formatObjectToJson(value));
            }
        }
        this._selectedItem = value;
    }

    isLoading = false;
    isLoadingSpecificRequest = false;


    // Viewer
    viewer_value = VIEWERS.PRETTY;

    // Models
    responseModel;


    @wire(connectStore, { store })
    storeChange({ package2,application }) {
        const isCurrentApp = this.verifyIsActive(application.currentApplication);
        if(!isCurrentApp) return;
    }

    connectedCallback(){
        this.fetchLatestRequests(true);
    }

    renderedCallback(){
        this._hasRendered = true;
    }

    /** Methods  **/

    @api
    run = () => {
        ModalDeploy.open({
            connector:this.connector,
            size:'full'
        }).then(res => {
            this.fetchLatestRequests(true);
        })
    }


    // Request monitoring

    fetchLatestRequests = async (includeSpinner) => {
        if(includeSpinner){
            this.isLoading = true;
        }
        try{
            const query = `
                SELECT Id, Type, Status, NumberTestErrors, NumberTestsCompleted, NumberComponentsTotal,
                    NumberComponentErrors, NumberComponentsDeployed, StartDate, CompletedDate, ErrorMessage, CreatedDate, NumberTestsTotal,
                    LastModifiedDate, IsDeleted, ChangeSetName, StateDetail, ErrorStatusCode, RunTestsEnabled, RollbackOnError,
                    IgnoreWarnings, CheckOnly, CanceledById,CanceledBy.Name, AllowMissingFiles, AutoUpdatePackage, PurgeOnDelete, SinglePackage,
                    TestLevel, LastModifiedBy.Name, CreatedBy.Name
                FROM DeployRequest
                WHERE CreatedDate = THIS_WEEK
                ORDER BY CreatedDate DESC
                LIMIT 100
            `;
            this.requests = (await this.connector.conn.tooling.query(query)).records;
            if(this.selectedItem?.Id){
                const _index = this.requests.findIndex(x => x.Id === this.selectedItem.Id);
                if(_index >= 0){
                    this.selectedItem = this.cleanRestResponse(this.requests[_index]);
                }
            }
        }catch(e){
            console.error(e);
        }
        this.isLoading = false;
    }

    cleanRestResponse = (obj) =>{
        if (Array.isArray(obj)) {
            return obj.map(item => this.cleanRestResponse(item));
        } else if (typeof obj === 'object' && obj !== null) {
            return Object.keys(obj).reduce((acc, key) => {
            if (key !== 'attributes') {
                acc[key] = this.cleanRestResponse(obj[key]);
            }
            return acc;
          }, {});
        }
        return obj;
    }

    formatObjectToJson = (obj) => {
        return JSON.stringify(obj, null, 4);
    }


    /** Events **/

    handleAbort = async (e) => {//CanceledBy
        try{
            const cancelResult = await this.connector.conn.metadata._invoke('cancelDeploy', { id:this.selectedItem.Id });
            this.fetchLatestRequests();
        }catch(e){
            Toast.show({
                label: e.message,
                variant: 'error',
                mode: 'dismissible',
            });
        }
    }

    handleRefresh = (e) => {
        const { includeSpinner } = e.detail;
        this.fetchLatestRequests(includeSpinner);
    }

    handleItemSelection = (e) => {
        e.preventDefault();
        e.stopPropagation();

        // Cleanup the data before showing it:
        this.selectedItem = this.cleanRestResponse(e.detail.value);
    }

    handleResponseLoad = (e) => {
        this.responseModel = this.refs.response.createModel({
            body:this.formattedResponse,
            language:'json'
        });
        this.refs.response.displayModel(this.responseModel);
    }

    viewer_handleChange = (e) => {
        this.viewer_value = e.detail.value;
    }



    /** Getters **/

    get isItemSelected(){
        return isNotUndefinedOrNull(this.selectedItem);
    }

    get rightSlotClass(){
        return classSet('slds-full-height slds-full-width slds-flex-column').toString();
    }

    // Viewers

    get prettyContainerClass(){
        return classSet("slds-full-height slds-scrollable_y").add({'slds-hide':!(this.viewer_value === VIEWERS.PRETTY)}).toString();
    }

    get rawContainerClass(){
        return classSet("slds-full-height slds-scrollable_y").add({'slds-hide':!(this.viewer_value === VIEWERS.RAW)}).toString();
    }

    get viewer_options(){
        return [VIEWERS.PRETTY,VIEWERS.RAW].map(x => ({value:x,label:x}))
    }

    get formattedResponse(){
        return this.formatObjectToJson(this.selectedItem);
    }

    get abortLabel(){
        return isUndefinedOrNull(this.selectedItem.CanceledById)?this.i18n.EDITOR_PANEL_ABORT:this.i18n.EDITOR_PANEL_ABORTING;
    }

    get isAbortDisabled(){
        return !['InProgress','Pending'].includes(this.selectedItem?.Status) || isNotUndefinedOrNull(this.selectedItem?.CanceledById);
    }

}