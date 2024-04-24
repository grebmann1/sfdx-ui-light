import {LightningElement,api} from "lwc";
import { isNotUndefinedOrNull,isSalesforceId,isEmpty,isUndefinedOrNull } from "shared/utils";
export default class RecordExplorerRow extends LightningElement {

    @api item;
    @api currentOrigin;
    @api get filter(){
        return this._filter;
    }
    set filter(value){
        this._filter = value;
        if(this.hasRendered){
            this.renderRows();
        }
    }

    hasRendered = false;

    connectedCallback(){
        this.hasRendered = true;
        //this.renderRows();
    }

    renderedCallback() {
        /*if(this.template.querySelector('.injector')){
            // Issue will happen with "HTML values";
            let formattedHtml = this.formattedValue;
            if(this.type === 'address'){
                formattedHtml = `<pre>${this.formattedValue}</pre>`;
            }else if(this.isSalesforceId){
                formattedHtml = `<a href="${this.currentOrigin}/${this.value}" target="_blank">${this.formattedValue}</a>`;
            }

            this.template.querySelector('.injector').innerHTML = formattedHtml;
            
        }*/
        this.renderRows();
    }

    handleCopy = () => {
        navigator.clipboard.writeText(this.value);
    }

    renderRows = () => {
        this.refs.field.innerHTML = this.formattedFieldName;
        this.refs.value.innerHTML = this.formattedValue;
    }

    

    /** Getters */

    get label(){
        return this.item?.label;
    }

    get name(){
        return this.item?.name;
    }

    get value(){
        return this.item?.value;
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
        return isNotUndefinedOrNull(this.value);
    }

    get isSalesforceId(){
        return isNotUndefinedOrNull(this.value) && isSalesforceId(this.value);
    }
    

    get formattedFieldName(){
        if(isEmpty(this.filter)){
            return this.name;
        }
        
        const regex = new RegExp('('+this.filter+')','gmi');
        if(regex.test(this.name)){
            console.log('this.name.toString()',this.name.toString());
            return this.name.toString().replace(/<?>?/,'').replace(regex,'<span style="font-weight:Bold; color:blue;">$1</span>');
        }else{
            return this.name;
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
    
}