import { createElement,api} from "lwc";
import FeatureElement from 'element/featureElement';

import {TabulatorFull as Tabulator} from "tabulator-tables";
import {runActionAfterTimeOut,isEmpty,isNotUndefinedOrNull} from 'shared/utils';
import { getCurrentTab,getCurrentObjectType,fetch_data,fetch_metadata} from "extension/utils";
import RecordExplorerCell from 'extension/recordExplorerCell';

export default class RecordExplorer extends FeatureElement {

    @api versions = [];
    

    tableInstance;
    isLoading = false;

    currentTab;
    currentOrigin;

    // record data
    sobjectName;
    metadata;
    record;
    // for table
    data;
    filter = '';
    isError = false;


    @api
    get recordId(){
        return this._recordId;
    }
    set recordId(value){
        var toRun = this._recordId != value && !isEmpty(value);
        this._recordId = value;
        if(toRun){
            this.initRecordExplorer();
        }
        
    }
    


    connectedCallback(){}

    initRecordExplorer = async () => {
        console.log('initRecordExplorer');
        try{
            this.isError = false;
            this.isLoading = true;
            
            this.currentTab = await getCurrentTab();
            this.currentOrigin = (new URL(this.currentTab.url)).origin;
            // Get sobjectName (Step 2) // Should be optimized to save 1 API Call [Caching]
            this.sobjectName = await getCurrentObjectType(this.connector.conn,this.recordId);
            // Get Metadata (Step 3) // Should be optimized to save 1 API Call [Caching]
            this.metadata = await fetch_metadata(this.connector.conn,this.sobjectName);
            // Get data
            this.record = await fetch_data(this.connector.conn,this.sobjectName,this.recordId);


            this.data = this.formatData();
            runActionAfterTimeOut(null,(param) => {
                this.createTable();
                this.isLoading = false;
            });
        }catch(e){
            console.error(e);
            this.isError = true;
            this.isLoading = false;
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
        console.log('cell',cell,cell.getData())
        let data = cell.getData();
        const element = createElement('extension-record-explorer-cell', {
            is: RecordExplorerCell
        });
        Object.assign(element, {
            ...data,
            ...{
                filter:this.filter,
                currentOrigin:this.currentOrigin
            }
        });
        return element;
        
        //return "Mr" + cell.getValue(); //return the contents of the cell;
    }

    handleSearchInput = (e) => {
        let val = e.currentTarget.value;
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

    @api
    updateTable = (newValue) => {
        this.filter = newValue;
        this.tableInstance.replaceData(this.formattedData)
        .then(function(){
            //run code after table has been successfully updated
        })
        .catch(function(error){
            console.error(error);
        });
    }


    createTable = () => {

        let colModel = [
            { title: 'Field Label'  , field: 'label'    ,   headerHozAlign: "center", resizable: true ,formatter:this.formatterField,responsive:1,width:150},
            { title: 'ApiName'      , field: 'name'     ,   headerHozAlign: "center", resizable: true ,formatter:this.formatterField,responsive:0,width:150,
                tooltip:(e, cell, onRendered) => {
                    //e - mouseover event
                    //cell - cell component
                    //onRendered - onRendered callback registration function
                    let metadata = this.metadata.fields.find(x => x.name === cell.getValue());
                    return `Type: ${metadata.type}`;
                }
            },
            { title: 'Value'        , field: 'value'    ,  headerHozAlign: "center", resizable: true ,formatter:this.formatterValue,}
        ];

        if (this.tableInstance) {
			this.tableInstance.destroy();
		}

		this.tableInstance = new Tabulator(this.template.querySelector(".custom-table"), {
			height: '100%',
			data: this.formattedData,
            layout:"fitDataFill",
            responsiveLayout:"collapse",
            rowHeader:{formatter:"responsiveCollapse", width:30, minWidth:30, hozAlign:"center", resizable:false, headerSort:false},
			//layout:"fitColumns",
			columns: colModel,
			columnHeaderVertAlign: "middle",
            resizableColumnFit:true,
            downloadConfig:{
                rowGroups:false, //do not include row groups in downloaded table
            },
            responsiveLayoutCollapseFormatter:function(data){
                //data - an array of objects containing the column title and value for each cell
                var list = document.createElement("ul");

                data.forEach(function(col){
                    let item = document.createElement("li");
                    item.style = 'display: flex;width: 100%;flex-direction: row;justify-content: space-between;';
                    item.innerHTML = "<strong>" + col.title + ":</strong>";
                    item.appendChild(col.value);
                    list.appendChild(item);
                });
        
                return Object.keys(data).length ? list : "";
            }
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