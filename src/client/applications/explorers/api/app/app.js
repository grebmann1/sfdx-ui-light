import { api,track } from "lwc";
import { decodeError,isNotUndefinedOrNull } from 'shared/utils';
import Toast from 'lightning/toast';
import FeatureElement from 'element/featureElement';

const METHOD = {
    GET:'GET',
    POST:'POST',
    PUT:'PUT',
    PATCH:'PATCH',
    DELETE:'DELETE'
}
const TABS = {
    PARAMETERS:'Parameters',
    RESPONSE:'Response'
}

const DEFAULT = {
    HEADER : 'Content-Type: application/json; charset=UTF-8\nAccept: application/json'
}

export default class App extends FeatureElement {

    isLoading = false;

    @track formattedRequests = [];
    @track endpoint = '/services/data/v60.0';
    @track content;
    @track method = METHOD.GET;

    @track currentTab = TABS.RESPONSE;

    @api header = DEFAULT.HEADER;
    @api body;


    connectedCallback(){

    }


    /** Methods  **/

    executeAPI = () => {
        const request = this.formatRequest();
        console.log('API Request',request);
        this.connector.conn.request(request,(err, res) => {
            if(err){
                Toast.show({
                    label: err.message || 'Error during request',
                    variant:'error',
                    mode:'dismissible'
                });
            }else{
                Toast.show({
                    label: 'Success Call',
                    variant:'success',
                });
            }
            console.log('err',err);
            console.log('res',res);
            this.content = res;
        })
    }

    formatRequest = () => {
        const request = {
            method: this.method, 
            url: `${this.connector.conn.instanceUrl}/${this.endpoint}`
        }
        if(isNotUndefinedOrNull(this.body)){
            request.body = this.body;
        }
        if(isNotUndefinedOrNull(this.headers)){
            // Basic headers for now (Using line split)
        }


        return request;
    }


    /** Events **/
    
    handleSelectTab = (e) => {    
        this.currentTab = e.target.value;
    }

    reset_click = (e) => {
        this.header = DEFAULT.HEADER;
    }

    endpoint_change = (e) => {
        this.endpoint = e.detail.value;
    }

    method_change = (e) => {
        this.method = e.detail.value;
    }

    body_change = (e) => {
        this.body = e.target.value;
    }

    header_change = (e) => {
        this.header = e.target.value;
    }

    /** Getters */

    get isParamsDisplayed(){
        return this.currentTab === TABS.PARAMETERS;
    }

    get isResponseDisplayed(){
        return this.currentTab === TABS.RESPONSE;
    }

    get method_options(){
        return Object.keys(METHOD).map(x => ({label:x,value:x}))
    }

    get isExecuteApiDisabled(){
        return false;
    }

    get isContentDisplayed(){
        return isNotUndefinedOrNull(this.content);
    }

    get formattedContent(){
        return isNotUndefinedOrNull(this.content)?JSON.stringify(this.content, null, 4):'';
    }
    get pageClass(){
        return super.pageClass+' slds-p-around_small';
    }
}