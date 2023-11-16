import LightningModal from 'lightning/modal';
import {TabulatorFull as Tabulator} from 'tabulator-tables';

import { api } from "lwc";


export default class ModalProfileFilter extends LightningModal {
    @api profiles;
    tableInstance;

    connectedCallback(){
        this.loadTable();
    }

    handleCloseClick() {
        this.close('canceled');
    }

    closeModal() {
        this.close('success');
    }


    /** events **/



    /** Tabulator  **/
    
    loadTable = () => {
        let activeUserIcon = '<i class="user icon"></i>';
		let inactiveUserIcon = '<i class="user outline icon"></i>';

		let colModel = [
			{ formatter:"rowSelection", titleFormatter:"rowSelection", hozAlign:"center", vertAlign: "middle", headerSort:false,
				cellClick:function(e, cell) {
					cell.getRow().toggleSelect();
				}
			},
			{ title: '', vertAlign: "middle", field: 'link', width: 15, formatter: "html", headerSort: false},
			{ title: 'ProfileName', vertAlign: "middle", field: 'label', width: 430, tooltip: true,
				cellClick:function(e, cell) {
					cell.getRow().toggleSelect();
				}
			},
			{ title: 'ActiveUser', field: 'activeUserCount', width: 140, hozAlign: "center", bottomCalc:"sum",
				formatter: function(cell, formatterParams, onRendered){
					let icon = cell.getValue() > 0 ? activeUserIcon : inactiveUserIcon;

					return icon + cell.getValue() + 'UserCounteSuffix';
				},
				cellClick:function(e, cell) {
					cell.getRow().toggleSelect();
				},
			},
			{ title: 'InactiveUser', field: 'inactiveUserCount', width: 140, hozAlign: "center", bottomCalc: "sum",
				formatter: function(cell, formatterParams, onRendered){
					let icon = cell.getValue() > 0 ? activeUserIcon : inactiveUserIcon;

					// ～人
					return icon + cell.getValue() + 'UserCounteSuffix';
				},
				cellClick:function(e, cell) {
					cell.getRow().toggleSelect();
				},
			},
			{ title: 'UserList', field: 'users', width: 110, hozAlign: "center",
				formatter: function(cell, formatterParams, onRendered){
					return cell.getValue().isShow ? `<a data-id="${cell.getValue().profileId}" class="showUsers ui teal small label" type="button">${'View'}</a>` : '';
				}
			},
		];

		let datas = [];

		Object.values(this.profiles).forEach(profile => {
            let _activeUserCount = profile.activeUserCount || 0;
            let _inactiveUserCount = profile.inactiveUserCount || 0;

			let data = {};
                data['profileId'] = profile.id;
                data['link'] = `<a href="${null}" target="_blank"><i class="icon external alternate"></i></a>`;
                data['label'] = profile.fullName;
                data['profileUrl'] = null;
                data['activeUserCount'] = _activeUserCount;
                data['inactiveUserCount'] = _inactiveUserCount;
                data['licenseName'] = profile.userLicense;
                data['users'] = {isShow: _activeUserCount + _inactiveUserCount > 0, profileId: profile.id};

			datas.push(data);
		});

        if (this.tableInstance) {
			this.tableInstance.destroy();
		}

		this.tableInstance = new Tabulator(this.template.querySelector(".custom-table"), {
			height: 600,
			data: datas,
			layout: "fitDataFill",
			columns: colModel,
			columnHeaderVertAlign: "middle",
			groupBy: "licenseName",
			groupToggleElement: false,
			/*TODO group all select/deselect
			groupHeader: function(value, count, data, group){
				return "<input type='checkbox' />" + value + "<span style='color:#d00; margin-left:10px;'>(" + count + " item)</span>";
			},
			*/
			selectableCheck : function(row) {
				return row.getData()['label'] != null;
			},
		});

    }

}