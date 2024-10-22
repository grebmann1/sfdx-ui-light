import { wire, api, createElement} from "lwc";
import ToolkitElement from 'core/toolkitElement';
import { CurrentPageReference,NavigationContext, generateUrl, navigate } from 'lwr/navigation';
import { isEmpty,runActionAfterTimeOut,isNotUndefinedOrNull,classSet } from 'shared/utils';
import {TabulatorFull as Tabulator} from "tabulator-tables";
import SObjectCell from 'object/sobjectCell';

/** Store */
import { store,store_application } from 'shared/store';

export default class Sobject extends ToolkitElement {

    @wire(NavigationContext)
    navContext;

    isLoading = false;
    isTableLoading = false;
    isNoRecord = false;

    fields_filter;
    child_filter;

    recordDetails = {}
    selectedDetails;
    extraSelectedDetails;

    isDiagramDisplayed = false;

    @api
    objectRecords = [];

    @api
    get recordName(){
        return this._recordName;
    }

    set recordName(value){
        this._recordName = value;
        if(!isEmpty(value)){
            this.loadSpecificRecord();
        }
    }

    connectedCallback(){
        this.loadFromCache();
    }

    

    /** Events */
    
    goToUrl = (e) => {
        const redirectUrl = e.currentTarget.dataset.url;
        store.dispatch(store_application.navigate(redirectUrl));
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

    handleDisplayDiagram = (e) => {
        this.isDiagramDisplayed = e.detail.checked;
        localStorage.setItem(`object-explorer-isDiagramDisplayed`,e.detail.checked);
    }
    

    loadSpecificRecord = async () => {
        this.reset();
        this.isLoading = true;
        await this.describeSpecific(this.recordName);
        this.isLoading = false;
        runActionAfterTimeOut(null,(param) => {
            this.createFieldsTable();
            this.createChildsTable();
        });
    }

    /** Methods  **/

    loadFromCache = async () => {
        this.isDiagramDisplayed = localStorage.getItem(`object-explorer-isDiagramDisplayed`) === 'true';
    }
    
    reset = () => {
        this.fields_filter = null;
        this.child_filter = null;
        this.isNoRecord = false;
        this.isLoading = false;
        this.isTableLoading = false;
    }

    checkRecords = async () => {
        this.extraSelectedDetails = {totalRecords:0};
        try{
            this.extraSelectedDetails.totalRecords = (await this.connector.conn.query(`SELECT Count(Id) total FROM ${this.selectedDetails.name}`)).records[0].total;
        }catch(e){
            console.error('checkRecords',e);
        }
    }

    describeSpecific = async (name) => {
        try{
            let result = await this.connector.conn.sobject(name).describe();
            this.selectedDetails = result;
            await this.checkRecords();
            setTimeout(() => {
                this.buildUML();
            },100)
        }catch(e){
            console.error(e);
            this.isNoRecord = true;
        }
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
            /*{ title: 'Setup', width:100, field: 'id'     ,  headerHozAlign: "center", resizable: true ,formatter:this.formatterField_link},*/
            { title: 'Field Label'  , field: 'label'    ,  headerHozAlign: "center", resizable: true ,formatter:this.formatterField_field},
            { title: 'ApiName'      , field: 'name'     ,  headerHozAlign: "center", resizable: true ,formatter:this.formatterField_field},
            { title: 'Type'         , field: 'type'     ,  headerHozAlign: "center", resizable: true ,formatter:this.formatterField_type},
            //{ title: 'Unique'       , field: 'unique'   ,  headerHozAlign: "center", resizable: true ,formatter:this.formatterField_value},
            { title: 'Length'       , field: 'length'   ,  headerHozAlign: "center", resizable: true ,formatter:this.formatterField_value},
            //{ title: 'Createable'   , field: 'createable'   ,  headerHozAlign: "center", resizable: true ,formatter:this.formatterField_value},
            //{ title: 'Updateable'   , field: 'updateable'   ,  headerHozAlign: "center", resizable: true ,formatter:this.formatterField_value}
        ]; //aggregatable

        if (this.tableFieldInstance) {
            console.log('this.tableFieldInstance',this.tableFieldInstance);
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

    formatterField_type = (cell) => {
        const value = cell._cell.value;
        const config = {
            isBoolean:false
        }
        
        if(value === 'reference'){
            const data = cell._cell.row.data;
            const referenceTo = data?.referenceTo?.length > 0 ? data.referenceTo[0]:null; // We take only 1 for now
            if(this.objectRecords.find(x => x.name == referenceTo)){
                config.urlLabel     = referenceTo;
                config.urlLink      = 'sftoolkit:'+JSON.stringify({type:'application',attributes:{applicationName:'sobject',attribute1:referenceTo}});
            } 
        }

        const element = createElement('object-sobject-cell', {
            is: SObjectCell
        });
        Object.assign(element, {
            value,
            ...config
        });
        return element;
    }

    /** Getters **/ 

    get noRecordMessage(){
        return `${this.recordName} wasn't found in your metadata.`;
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


    get fieldUrl(){
        return `/lightning/setup/ObjectManager/${this.selectedDetails.name}/FieldsAndRelationships/view`;
    }

    get recordTypeUrl(){
        return `/lightning/setup/ObjectManager/${this.selectedDetails.name}/RecordTypes/view`;
    }

    get setupUrl(){
        return `/lightning/setup/ObjectManager/${this.selectedDetails.name}/Details/view`;
    }
    
    get mermaidClass(){
        return classSet('mermaid')
        .add({
            'slds-hide':!this.isDiagramDisplayed
        })
        .toString();
    }
}