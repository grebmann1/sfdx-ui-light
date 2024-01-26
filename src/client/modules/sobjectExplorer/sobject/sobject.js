import { createElement} from "lwc";
import FeatureElement from 'element/featureElement';
import { isEmpty,runActionAfterTimeOut,isNotUndefinedOrNull } from 'shared/utils';
import {TabulatorFull as Tabulator} from "tabulator-tables";
import SObjectCell from 'sobjectExplorer/sobjectCell';

/** Store */
import { store,navigate } from 'shared/store';
export default class Sobject extends FeatureElement {

    records = [];
    selectedItem;
    isLoading = false;
    isTableLoading = false;


    filter;
    fields_filter;
    child_filter;

    recordDetails = {}
    selectedDetails;

    connectedCallback(){
        this.describeAll();
    }

    

    /** Events */
    
    goToSetup = (e) => {
        store.dispatch(navigate(`lightning/setup/ObjectManager/${this.selectedDetails.name}/Details/view`));
    }

    handleFilter = (e) => {
        runActionAfterTimeOut(e.detail.value,(newValue) => {
            this.filter = newValue;
        });
    }

    handleFieldsFilter = (e) => {
        runActionAfterTimeOut(e.detail.value,(newValue) => {
            this.fields_filter = newValue;
            this.updateFieldsTable();
        });
    }

    handleChildFilter = (e) => {
        runActionAfterTimeOut(e.detail.value,(newValue) => {
            this.child_filter = newValue;
            this.updateChildTable();
        });
    }

    handleItemSelection = async (e) => {
        this.selectedItem = e.detail.name;
        this.isTableLoading = true;
        await this.describeSpecific(this.selectedItem);
        this.isTableLoading = false;
        runActionAfterTimeOut(null,(param) => {
            this.createFieldsTable();
            this.createChildsTable();
        });
    }

    /** Methods  **/

    load_toolingGlobal = async () => {
        let result = await this.connector.conn.describeGlobal();
        return result?.sobjects || [];
    }


    describeAll = async () => {
        this.isLoading = true;
        const records = (await this.load_toolingGlobal()) || [];
        this.records = records.map(x => ({...x,formattedLabel:`${x.label}(${x.name})`}))
        this.isLoading = false;
    }

    describeSpecific = async (name) => {
        let result = await this.connector.conn.sobject(name).describe();
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
            //{ title: 'Unique'       , field: 'unique'   ,  headerHozAlign: "center", resizable: true ,formatter:this.formatterField_value},
            { title: 'Length'       , field: 'length'   ,  headerHozAlign: "center", resizable: true ,formatter:this.formatterField_value},
            //{ title: 'Createable'   , field: 'createable'   ,  headerHozAlign: "center", resizable: true ,formatter:this.formatterField_value},
            //{ title: 'Updateable'   , field: 'updateable'   ,  headerHozAlign: "center", resizable: true ,formatter:this.formatterField_value}
        ]; //aggregatable

        if (this.tableFieldInstance) {
			this.tableFieldInstance.destroy();
		}

		this.tableFieldInstance = new Tabulator(this.template.querySelector(".custom-table-fields"), {
			height: 424,
			data: this.field_filteredList,
			layout:"fitColumns",
			columns: colModel,
			columnHeaderVertAlign: "middle"
		});
    }

    createChildsTable = () => {

        let colModel = [
            { title: 'Relationship Name', field: 'relationshipName' ,  headerHozAlign: "center", resizable: true ,formatter:this.formatterField_field},
            { title: 'SObject'          , field: 'childSObject'     ,  headerHozAlign: "center", resizable: true ,formatter:this.formatterField_field},
            { title: 'Child Field'      , field: 'field'            ,  headerHozAlign: "center", resizable: true ,formatter:this.formatterField_field},
        ]; //aggregatable

        if (this.tableChildInstance) {
			this.tableChildInstance.destroy();
		}

		this.tableChildInstance = new Tabulator(this.template.querySelector(".custom-table-child"), {
			height: 424,
			data: this.child_filteredList,
			layout:"fitColumns",
			columns: colModel,
			columnHeaderVertAlign: "middle"
		});
    }

    updateFieldsTable = () => {
        this.tableFieldInstance.replaceData(this.field_filteredList);
    }

    updateChildTable = () => {
        this.tableChildInstance.replaceData(this.child_filteredList);
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
        const element = createElement('sobjectExplorer-sobject-cell', {
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

    get objects_filteredList(){
        if(isEmpty(this.filter)) return this.records;

        return this.records.filter(x => this.checkIfPresent(x.formattedLabel,this.filter));
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

    get child_filteredList(){
        const records = this.selectedDetails.childRelationships.filter(x => !isEmpty(x.relationshipName));
        if(isEmpty(this.child_filter)) return records;
        return records.filter(x => 
            this.checkIfPresent(x.relationshipName,this.child_filter) 
            || this.checkIfPresent(x.field,this.child_filter)
            || this.checkIfPresent(x.childSObject,this.child_filter)
        );
    }

    get isDetailDisplayed(){
        return isNotUndefinedOrNull(this.selectedDetails);
    }
    
}