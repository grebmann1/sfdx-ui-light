import { api,track } from "lwc";
import { decodeError,isNotUndefinedOrNull,isEmpty,runActionAfterTimeOut } from 'shared/utils';
import FeatureElement from 'element/featureElement';


export default class MessageList extends FeatureElement {

    isLoading = false;

    @api messages = [];
    @api title;

    filter;
   


    connectedCallback(){
      
    }


    /** Events **/

    handleSearch = (e) => {
        runActionAfterTimeOut(e.detail.value,(newValue) => {
            this.filter = newValue;
        });
    }

    selectPlatformEvent = () => {
        
    }

    handleEmptyMessages = (e) => {
        this.dispatchEvent(new CustomEvent("empty", { 
            bubbles: true,composed: true 
        }));
    }   


    /** Methods  **/

    


    /** Getters */

    get filteredMessages(){
        if(isEmpty(this.filter)) return this.messages;
        return this.messages.filter(x => this.checkIfPresent(x.id,this.filter));
    }

    get sortedFilteredMessages(){
        return [...this.filteredMessages].sort((a,b) => b.id - a.id);
    }

    get isEmpty(){
        return this.filteredMessages.length == 0
    }
    

  
}