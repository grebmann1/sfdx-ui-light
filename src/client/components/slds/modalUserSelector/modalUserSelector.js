import LightningModal from 'lightning/modal';
import {isEmpty} from "shared/utils";

import { api,track } from "lwc";


export default class ModalUserSelector extends LightningModal {

    @api applicationId;

    @track records = [];
    @track offset = 0;
    @track columns = [
        {label : '',     type : 'customSelectionCell',wrapText: true,
            typeAttributes: {
                recordId:{fieldName : 'id'},
                checked:{fieldName:'_selected'},
                label:{fieldName:'username'},
                excluded:{fieldName:'_excluded'}
            },
            fixedWidth: 50,
        },
        {label : 'First Name',    fieldName : 'firstName', type : 'text',sortable: true},
        {label : 'Last Name',    fieldName : 'lastName', type : 'text',sortable: true},
        {label : 'Email',    fieldName : 'email', type : 'text',sortable: true},
        {label : 'Username',    fieldName : 'username', type : 'text',wrapText:true,sortable: true}
    ];


	isDatatableLoading = false;
    isLoading = false;
    _enableInfiniteLoading = true;
    _lastSearchResultSize = 0;
    loadMoreStatus;
    lastSearchParam;

    connectedCallback(){}

    handleCloseClick() {
        //this.close('canceled');
		this.close({action:'cancel'});
    }

    closeModal() {
        this.close({action:'cancel'});
    }


    /** events **/

    handleSearch = (e) => {
        this._enableInfiniteLoading = true;

        this.lastSearchParam = e.detail.search;
        this.search(e.detail.search,0);
    }

	

	/** Methods **/

    loadMoreData = async (e) => {
        //Display a spinner to signal that data is being loaded
        this.isDatatableLoading = true;
        //Display "Loading" when more data is being loaded
        this.loadMoreStatus = 'Loading';

        // Still records to load
        // Using this technic as Anypoint can return only 10 records instead of 100 if the 90 are disabled and the offset/limit wouldn't work that way.
        // Call with offset 0 and size 100, return 99 but if we do offset 1 and size 100, will return 100 as it will avoid the first one.
        if(this._lastSearchResultSize > 0){
            // We only search if there is an offset
            await this.search(this.lastSearchParam,this.offset);
            this.loadMoreStatus = '';
        }

        // We disable the infinite loading if it's entirely loaded
        if(this._lastSearchResultSize == 0){
            this._enableInfiniteLoading = false;
            this.loadMoreStatus = 'No more data to load';
        }

        this.isDatatableLoading = false;
    }

    reset = () => {
        this.loadMoreStatus = null;
        this.lastSearchParam = null;
        this.records = [];
        this.search(null,0);
    }

    search = async (searchParam,offset) => {
        let size = 100;
        this.isDatatableLoading = true;
        let res = await this.searchUsers({search:searchParam,offset,size});
        //console.log('res',JSON.parse(JSON.stringify(res)));
        this.isDatatableLoading = false;

        if(res){
            if(offset > 0){
                this.records = this.records.concat([...this.formatData(res)]);
            }else{
                this.records = [...this.formatData(res)];
            }
            this.offset = offset + size; // Explained above, we can't rely on the result length ! (bug in anypoint)
            this._lastSearchResultSize = res.length;
        }
    }

    searchUsers = ({search,offset,size}) => {

    }

    /** Getters */
    get filteredRecords(){
        return this.records;
    }


    
}