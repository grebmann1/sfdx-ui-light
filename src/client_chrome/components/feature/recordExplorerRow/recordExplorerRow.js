import { api } from "lwc";
import ToolkitElement from 'core/toolkitElement';
import Toast from 'lightning/toast';
import { isNotUndefinedOrNull,isSalesforceId,isEmpty,isUndefinedOrNull,classSet,chunkPromises } from "shared/utils";
import { getObjectFieldsSetupLink} from "extension/utils";
export default class RecordExplorerRow extends ToolkitElement {

    @api item;
    @api isLoading;
    @api isVisible;
    @api currentOrigin;
    @api get filter(){
        return this._filter;
    }
    set filter(value){
        this._filter = value;
        if(this.hasRendered){
            this.renderRow();
        }
    }

    hasRendered = false;

    // Field & Label
    @api get isLabelDisplayed(){
        return this._isLabelDisplayed;
    }
    set isLabelDisplayed(value){
        this._isLabelDisplayed = value;
        if(this.hasRendered){
            this.renderRow();
        }
    }

    _isInfoDisplayed = false;
    @api get isInfoDisplayed(){
        return this._isInfoDisplayed;
    }
    set isInfoDisplayed(value){
        this._isInfoDisplayed = value;
        if(this.hasRendered){
            this.renderRow();
        }
    }

    // Editing
    @api editingFieldSet; // used for scroll loading !
    @api isEditMode = false;
    @api isDirty = false;
    @api record;
    @api metadata;
    @api get fieldErrors(){
        return this._errors;
    }
    set fieldErrors(value){
        this._errors = value;
        if(this.hasRendered && this.isEditMode){
            this.renderFieldErrors();
        }
    }

    connectedCallback(){
        //this.renderRow();
    }

    renderedCallback() {
        this.renderRow();
        if(!this.hasRendered && isNotUndefinedOrNull(this.editingFieldSet) && this.editingFieldSet.has(this.name)){
            // Only happening for new row created during scrolling
            this.enableInputField();
        }
        this.hasRendered = true;
    }

    /** Methods  **/

    renderFieldErrors = () => {
        if(isNotUndefinedOrNull(this.fieldErrors) && this.fieldErrors.hasOwnProperty(this.name)){
            this.refs.inputfield.setErrors(this.fieldErrors);
        }
    }

    renderRow = () => {
        if(this.refs.field){
            this.refs.field.innerHTML = this.formattedFieldName;
        }
        if(this.refs.value){
            this.refs.value.innerHTML = this.formattedValue;
        }
        if(this.refs.type){
            this.refs.type.innerHTML = this.formattedType;
        }
    }

    @api
    enableInputField = () => {
        if(!this.isEditEnabled) return;
        
        this.isEditMode = true;
        setTimeout(() => {
            const uiField = this.metadata.fields.find(x => x.name === this.name);
            this.refs.inputfield.wireRecordAndMetadata({
                record:this.record,
                objectInfo:this.metadata,
                uiField
            });
            //console.log('uiField',uiField);
            // Passing all picklists
            if(this.isPicklist){
                const picklistValues = this.metadata.fields.filter(x => x.type == 'picklist' || x.type == 'multipicklist').reduce((a, v) => ({ ...a, [v.name]: v.picklistValues}), {})
                this.refs.inputfield.wirePicklistValues(picklistValues);
            }
        },1);
    }

    @api
    disableInputField = () => {
        this.isDirty = false;
        this.isEditMode = false;
    }

    sendRowChangeEvent = () => {
        this.dispatchEvent(
            // eslint-disable-next-line lightning-global/no-custom-event-bubbling
            new CustomEvent('rowchange', {
                bubbles: true,
                composed: true,
                cancelable: true,
            })
        );
    }

    generateMatrix = async ( controllingFieldName, dependentFieldName) => {
        const recordTypeList = await this.fetchAllRecordTypes();
        
        const recordTypeMatrix = {}
        recordTypeList.forEach(recordType => {
            const controllingField = recordType.picklistFieldValues[controllingFieldName];
            const dependentField = recordType.picklistFieldValues[dependentFieldName];
            const matrix = {};
            controllingField.values.forEach((_,controllerIndex) => {
                dependentField.values.forEach((option) => {
                    if (!option.validFor.includes(controllerIndex))return;

                    const controllingValue = controllingField.values[controllerIndex].value;
                    if (!matrix[controllingValue]) {
                        matrix[controllingValue] = [];
                    }
                    const dependentValue = option.value;
                    matrix[controllingValue].push(dependentValue);
                })
            });
            recordTypeMatrix[recordType.developerName] = matrix
            
        })
        return recordTypeMatrix;
    }

    generateCSV = async (controllingField,matrix) => {
        const header = [controllingField,...Object.keys(matrix)].join(',');
        const mapping = {};
        Object.keys(matrix).forEach(recordType => {
            Object.keys(matrix[recordType]).forEach(controllerField => {
                if(!mapping.hasOwnProperty(controllerField)){
                    mapping[controllerField] = [];
                }
                mapping[controllerField].push(matrix[recordType][controllerField].join(';'));
            })
        })
        const data = Object.keys(mapping)
            .map((controllerField,index) => {
                // controllerField
                return [controllerField,...mapping[controllerField]].join(',');
            })
            .join('\n');
        return `${header}\n${data}`;
    }

    /* Events */

    handleInputChange = (e) => {
        if (e.detail.value !== this.value) {
            this.isDirty = true;
        } else {
            this.isDirty = false;
        }
        //this.sendRowChangeEvent();
    }

    handleCopyClick = () => {
        navigator.clipboard.writeText(this.value);
        Toast.show({
            label: 'Value exported to your clipboard',
            variant:'success',
        });
    }

    handleUndoClick = () => {
        //this.isEditMode = false; // for now we just reset it by disabling the "Input field"
        this.isDirty = false;
        this.refs.inputfield.reset();
    }
    

    handleEditClick = () => {
        this.enableInputField();
        this.dispatchEvent(
            // eslint-disable-next-line lightning-global/no-custom-event-bubbling
            new CustomEvent('enableeditmode', {
                bubbles: true,
                composed: true,
                cancelable: true,
                detail:{
                    fieldName:this.name
                }
            })
        );
    }
    fetchAllRecordTypes = async (recordTypeId) => {
        const recordTypes = this.metadata.recordTypeInfos;
        // /ui-api/object-info/Account/picklist-values/012Hr000001RvqQ
        const fetchAllPicklists = async (recordType) => {
            const res = await this.connector.conn.request(`/ui-api/object-info/${this.metadata.name}/picklist-values/${recordType.recordTypeId}`);
            return {
                picklistFieldValues:res.picklistFieldValues,
                name:recordType.name,
                recordTypeId:recordType.recordTypeId,
                developerName:recordType.developerName
            }
        }
        return await chunkPromises(recordTypes,4,fetchAllPicklists);
    }

    

    handleDependentPicklistClick = async () => {
        this.isLoading = true;
        Toast.show({
            label: 'Generating CSV File',
            variant:'success',
        });
        try {
            const matrix = await this.generateMatrix(this.item.fieldInfo.controllerName, this.item.fieldInfo.name);
            
            const data = await this.generateCSV(this.item.fieldInfo.controllerName,matrix);
            const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
            const blob = new Blob([bom, data], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const download = document.createElement('a');
                download.href = window.URL.createObjectURL(blob);
                download.download = `[PicklistDependencies]${this.metadata.name}-${this.item.fieldInfo.name}.csv`;
                download.click();
            URL.revokeObjectURL(url);
            this.isLoading = false;
        } catch (e) {
            console.error(e);
            this.isLoading = false;
            Toast.show({
                message: this.i18n.OUTPUT_PANEL_FAILED_EXPORT_CSV,
                errors: e
            });
        }
    }

    

    /*handleRedirectSettings = () => {
        //console.log('handleRedirectSettings');
        const uiField = this.metadata.fields.find(x => x.name === this.name);
        const retUrl = getObjectFieldDetailSetupLink({
            host:this.currentOrigin,
            sobjectName:this.metadata.name,
            durableId:this.metadata.durableId,
            fieldName:uiField.name,
            fieldNameDurableId:uiField.name
        })
        const targetUrl = `${this.connector.conn.instanceUrl}/servlet/servlet.su?oid=${encodeURIComponent(this.connector.configuration.orgId)}&retURL=${encodeURIComponent(retUrl)}}`;
    }*/
    
    handleFormulaClick = () => {
        navigator.clipboard.writeText(this.tooltip_formula);
        Toast.show({
            label: 'Formula exported to your clipboard',
            variant:'success',
        });
    }

    /** Getters */

    get label(){
        return this.item?.label;
    }

    @api
    get name(){
        return this.item?.name;
    }

    get value(){
        return this.item?.value;
    }

    @api
    get newValue(){
        return this.refs.inputfield.value;
    }

    get type(){
        return this.item?.type;
    }

    get isHtml(){
        return (new RegExp(/(<([^>]+)>)/i)).test(this.value)
    }
    
    get isTrue(){
        return this.value === true;
    }

    get isBoolean(){
        return this.type === 'boolean';
    }

    get isCopyDisplayed(){
        return isNotUndefinedOrNull(this.value) && !this.isInfoDisplayed;
    }

    get isSalesforceId(){
        return isNotUndefinedOrNull(this.value) && isSalesforceId(this.value);
    }

    get isDependentPicklist(){
        return this.item.fieldInfo.dependentPicklist;
    }

    get isDependentPicklistDisplayed(){
        return this.isDependentPicklist && !this.isDirty;
    }

    get isEditEnabled(){
        return this.item.fieldInfo.updateable; //&& !this.isEditMode;
    }

    get isEditButtonDisplayed(){
        return this.isEditEnabled && !this.isEditMode;
    }

    get isUndoDisplayed(){
        return this.isEditMode && this.isDirty;
    }

    get isReadOnly(){
        return !this.isEditMode && !this.isNotEditable || this.isNotEditable;
    }

    get isNotEditable(){
        return !this.item.fieldInfo.updateable;
    }

    get isFormula(){
        return this.item.fieldInfo.calculated;
    }

    get tooltip_formula(){
        return this.item.fieldInfo.calculatedFormula;
    }

    get tooltip_dependentPicklist(){
        return `Controlling Field : ${this.item.fieldInfo.controllerName}. Click to download !`;
    }

    get isPicklist(){
        return this.item.fieldInfo.type == 'picklist' || this.item.fieldInfo.type == 'multipicklist';
    }
    

    get formattedFieldName(){
        var _name = this.isLabelDisplayed?this.label:this.name;

        if(isEmpty(this.filter)){
            return _name;
        }
        
        const regex = new RegExp('('+this.filter+')','gmi');
        if(regex.test(_name)){
            //console.log('this.name.toString()',this.name.toString());
            return _name.toString().replace(/<?>?/,'').replace(regex,'<span style="font-weight:Bold; color:blue;">$1</span>');
        }else{
            return _name;
        }
    }

    get formattedType(){
        if(isEmpty(this.filter)){
            return this.type;
        }
        
        const regex = new RegExp('('+this.filter+')','gmi');
        if(regex.test(this.type)){
            //console.log('this.name.toString()',this.name.toString());
            return this.type.toString().replace(/<?>?/,'').replace(regex,'<span style="font-weight:Bold; color:blue;">$1</span>');
        }else{
            return this.type;
        }
    }

    get formattedValue(){
        /** SET FIELTERED VALUE for displayed **/
        var regex = new RegExp('('+this.filter+')','gmi');
        var _formattedValue = this.value;
        if(!isEmpty(this.filter) && regex.test(this.value) && isNotUndefinedOrNull(this.value)){
            _formattedValue = this.value.toString().replace(/<?>?/,'').replace(regex,'<span style="font-weight:Bold; color:blue;">$1</span>');
        }else{
            _formattedValue = this.value == null ?' ':this.value;
        }
        // fix the issue with JS object (shouldn't be the case but just in case)
        if(isNotUndefinedOrNull(this.value) && typeof this.value == 'object'){
            _formattedValue = JSON.stringify(this.value);
        }
        switch(this.type){
            case "address":
                return `<pre>${_formattedValue}</pre>`;
            case "reference":
                return `<a href="${this.currentOrigin}/${this.value}" target="_blank">${_formattedValue}</a>`; // in the futur, return a link
            case 'boolean':
                return this.value == true ? '<img src="/assets/images/checkbox_checked.gif"/>': '<img src="/assets/images/checkbox_unchecked.gif"/>';
        }
    
        /** in case of HTML  **/
        if(this.isHtml){
            var data = this.value;
            var balise;
            if(data.indexOf('href="//') > -1 || data.indexOf('src="//') > -1){
                balise = data;
            }else{
                var balise = data.replace(/href="\//i, `href="https://${this.currentOrigin}/`);
                    balise = balise.replace(/src="\//i, `src="https://${this.currentOrigin}/`);
            }
           return balise;
        }

        // otherwise just return the formattedValue
        return _formattedValue;
    }

    get rowClass(){
        return classSet('')
        .add({
            'slds-is-dirty':this.isDirty,
            'slds-hide':!this.isVisible
        }).toString();
    }
    
}