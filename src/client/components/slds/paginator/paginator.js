import { LightningElement, api} from 'lwc';
import { classSet,isNotUndefinedOrNull,timeout } from "shared/utils";

const DELAY = 300;
const recordsPerPage = [10,25,50,100,150];
const pageNumber = 1;


export default class Paginator extends LightningElement {
    @api showSearchBox = false; //Show/hide search box; valid values are true/false
    @api filterField = 'Name';
    @api autoHide = false;
    @api customText;

    @api recordsPerPage = recordsPerPage;
    @api hideRecordPerPage = false;

    //No.of records to be displayed per page
    @api
    get pageSize(){
        return this._pageSize;
    }
    set pageSize(value){
        this._pageSize = recordsPerPage.includes(value)?value:recordsPerPage[0];
    }



    pageSizeOptions = [] //Page size options; valid values are array of integers
    totalPages; //Total no.of pages
    pageNumber = pageNumber; //Page number
    searchKey; //Search Input


    showPagination;


    recordsToDisplay = []; //Records to be displayed on the page
    _records = [];
    _pageSize = recordsPerPage[0];


    @api
    get records(){
        return this._records;
    }
    set records(value){
        if(isNotUndefinedOrNull(value)){
            this._records = value;
            this.setRecordsToDisplay();
        }

    }

    //Called after the component finishes inserting to DOM
    connectedCallback() {
        this.showPagination = true;
        this.pageSizeOptions = recordsPerPage.map(item => {
            return {size:item,selected:item == this.pageSize}
        });

        this.setRecordsToDisplay();
    }

    handleRecordsPerPage(event){
        this.pageSize = parseInt(event.target.value);
        this.setRecordsToDisplay();
    }
    handlePageNumberChange(event){
        if(event.keyCode == 13){
            this.pageNumber = event.target.value;
            this.setRecordsToDisplay();
        }
    }
    previousPage(){
        this.pageNumber = this.pageNumber-1;
        this.setRecordsToDisplay();
    }
    nextPage(){
        this.pageNumber = this.pageNumber+1;
        this.setRecordsToDisplay();
    }


    setRecordsToDisplay(){
        this.recordsToDisplay = [];
        if(!this.pageSize){
            this.pageSize = this._records.length;
        }
        this.totalPages = Math.ceil(this._records.length/this.pageSize) == 0 ? 1 : Math.ceil(this._records.length/this.pageSize);

        this.setPaginationControls();

        for(let i=(this.pageNumber-1)*this.pageSize; i < this.pageNumber*this.pageSize; i++){
            if(i == this._records.length) break;
            this.recordsToDisplay.push(this.records[i]);
        }
        timeout(1).then(() => {
            this.dispatchEvent(new CustomEvent('paginatorchange', {detail: this.recordsToDisplay})); //Send records to display on table to the parent component
        })
    }

    setPaginationControls(){
        //Control Pre/Next buttons visibility by Page number
        if(this.pageNumber <= 1){
            this.pageNumber = 1;
        }else if(this.pageNumber >= this.totalPages){
            this.pageNumber = this.totalPages;
        }
    }


    get computedContainer(){
        return classSet('slds-grid slds-grid_vertical-align-center slds-grid_align-spread')
            .add({
                'slds-hidden':this.autoHide && this._records.length <= recordsPerPage[0]
            }).toString()
    }

    get computedPrevious(){
        return classSet()
            .add({
                'slds-hidden':this.pageNumber <= 1
            })
            .toString();
    }

    get computedPagination(){
        return classSet()
            .add({
                'slds-hidden':!this.showPagination
            })
            .toString();
    }

    get computedRecordPerPage(){
        return classSet('slds-list_inline slds-p-bottom_xx-small customSelect')
            .add({
                'slds-hidden':!this.showPagination || this.hideRecordPerPage
            })
            .toString();
    }

    get formattedRecordsPerPageTitle(){
        return this.customText || 'Records per page:';
    }



    handleKeyChange(event) {
        event.stopPropagation();
        window.clearTimeout(this.delayTimeout);
        const searchKey = event.target.value;
        if(searchKey){
            this.delayTimeout = setTimeout(() => {
                //this.showPagination = false;
                this.setPaginationControls();

                this.searchKey = searchKey;
                //Use other field name here in place of 'Name' field if you want to search by other field
                //this.recordsToDisplay = this.records.filter(rec => rec.includes(searchKey));
                //Search with any column value (Updated as per the feedback)
                //this.recordsToDisplay = this.records.filter(rec => JSON.stringify(rec).includes(searchKey));
                this.recordsToDisplay = this.records.filter(rec => isNotUndefinedOrNull(rec[this.filterField]) && rec[this.filterField].includes(searchKey));
                if(Array.isArray(this.recordsToDisplay) && this.recordsToDisplay.length > 0){
                    timeout(1).then(() => {
                        this.dispatchEvent(new CustomEvent('paginatorchange', {detail: this.recordsToDisplay})); //Send records to display on table to the parent component
                    })
                }

            }, DELAY);
        }else{
            this.showPagination = true;
            this.setRecordsToDisplay();
        }
    }
}