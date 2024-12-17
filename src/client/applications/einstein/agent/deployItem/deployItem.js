import { api,track,wire } from "lwc";
import { decodeError,isUndefinedOrNull,isNotUndefinedOrNull,classSet } from 'shared/utils';
import ToolkitElement from 'core/toolkitElement';
import moment from 'moment';
import { store,store_application } from 'shared/store';


export default class DeployItem extends ToolkitElement {

    isLoading = false;

    @track item;

    _recordId
    @api 
    get recordId(){
        return this._recordId;
    }
    set recordId(value){
        if(value && this._recordId != value){
            this._recordId = value;
            this.fetchLatestData().then(x => {
                this.enableAutoDate();
            });
        }
    }
    @api isFullBorder = false;

    _formattedCreatedDate;
    _formattedDurationDate
    _interval;
    _intervalMonitoring;
    _timeLeft;
   

    connectedCallback(){
        this.startCountdown();
    }

    disconnectedCallback(){
        clearInterval(this._interval);
        clearInterval(this._intervalMonitoring);
    }


    /** Events **/

    goToUrl = (e) => {
        e.stopPropagation();
        e.preventDefault();
        const redirectUrl = `/lightning/setup/DeployStatus/page?address=/changemgmt/monitorDeploymentsDetails.apexp?asyncId=${this.item.Id}&retURL=%2Fchangemgmt%2FmonitorDeployment.apexp`;
        //console.log('redirectUrl',redirectUrl);
        store.dispatch(store_application.navigate(redirectUrl));
    }

    handleItemSelection = (e) => {
        e.preventDefault();
        this.dispatchEvent(new CustomEvent("select", { 
            detail:{value:this.item},
            bubbles: true,composed: true 
        }));
    }

    /** Methods  **/

    fetchLatestData = async () => {
        if(isUndefinedOrNull(this._recordId)) return;
        console.log('---> fetchLatestData');
        const query = `
                SELECT Id, Type, Status, NumberTestErrors, NumberTestsCompleted, NumberComponentsTotal,
                    NumberComponentErrors, NumberComponentsDeployed, StartDate, CompletedDate, ErrorMessage, CreatedDate, NumberTestsTotal,
                    LastModifiedDate, IsDeleted, ChangeSetName, StateDetail, ErrorStatusCode, RunTestsEnabled, RollbackOnError,
                    IgnoreWarnings, CheckOnly, CanceledById,CanceledBy.Name, AllowMissingFiles, AutoUpdatePackage, PurgeOnDelete, SinglePackage,
                    TestLevel, LastModifiedBy.Name, CreatedBy.Name
                FROM DeployRequest
                WHERE Id = '${this._recordId}'
            `;
        const result = (await this.connector.conn.tooling.query(query)).records;
        this.item = null;
        this.item = result[0];

        if(this.isSuccess || this.isFailure){
            // We stop the interval here
            clearInterval(this._intervalMonitoring);
        }
    }

    startCountdown = () => {

        this._timeLeft = 10;
        this._intervalMonitoring = setInterval(() => {
            this._timeLeft--;
            if (this._timeLeft <= 0) {
                this.fetchLatestData();
                this._timeLeft = 10; // Reset the countdown
            }
        }, 1000); // Update every second
    }

    refreshData = () => {
        this.dispatchEvent(new CustomEvent("refresh", {
            detail:{includeSpinner:false},
            bubbles: true,composed: true
        }));
    }

    calculatePercentage = (part, total) => {
        if (total === 0) return 0; // Avoid division by zero
        return Math.floor((part / total) * 100);
    }

    formatDate = () => {
        if(isUndefinedOrNull(this.item)) return;
        this._formattedCreatedDate = moment(this.item.CreatedDate).fromNow();
        if(isNotUndefinedOrNull(this.item.StartDate)){
            if(isNotUndefinedOrNull(this.item.CompletedDate)){
                this._formattedDurationDate = moment.duration(moment(this.item.CompletedDate).diff(moment(this.item.StartDate))).humanize();
            }else{
                this._formattedDurationDate = moment.duration(moment().diff(moment(this.item.StartDate))).humanize();
            }
        }
    }

    enableAutoDate = () => {
        this.formatDate();
        this._interval = setInterval(() =>{
            this.formatDate();
        },5000);
    }

    /** Getters */

    get isDisplayed(){
        return isNotUndefinedOrNull(this.item);
    }

    get isSuccess(){
        return this.item.Status === 'Succeeded';
    }

    get isFailure(){
        return this.item.Status === 'Failed' || this.item.Status === 'Canceled' || this.item.Status === 'SucceededPartial';
    }

    get isPending(){
        return this.item.Status === 'Pending';
    }

    get isInProgress(){
        return this.item.Status === 'InProgress';
    }

    get isAborting(){
        return isNotUndefinedOrNull(this.item.CanceledById) && this.isInProgress;
    }

    get itemClass(){
        return classSet("slds-p-left_xx-small slds-p-vertical_xx-small slds-border_bottom item slds-grid")
        .add({
            'slds-is-failure':this.isFailure,
            'slds-is-success':this.isSuccess,
            'slds-border_top slds-border_right slds-border_left':this.isFullBorder
            //'slds-is-running':this.isInProgress
        }).toString();
    }

    get statusClass(){
        return classSet('slds-p-left_small slds-truncate slds-col_bump-left')
        .add({
            'slds-text-color_success':this.isSuccess,
            'slds-text-color_error':this.isFailure,
            'slds-color-orange-light':this.isAborting
        })
        .toString();
    }

    get formattedCreatedDate(){
        return this._formattedCreatedDate;
    }
    
    get formattedDurationDate(){
        return this._formattedDurationDate;
    }

    get formattedStatus(){
        return this.isAborting?'Aborting':this.item.Status;
    }

    get hasTest(){
        return isNotUndefinedOrNull(this.item.NumberTestsTotal) && this.item.NumberTestsTotal > 0;
    }

    get formattedTests(){
        const total = this.item.NumberTestsCompleted + this.item.NumberTestErrors;
        const percentage = this.item.NumberTestsTotal > 0 ? ' ( '+this.calculatePercentage(total,this.item.NumberTestsTotal)+'% )':null;
        return `${total} / ${this.item.NumberTestsTotal}`+(percentage?percentage:'');
    }
    
}