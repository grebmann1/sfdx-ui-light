import { createElement,LightningElement,api} from "lwc";
import { isEmpty,isElectronApp,runActionAfterTimeOut,isUndefinedOrNull,isNotUndefinedOrNull } from 'shared/utils';
import {TabulatorFull as Tabulator} from "tabulator-tables";

import SObjectCell from 'metadata/sobjectCell';

export default class Sobject extends LightningElement {

    @api connector;

    records = [];
    selectedItem;
    isLoading = false;
    isTableLoading = false;
    filter;
    fields_filter;

    recordDetails = {}
    selectedDetails;

    connectedCallback(){
        console.log('connector',this.connector);
        this.describeAll();
    }

    

    /** Events */

    handleFilter = (e) => {
        console.log('e.detail.value',e.detail.value,e.detail)
        runActionAfterTimeOut(e.detail.value,(newValue) => {
            this.filter = newValue;
        });
    }

    handleFieldsFilter = (e) => {
        console.log('e.detail.value',e.detail.value,e.detail)
        runActionAfterTimeOut(e.detail.value,(newValue) => {
            this.fields_filter = newValue;
            this.updateFieldsTable();
        });
    }

    handleItemSelection = async (e) => {
        this.selectedItem = e.detail.name;
        this.isTableLoading = true;
        await this.describeSpecific(this.selectedItem);
        this.isTableLoading = false;
        runActionAfterTimeOut(null,(param) => {
            this.createFieldsTable();
        });
    }

    /** Methods  **/

    load_toolingGlobal = async () => {
        let result = await this.connector.conn.describeGlobal();
        return result?.sobjects || [];
    }


    describeAll = async () => {
        this.isLoading = true;
        this.records = await this.load_toolingGlobal();
        console.log('records',this.records);
        this.isLoading = false;
    }

    describeSpecific = async (name) => {
        let result = await this.connector.conn.sobject(name).describe();
        console.log('result',result);
        this.selectedDetails = result;
    }

    checkIfPresent = (a,b) => {
        return (a || '').toLowerCase().includes((b||'').toLowerCase());
    }


    createFieldsTable = () => {

        let colModel = [
            { title: 'Field Label'  , field: 'label'    ,  headerHozAlign: "center", resizable: true ,formatter:this.formatterField_field},
            { title: 'ApiName'      , field: 'name'     ,  headerHozAlign: "center", resizable: true ,formatter:this.formatterField_field},
            { title: 'Type'         , field: 'type'     ,  headerHozAlign: "center", resizable: true ,formatter:this.formatterField_field},
            { title: 'Unique'       , field: 'unique'   ,  headerHozAlign: "center", resizable: true ,formatter:this.formatterField_value},
            { title: 'Length'       , field: 'length'   ,  headerHozAlign: "center", resizable: true ,formatter:this.formatterField_value},
            { title: 'Createable'   , field: 'createable'   ,  headerHozAlign: "center", resizable: true ,formatter:this.formatterField_value},
            { title: 'Updateable'   , field: 'updateable'   ,  headerHozAlign: "center", resizable: true ,formatter:this.formatterField_value}
        ]; //aggregatable

        if (this.tableInstance) {
			this.tableInstance.destroy();
		}

        console.log('window.innerHeight',window.innerHeight);

		this.tableInstance = new Tabulator(this.template.querySelector(".custom-table-fields"), {
			height: 424,
			data: this.field_filteredList,
			layout:"fitColumns",
			columns: colModel,
			columnHeaderVertAlign: "middle"
		});
    }

    updateFieldsTable = () => {
        this.tableInstance.replaceData(this.field_filteredList)
        .then(function(){
            //run code after table has been successfully updated
        })
        .catch(function(error){
            console.log('error',error);
        });
    }

    formatterField_field = (cell,formatterParams,onRendered) => {
        let field = cell._cell.value;
        if(isEmpty(this.fields_filter)){
            return field;
        }
        
        var regex = new RegExp('('+this.fields_filter+')','gi');
        if(regex.test(field)){
            return field.toString().replace(/<?>?/,'').replace(regex,'<span style="font-weight:Bold; color:blue;">$1</span>');
        }else{
            return field;
        }
    }

    formatterField_value = (cell, formatterParams, onRendered) => {
        let value = cell._cell.value;
        //let data = cell._cell.row.data;
        const element = createElement('metadata-sobject-cell', {
            is: SObjectCell
        });
        Object.assign(element, {
            value,
            ...{
                isBoolean:value === true || value === false
            }
        });
        return element;
        //return "Mr" + cell.getValue(); //return the contents of the cell;
    }


    /** Getters **/

    get filteredList(){
        if(isEmpty(this.filter)) return this.records;

        return this.records.filter(x => this.checkIfPresent(x.name,this.filter) || this.checkIfPresent(x.label,this.filter));
    }

    get field_filteredList(){
        //if(!this.isDetailDisplayed) return [];
        if(isEmpty(this.fields_filter)) return this.selectedDetails.fields;
        return this.selectedDetails.fields.filter(x => 
            this.checkIfPresent(x.name,this.fields_filter) 
            || this.checkIfPresent(x.label,this.fields_filter)
            || this.checkIfPresent(x.type,this.fields_filter)
        );
    }

    get isDetailDisplayed(){
        return isNotUndefinedOrNull(this.selectedDetails);
    }
    
}