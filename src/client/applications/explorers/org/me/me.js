
import FeatureElement from 'element/featureElement';
import { api,track,wire } from "lwc";
import Toast from 'lightning/toast';
import { isEmpty,isElectronApp,runSilent,isNotUndefinedOrNull,isUndefinedOrNull,refreshCurrentTab } from 'shared/utils';
import { store,store_application } from 'shared/store';


export default class Me extends FeatureElement {

    @api title = 'Current User';
    
    @track user = {};

    // Editing
    metadata;
    isEdit = false;
    isSaving = false;
    fieldErrors;

    connectedCallback(){
        //this.isFilterting_limits = true;
        this.init();
    }

    init = async () => {
        this.load_metadata();
        this.load_myUserInformation();
    }

    /** Methods */

    goToUrl = (e) => {
        const redirectUrl = e.currentTarget.dataset.url;
        store.dispatch(store_application.navigate(redirectUrl));
    }

    load_metadata = async () => {
        this.metadata = await runSilent(async () => { return await this.connector.conn.sobject('user').describe();},null);
    }

    load_myUserInformation = async () => {
        const query = `SELECT Id, LastName, FirstName, Username,Email,FederationIdentifier,CompanyName, Name, IsActive, CurrencyIsoCode, LanguageLocaleKey FROM User WHERE username = '${this.connector.header.username}'`;
        const _user = await runSilent(async ()=>{return (await this.connector.conn.query(query)).records[0]},null);
        this.user = null;
        this.user = _user;
    }

    renderFieldErrors = () => {
        if(isUndefinedOrNull(this.fieldErrors)) return;

        this.template.querySelectorAll('slds-input-field')
        .forEach(element => {
            if(!this.fieldErrors.hasOwnProperty(element.fieldName))return;
            
            element.setErrors(this.fieldErrors);
        });
    }

    reset = () => {
        this.fieldErrors = null;
        this.isEdit = false;
        this.load_myUserInformation();
    }

    /** Events */

    handle_copyClick = (e) => {
        const value = e.target.dataset.value;
        const field = e.target.dataset.field;
        navigator.clipboard.writeText(value);
        Toast.show({
            label: `${field} exported to your clipboard'`,
            variant:'success',
        });
    }

    handle_editClick = () => {
        this.isEdit = true;
        setTimeout(async () => {
            this.template.querySelectorAll('slds-input-field')
            .forEach(element => {
                const uiField = this.metadata.fields.find(x => x.name === element.fieldName);
                element.wireRecordAndMetadata({
                    record:this.user,
                    objectInfo:this.metadata,
                    uiField
                });
                // only picklist
                if(uiField.type == 'picklist' || uiField.type == 'multipicklist'){
                    //const picklistValues = this.metadata.fields.filter(x => x.type == 'picklist' || x.type == 'multipicklist').reduce((a, v) => ({ ...a, [v.name]: v.picklistValues}), {})
                    const picklistValues = [uiField].reduce((a, v) => ({ ...a, [v.name]: v.picklistValues}), {})
                    element.wirePicklistValues(picklistValues);
                }
            });
        },1);
    }

    handle_save = async () => {
        this.isSaving = true;
        const userUpdate = { Id:this.user.Id };//
        this.template.querySelectorAll('slds-input-field')
        .forEach(element => {
            // Only add changed fields !
            if(this.user[element.fieldName] !== element.value){
                userUpdate[element.fieldName] = element.value;
            }
            
        });
        const response = (await this.connector.conn.sobject("User").update([userUpdate]))[0];
        console.log('###### userUpdate/response ######',userUpdate,response);
        this.isSaving = false;
        if (response.success) {
            this.reset();
            refreshCurrentTab();
            Toast.show({
                label: 'User saved successfully',
                variant:'success',
            });
        }else{
            const fieldErrorSet = {};
            const fieldErrorGlobal = [];
            // Need to improve in the futur
            response.errors.forEach(error => {
                error.fields.forEach(field => {
                    fieldErrorSet[field] = error;
                });
                if(error.fields.length == 0){
                    fieldErrorGlobal.push(error);
                }
            });
            this.fieldErrors = fieldErrorSet;
            this.renderFieldErrors();
            var error_label,error_message;
            if(fieldErrorGlobal.length > 0){
                error_label     = fieldErrorGlobal[0].statusCode;
                error_message   = fieldErrorGlobal[0].message;
            }else{
                error_label     = response.errors[0].statusCode;
                error_message   = response.errors[0].message;
            }
            Toast.show({
                message: error_message || 'Unknown Error',
                label: error_label || 'Error',
                variant: 'error',
                mode: 'sticky'
            });
            
        }
    }

    handle_cancel = () => {
        this.reset();
    }


    /** Getters */

    get isEditButtonDisabled(){
        return isUndefinedOrNull(this.metadata);
    }

    get isReadOnly(){
        return !this.isEdit;
    }

    get goToMyUserUrl(){
        const userId = this.connector.header?.userInfo?.user_id;
        return `/lightning/setup/ManageUsers/page?address=${encodeURIComponent(`/${userId}?noredirect=1&isUserEntityOverride=1`)}`;
    }
    

    

}