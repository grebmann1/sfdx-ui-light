import { createElement,LightningElement,api} from "lwc";

import {TabulatorFull as Tabulator} from "tabulator-tables";
import {runActionAfterTimeOut,isEmpty,isNotUndefinedOrNull} from 'shared/utils';
import {
    getRecordId,getCurrentTab,getCurrentObjectType,
    fetch_data,fetch_metadata
} from "extension/utils";
import RecordExplorerCell from 'extension/recordExplorerCell';

export default class RecordExplorer extends LightningElement {

    @api versions = [];

    tableInstance;
    isLoading = false;

    currentTab;

    // record data
    sobjectName;
    metadata;
    recordId;
    record;
    // for table
    data;
    filter = '';
    isError = false;


    async connectedCallback(){
        try{
            this.isError = false;
            let conn = window.connector;
            this.currentTab = await getCurrentTab();
            this.contextUrl = window.location.href;
            // Get recordId (Step 1)
            this.recordId = getRecordId(this.currentTab.url);
            // Get sobjectName (Step 2) // Should be optimized to save 1 API Call [Caching]
            this.sobjectName = await getCurrentObjectType(conn,this.recordId);
            // Get Metadata (Step 3) // Should be optimized to save 1 API Call [Caching]
            this.metadata = await fetch_metadata(conn,this.sobjectName);
            // Get data
            this.record = await fetch_data(conn,this.sobjectName,this.recordId);

            console.log('recordId',this.recordId);
            console.log('sobjectName',this.sobjectName);
            console.log('metadata',this.metadata);
            console.log('record',this.record);
            this.data = this.formatData();
            runActionAfterTimeOut(null,(param) => {
                this.createTable();
            });
        }catch(e){
            console.error(e);
            this.isError = true;
        }
        
    }

    formatData = () => {
        return this.metadata.fields.map( x => {
            let {label,name,type} = x;
            return {
                name,label,type,
                value:this.record.hasOwnProperty(name)?this.record[name]:null
            }
        }).sort((a, b) => a.label.localeCompare(b.label));
    }

    formatterField = (cell,formatterParams,onRendered) => {
        let field = cell._cell.value;
        if(isEmpty(this.filter)){
            return field;
        }
        
        var regex = new RegExp('('+this.filter+')','gi');
        if(regex.test(field)){
            return field.toString().replace(/<?>?/,'').replace(regex,'<span style="font-weight:Bold; color:blue;">$1</span>');
        }else{
            return field;
        }
    }

    formatterValue = (cell, formatterParams, onRendered) => {
        let data = cell._cell.row.data;
        const element = createElement('extension-record-explorer-cell', {
            is: RecordExplorerCell
        });
        Object.assign(element, {
            ...data,
            ...{
                filter:this.filter
            }
        });
        return element;
        //return "Mr" + cell.getValue(); //return the contents of the cell;
    }

    handleSearchInput = (e) => {
        let val = e.currentTarget.value;
        console.log('val',val);
        runActionAfterTimeOut(val,(newValue) => {
            this.updateTable(newValue);
        });
    }

    filtering = (arr) => {
    
        var items = [];
        var regex = new RegExp('('+this.filter+')','i');
        for(var key in arr){
            var item = arr[key];
            if(typeof item.value == 'object' && item.value !== null){
                item.value = JSON.stringify(item.value, null, 2);
            }
    
            if(this.filter === 'false' && item.value === false || this.filter === 'true' && item.value === true || this.filter === 'null' && item.value === null){
                items.push(item);
                continue;
            }
              
            if(item.value != false && item.value != true && regex.test(item.value) || regex.test(item.name) || regex.test(item.label)){
                items.push(item);
                continue;
            }
        }
    
       return items;
    }

    updateTable = (newValue) => {
        this.filter = newValue;
        this.tableInstance.replaceData(this.formattedData)
        .then(function(){
            //run code after table has been successfully updated
        })
        .catch(function(error){
            console.log('error',error);
        });
    }


    createTable = () => {

        let colModel = [
            { title: 'Field Label'  , field: 'label'    , width:200,  headerHozAlign: "center", resizable: true ,formatter:this.formatterField},
            { title: 'ApiName'      , field: 'name'     , width:200,  headerHozAlign: "center", resizable: true ,formatter:this.formatterField,
                tooltip:(e, cell, onRendered) => {
                    //e - mouseover event
                    //cell - cell component
                    //onRendered - onRendered callback registration function
                    let metadata = this.metadata.fields.find(x => x.name === cell.getValue());
                    return `Type: ${metadata.type}`;
                }
            },
            { title: 'Value'        , field: 'value'    ,  headerHozAlign: "center", resizable: true ,formatter:this.formatterValue}
        ];

        if (this.tableInstance) {
			this.tableInstance.destroy();
		}

        console.log('window.innerHeight',window.innerHeight);

		this.tableInstance = new Tabulator(this.template.querySelector(".custom-table"), {
			height: 424,
			data: this.formattedData,
			layout:"fitColumns",
			columns: colModel,
			columnHeaderVertAlign: "middle",
            downloadConfig:{
                rowGroups:false, //do not include row groups in downloaded table
            },
		});
    }


    /** Getters */

    get formattedData(){
        return this.filtering(this.data);
    }

    get isRecordIdAvailable(){
        return isNotUndefinedOrNull(this.recordId) && !this.isError;
    }

    get versions_options(){
        return this.versions.map(x => ({
            label:x.label,
            value:x.version
        }));
    }

}