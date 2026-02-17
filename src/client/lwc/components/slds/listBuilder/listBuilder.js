/**
 * Created by grebmann on 24.03.23.
 */

import { LightningElement, api, track } from 'lwc';
import { runActionAfterTimeOut } from 'shared/utils';

export default class ListBuilder extends LightningElement {
    @api isLoading = false;
    @api idField = 'id';
    @api records = [];
    @api totalRecords;
    @api columns = [];
    @api toExclude = [];

    @track selection = [];
    @track timer;
    @track _helpMessage;

    searchTerms;
    @api loadMoreStatus;
    @api enableInfiniteLoading;

    @api required = false;
    @api disabled = false;

    @api usePaginator = false;
    @track paginatedData = [];

    /** Labels **/

    @api searchLabel = 'Search';

    /** Events **/

    handleChange = e => {
        let searchTerm = e.target.value;

        runActionAfterTimeOut(
            searchTerm,
            param => {
                this.searchTerms = param;
                this.dispatchEvent(
                    new CustomEvent('search', {
                        composed: true,
                        bubbles: true,
                        cancelable: true,
                        detail: {
                            search: param,
                        },
                    })
                );
            },
            { timeout: 300, key: 'slds.listBuilder.search' }
        );
    };

    handleRowSelection = e => {
        const { name, checked, label } = e.detail;
        if (checked) {
            if (!this.selection.find(x => x.name == name)) {
                this.selection.push({ name, label });
            }
        } else {
            this.selection = this.selection.filter(x => x.name != name);
        }
        this.dispatchEvent(new CustomEvent('change', { detail: { value: this.selection } }));
    };

    handleItemRemove = e => {
        this.selection = this.selection.filter(x => x.name != e.detail.item.name);
    };

    loadMoreData = e => {
        this.dispatchEvent(
            new CustomEvent('loadmoredata', {
                composed: true,
                bubbles: true,
                cancelable: true,
                detail: {},
            })
        );
    };

    /** Method **/

    @api
    get selectedItems() {
        return this.selection;
    }

    checkIfSelected = id => {
        return this.selection.findIndex(x => x.name == id) > -1;
    };

    checkIfExcluded = id => {
        return this.toExclude.includes(id);
    };

    /** Getters **/

    get selectedItemsTotal() {
        return this.selection.length;
    }

    get totalRecordsLength() {
        return this.totalRecords ? this.totalRecords : this.records.length;
    }
    get recordsLength() {
        return this.records.length;
    }

    get displayEmptyMessage() {
        return this.records.length == 0 && !this.isLoading;
    }

    get formattedData() {
        return this.records.map(x => ({
            ...x,
            ...{
                _selected: this.checkIfSelected(x[this.idField]),
                _excluded: this.checkIfExcluded(x[this.idField]) || x._excluded, // Can be pre excluded
            },
        }));
    }

    get datatableData() {
        return this.usePaginator ? this.paginatedData : this.formattedData;
    }

    /** Paginator **/

    handlePaginatorChange = e => {
        e.stopPropagation();
        this.paginatedData = e.detail;
    };
}
