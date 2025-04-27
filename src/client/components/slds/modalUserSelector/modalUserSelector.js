import LightningModal from 'lightning/modal';
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { isEmpty } from 'shared/utils';

import { api, track } from 'lwc';

const SVG_CHECKED =
    '<svg enable-background="new 0 0 24 24" height="14" width="14" viewBox="0 0 24 24" xml:space="preserve" lwc-1ctolp3d4fm=""><path fill="#2DC214" clip-rule="evenodd" d="M21.652,3.211c-0.293-0.295-0.77-0.295-1.061,0L9.41,14.34  c-0.293,0.297-0.771,0.297-1.062,0L3.449,9.351C3.304,9.203,3.114,9.13,2.923,9.129C2.73,9.128,2.534,9.201,2.387,9.351  l-2.165,1.946C0.078,11.445,0,11.63,0,11.823c0,0.194,0.078,0.397,0.223,0.544l4.94,5.184c0.292,0.296,0.771,0.776,1.062,1.07  l2.124,2.141c0.292,0.293,0.769,0.293,1.062,0l14.366-14.34c0.293-0.294,0.293-0.777,0-1.071L21.652,3.211z" fill-rule="evenodd" lwc-1ctolp3d4fm=""></path></svg>';
const SVG_UNCHECKED =
    '<svg enable-background="new 0 0 24 24" height="14" width="14" viewBox="0 0 24 24" xml:space="preserve" lwc-1ctolp3d4fm=""><path fill="#CE1515" d="M22.245,4.015c0.313,0.313,0.313,0.826,0,1.139l-6.276,6.27c-0.313,0.312-0.313,0.826,0,1.14l6.273,6.272  c0.313,0.313,0.313,0.826,0,1.14l-2.285,2.277c-0.314,0.312-0.828,0.312-1.142,0l-6.271-6.271c-0.313-0.313-0.828-0.313-1.141,0  l-6.276,6.267c-0.313,0.313-0.828,0.313-1.141,0l-2.282-2.28c-0.313-0.313-0.313-0.826,0-1.14l6.278-6.269  c0.313-0.312,0.313-0.826,0-1.14L1.709,5.147c-0.314-0.313-0.314-0.827,0-1.14l2.284-2.278C4.308,1.417,4.821,1.417,5.135,1.73  L11.405,8c0.314,0.314,0.828,0.314,1.141,0.001l6.276-6.267c0.312-0.312,0.826-0.312,1.141,0L22.245,4.015z" lwc-1ctolp3d4fm=""></path></svg>';

export default class ModalUserSelector extends LightningModal {
    @api conn;

    @track records = [];
    @track offset = 0;
    @track columns = [
        {
            label: '',
            type: 'customSelectionCell',
            wrapText: true,
            typeAttributes: {
                recordId: { fieldName: 'Id' },
                checked: { fieldName: '_selected' },
                label: { fieldName: 'Username' },
                excluded: { fieldName: '_excluded' },
            },
            fixedWidth: 50,
        },
        { label: 'First Name', fieldName: 'FirstName', type: 'text', sortable: true },
        { label: 'Last Name', fieldName: 'LastName', type: 'text', sortable: true },
        { label: 'Email', fieldName: 'Email', type: 'text', sortable: true },
        { label: 'Username', fieldName: 'Username', type: 'text', wrapText: true, sortable: true },
        { label: 'Profile', fieldName: '_profile', type: 'text', wrapText: true, sortable: true },
    ];

    isLoading = false;
    loadMoreStatus;
    lastSearchParam;

    // Table
    selected = [];

    connectedCallback() {
        this.loadUsers();
    }

    handleCloseClick() {
        //this.close('canceled');
        this.close({ action: 'cancel' });
    }

    closeModal() {
        this.close({ action: 'cancel' });
    }

    /** events **/

    handleSearch = e => {
        this._enableInfiniteLoading = true;
        //this.lastSearchParam = e.detail.search;
        this.search(e.detail.search, 0);
    };

    /** Methods **/

    loadTable = async () => {
        if (this.tableInstance) {
            this.tableInstance.destroy();
        }

        let colModel = [
            {
                formatter: 'rowSelection',
                titleFormatter: 'rowSelection',
                hozAlign: 'center',
                vertAlign: 'middle',
                headerSort: false,
                cellClick: function (e, cell) {
                    cell.getRow().toggleSelect();
                },
            },
            //{ title: '', vertAlign: "middle",hozAlign:"center", field: 'link', width: 15, formatter: "html", headerSort: false},
            {
                title: 'First Name',
                vertAlign: 'middle',
                field: 'FirstName',
                resizable: true,
                width: 150,
                cellClick: function (e, cell) {
                    cell.getRow().toggleSelect();
                },
            },
            {
                title: 'Last Name',
                vertAlign: 'middle',
                field: 'LastName',
                resizable: true,
                width: 170,
                cellClick: function (e, cell) {
                    cell.getRow().toggleSelect();
                },
            },
            {
                title: 'Email',
                vertAlign: 'middle',
                field: 'Email',
                resizable: true,
                cellClick: function (e, cell) {
                    cell.getRow().toggleSelect();
                },
            },
            {
                title: 'Username',
                vertAlign: 'middle',
                field: 'Username',
                resizable: true,
                cellClick: function (e, cell) {
                    cell.getRow().toggleSelect();
                },
            },
            {
                title: 'Profile',
                vertAlign: 'middle',
                field: '_profile',
                resizable: true,
                width: 170,
                cellClick: function (e, cell) {
                    cell.getRow().toggleSelect();
                },
            },
            {
                title: 'Active',
                vertAlign: 'middle',
                hozAlign: 'center',
                field: 'IsActive',
                resizable: true,
                width: 75,
                cellClick: function (e, cell) {
                    cell.getRow().toggleSelect();
                },
                formatter: function (cell, formatterParams, onRendered) {
                    if (typeof cell.getValue() == 'boolean') {
                        return cell.getValue() ? SVG_CHECKED : SVG_UNCHECKED;
                    } else {
                        return cell.getValue();
                    }
                },
            },
            /*{ title: 'User List', field: 'users', width: 110, hozAlign: "center",
				formatter: function(cell, formatterParams, onRendered){
					return cell.getValue().isShow ? `<a data-id="${cell.getValue().profileId}" class="showUsers ui teal small label" type="button">${'View'}</a>` : '';
				}
			},*/
        ];

        const dataList = this.records;
        //console.log('dataList',dataList);
        this.tableInstance = new Tabulator(this.template.querySelector('.custom-table'), {
            maxHeight: '100%',
            data: dataList,
            layout: 'fitDataTable',
            columns: colModel,
            columnHeaderVertAlign: 'middle',
            /*TODO group all select/deselect
            groupHeader: function(value, count, data, group){
                return "<input type='checkbox' />" + value + "<span style='color:#d00; margin-left:10px;'>(" + count + " item)</span>";
            },
            */
            selectableCheck: function (row) {
                return row.getData()['label'] != null;
            },
        });

        this.tableInstance.on('tableBuilt', () => {
            this.tableInstance.selectRow(
                this.tableInstance.getRows().filter(row => this.selected.includes(row.getData().Id))
            );
        });
    };

    loadUsers = async () => {
        this.isLoading = true;
        let query = this.conn.query(
            `SELECT id,Username,Name,Email,FirstName,LastName,Profile.Name,IsActive FROM User`
        );
        let records =
            (await query.run({ responseTarget: 'Records', autoFetch: true, maxFetch: 500 })) || [];

        this.records = records.map(x => ({
            ...x,
            ...{
                _profile: x?.Profile?.Name || '',
                _selected: false,
            },
        }));

        this.loadTable();
        this.isLoading = false;
    };
}
