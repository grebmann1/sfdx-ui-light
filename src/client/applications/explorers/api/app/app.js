import { track } from "lwc";
import { decodeError,isNotUndefinedOrNull } from 'shared/utils';
import Toast from 'lightning/toast';
import FeatureElement from 'element/featureElement';


export default class App extends FeatureElement {

    isLoading = false;

    @track formattedRequests = [];
    @track endpoint = '/services/data/v60.0';
    @track content;


    connectedCallback(){

    }


    /** Methods  **/

    executeAPI = () => {
        this.endpoint = this.refs.url.value;
        this.connector.conn.request(`${this.connector.conn.instanceUrl}/${this.endpoint}`,(err, res) => {
            if(err){
                Toast.show({
                    label: err.message || 'Error during request',
                    variant:'error',
                    mode:'dismissible'
                });
            }
            console.log('err',err);
            console.log('res',res);
            this.content = res;
        })
    }
    


    /** Getters */
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