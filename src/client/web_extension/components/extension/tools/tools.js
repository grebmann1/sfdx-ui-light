import { createElement,api,track} from "lwc";
import FeatureElement from 'element/featureElement';
import { connectStore,store,store_application } from 'shared/store';

import {runActionAfterTimeOut,isEmpty,isNotUndefinedOrNull,isUndefinedOrNull,classSet} from 'shared/utils';
import { getCurrentTab,getCurrentObjectType,fetch_data,fetch_metadata,
    getObjectSetupLink,getObjectFieldsSetupLink,getRecordTypesLink,getObjectListLink,getObjectDocLink
} from "extension/utils";

export default class Tools extends FeatureElement {

    
    isLoading = false;
    isLWCHighlighted = false;
    


    connectedCallback(){
        // Load metadata
        this.initDefault();
    }

    

    /** Methods **/

    forwardMessageToContent = async message => {
        const [tab] = await chrome.tabs.query({active: true, lastFocusedWindow: true});
        const response = await chrome.tabs.sendMessage(tab.id,message);
        // do something with response here, not outside the function
        console.log(response);
    }


    /** Events **/
    
    highlightLWC_change = (e) => {
        this.isLWCHighlighted = e.detail.checked;
        this.forwardMessageToContent({
            action:'lwc_highlight',
            value:e.detail.checked,
            baseUrl:`https://sf-toolkit.com/extension?sessionId=${this.connector.conn.accessToken}&serverUrl=${encodeURIComponent(this.connector.conn.instanceUrl)}`
        });
    }
    


    /** Getters */

    get articleContainerClass(){
        return classSet('full-page slds-card slds-col')
        .add({}).toString();
    }


}