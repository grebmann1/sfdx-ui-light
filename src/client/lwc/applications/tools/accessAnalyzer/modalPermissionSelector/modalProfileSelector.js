import LightningModal from 'lightning/modal';
import { TabulatorFull as Tabulator } from 'tabulator-tables';

import { api } from 'lwc';

export default class ModalProfileFilter extends LightningModal {
    @api profiles;
    @api currentOrg;
    @api selected;

    tableInstance;

    connectedCallback() {
        window.setTimeout(() => {
            this.loadTable();
        }, 1);

        //console.log('currentOrg',JSON.stringify(this.currentOrg));
    }

    handleCloseClick() {
        //this.close('canceled');
        this.close({ action: 'cancel' });
    }

    closeModal() {
        this.close({ action: 'cancel' });
    }

    /** events **/

    handleApplyClick = e => {
        this.close({
            action: 'select',
            filter: this.tableInstance.getSelectedData().map(x => x.profileId),
        });
    };

    /** Methods **/

    /** Tabulator  **/

    loadTable = async () => {
        let activeUserIcon = '<i class="user icon"></i>';
        let inactiveUserIcon = '<i class="user outline icon"></i>';

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
            {
                title: 'Profile Name',
                vertAlign: 'middle',
                field: 'label',
                width: 430,
                tooltip: true,
                cellClick: function (e, cell) {
                    cell.getRow().toggleSelect();
                },
            },
            {
                title: 'Active User',
                field: 'activeUserCount',
                width: 140,
                hozAlign: 'center',
                bottomCalc: 'sum',
                formatter: function (cell, formatterParams, onRendered) {
                    return (
                        (cell.getValue() > 0 ? activeUserIcon : inactiveUserIcon) +
                        cell.getValue() +
                        ''
                    );
                },
                cellClick: function (e, cell) {
                    cell.getRow().toggleSelect();
                },
            },
            {
                title: 'Inactive User',
                field: 'inactiveUserCount',
                width: 140,
                hozAlign: 'center',
                bottomCalc: 'sum',
                formatter: function (cell, formatterParams, onRendered) {
                    return (
                        (cell.getValue() > 0 ? activeUserIcon : inactiveUserIcon) +
                        cell.getValue() +
                        ''
                    );
                },
                cellClick: function (e, cell) {
                    cell.getRow().toggleSelect();
                },
            },
        ];

        let dataList = [];

        Object.values(this.profiles)
            .sort((a, b) => a.name.localeCompare(b.name))
            .forEach(profile => {
                let _activeUserCount = profile.activeUserCount || 0;
                let _inactiveUserCount = profile.inactiveUserCount || 0;

                let data = {};
                data['profileId'] = profile.id;
                //data['link'] = `<a href="${null}" target="_blank"><svg focusable="false" aria-hidden="true" class="slds-icon slds-icon-text-default slds-icon_x-small"><use xlink:href="/assets/icons/utility-sprite/svg/symbols.svg#new_window"></use></svg></a>`;
                data['label'] = profile.name;
                //data['profileUrl'] = null;
                data['activeUserCount'] = _activeUserCount;
                data['inactiveUserCount'] = _inactiveUserCount;
                data['licenseName'] = profile.userLicense;
                //data['users'] = {isShow: _activeUserCount + _inactiveUserCount > 0, profileId: profile.id};

                dataList.push(data);
            });

        if (this.tableInstance) {
            this.tableInstance.destroy();
        }

        this.tableInstance = new Tabulator(this.template.querySelector('.custom-table'), {
            height: 'auto',
            data: dataList,
            layout: 'fitDataFill',
            columns: colModel,
            columnHeaderVertAlign: 'middle',
            groupBy: 'licenseName',
            groupToggleElement: true,
            selectableRows: 1,
            selectableCheck: function (row) {
                return row.getData()['label'] != null;
            },
        });

        this.tableInstance.on('tableBuilt', () => {
            this.tableInstance.selectRow(
                this.tableInstance
                    .getRows()
                    .filter(row => this.selected.includes(row.getData().profileId))
            );
        });
    };
}
