import { createElement} from "lwc";
import FeatureElement from 'element/featureElement';
import { isEmpty,runActionAfterTimeOut,isNotUndefinedOrNull } from 'shared/utils';
import {TabulatorFull as Tabulator} from "tabulator-tables";
import SObjectCell from 'object/sobjectCell';

/** Store */
import { store,store_application } from 'shared/store';


const TYPEFILTER_OPTIONS = [
    { label: 'Object', value: 'object' },
    { label: 'Change Event', value: 'change' },
    { label: 'Platform Event', value: 'event' },
    { label: 'Custom Metadata', value: 'metadata' },
    { label: 'Feed', value: 'feed' },
    { label: 'History', value: 'history' },
    { label: 'Share', value: 'share' },
];

export default class Sobject extends FeatureElement {

    records = [];
    recordFilters = [];
    selectedItem;
    isLoading = false;
    isTableLoading = false;
    isMenuLoading = false;


    filter;
    fields_filter;
    child_filter;
    typeFilter_value = [];
    displayAdvancedFilter = false;

    recordDetails = {}
    selectedDetails;
    extraSelectedDetails;

    connectedCallback(){
        this.loadAlls();

    }

    

    /** Events */

    handleToggleChange = (e) => {
        this.displayAdvancedFilter = e.detail.checked;
    }
    
    goToSetup = (e) => {
        store.dispatch(store_application.navigate(`lightning/setup/ObjectManager/${this.selectedDetails.name}/Details/view`));
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

    typeFilter_onChange = (e) => {
        this.typeFilter_value = e.detail.value;
        setTimeout(() => {
            this.recordFilters = this.filterRecords();
        },1);
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

    loadAlls = async () => {
        await this.describeAll();
    }

    load_toolingGlobal = async () => {
        let result = await this.connector.conn.describeGlobal();
        return result?.sobjects || [];
    }

    checkRecords = async () => {
        this.extraSelectedDetails = {totalRecords:0};
        this.extraSelectedDetails.totalRecords = (await this.connector.conn.query(`SELECT Count(Id) total FROM ${this.selectedDetails.name}`)).records[0].total;
    }


    describeAll = async () => {
        this.isLoading = true;
        this.isMenuLoading = true;
        try{
            var records = (await this.load_toolingGlobal()) || [];
            this.records = records;
            this.menuRecords = records.map(x => ({
                label:`${x.label}(${x.name})`, // for slds-menu
                name:x.name, // for slds-menu
                key:x.name, // for slds-menu
                category:this.extractCategory(x.name)
            })).sort((a, b) => a.name.localeCompare(b.name));
            this.recordFilters = this.filterRecords();
        }catch(e){
            console.error(e);
        }
        this.isLoading = false;
        this.isMenuLoading = false;
    }

    describeSpecific = async (name) => {
        let result = await this.connector.conn.sobject(name).describe();
        this.selectedDetails = result;
        await this.checkRecords();
        setTimeout(() => {
            this.buildUML();
        },100)
    }

    checkIfPresent = (a,b) => {
        return (a || '').toLowerCase().includes((b||'').toLowerCase());
    }

    buildUML = async () => {
        this.refs.mermaid.innerHTML = '';
        const source = this.selectedDetails.name;
        const result = ['classDiagram','direction LR',`class \`${source}\``];
        const interactions = [`click \`${source}\` call mermaidCallback()`];
        // Filter to take only fields with "Refer To"
        const references = this.selectedDetails.fields.filter(x => x.type === 'reference');
        console.log('references',references);
        references.forEach(field => {
            field.referenceTo.forEach( target => {
                result.push(`\`${source}\` --> \`${target || 'Undefined'}\` : ${field.relationshipName}`);
            })
        });
        /*
        const relationships = this.selectedDetails.childRelationships.filter(x => !x.deprecatedAndHidden);
        relationships.forEach(item => {
            result.push(`\`${item.childSObject}\` --> \`${source}\` : ${item.field}`);
        });
        */
            //console.log('r',[].concat(result,interactions).join('\n'));
        const { svg,bindFunctions } = await window.mermaid.render('graphDiv',[].concat(result,interactions).join('\n'));
        this.refs.mermaid.innerHTML = svg;
        if (bindFunctions) {
            bindFunctions(this.refs.mermaid);
        }
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
			columnHeaderVertAlign: "middle",
            autoResize:false
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
			columnHeaderVertAlign: "middle",
            autoResize:false
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
        const element = createElement('object-sobject-cell', {
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

    
    extractCategory = (item) => {
        if(item.endsWith('ChangeEvent')){
            return 'change';
        }else if(item.endsWith('Feed')){
            return 'feed';
        }else if(item.endsWith('History')){
            return 'history';
        }else if(item.endsWith('Share')){
            return 'share';
        }else if(item.endsWith('__mdt')){
            return 'metadata';
        }

        return 'object'; // default value for the left over
    }

    filterRecords = () => {
        if(this.typeFilter_value.length == 0) return this.menuRecords;
        return this.menuRecords.filter(x => this.typeFilter_value.includes(x.category));
    }


    /** Getters **/

    get typeFilter_options(){
        return TYPEFILTER_OPTIONS;
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