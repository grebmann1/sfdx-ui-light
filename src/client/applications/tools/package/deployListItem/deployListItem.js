import { api,track,wire } from "lwc";
import { decodeError,isNotUndefinedOrNull,classSet } from 'shared/utils';
import ToolkitElement from 'core/toolkitElement';
import moment from 'moment';


export default class Message extends ToolkitElement {

    isLoading = false;

    _item
    @api 
    get item(){
        return this._item;
    }
    set item(value){
        this._item = value;
        if(value){
            this.enableAutoDate();
        }
    }


    @api selectedItemId;

    _formattedCreatedDate;
    _formattedDurationDate
    _interval;

   

    connectedCallback(){}

    disconnectedCallback(){
        clearInterval(this._interval);
    }


    /** Events **/

    handleItemSelection = (e) => {
        e.preventDefault();
        this.dispatchEvent(new CustomEvent("select", { 
            detail:{value:this.item},
            bubbles: true,composed: true 
        }));
    }

    /** Methods  **/

    calculatePercentage = (part, total) => {
        if (total === 0) return 0; // Avoid division by zero
        return Math.floor((part / total) * 100);
    }

    formatDate = () => {
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

    get isSuccess(){
        return this.item.Status === 'Succeeded';
    }

    get isFailure(){
        return this.item.Status === 'Failed' || this.item.Status === 'Canceled';
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
            'slds-is-active':this.item.Id == this.selectedItemId,
            'slds-is-failure':this.isFailure,
            'slds-is-success':this.isSuccess,
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