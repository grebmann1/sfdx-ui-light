import { api,track } from "lwc";
import { decodeError,isNotUndefinedOrNull,isEmpty,runActionAfterTimeOut,checkIfPresent } from 'shared/utils';
import FeatureElement from 'element/featureElement';

export default class MessageList extends FeatureElement {

    isLoading = false;

    @api messages = [];
    @api title;
    @api selectedEventItem;

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

    get selectedItemId(){
        return this.selectedEventItem?.id;
    }

    get filteredMessages(){
        if(isEmpty(this.filter)) return this.messages;
        return this.messages.filter(x => checkIfPresent(x.id,this.filter));
    }

    get sortedFilteredMessages(){
        return [...this.filteredMessages].sort((a,b) => b.id - a.id);
    }

    get isEmpty(){
        return this.filteredMessages.length == 0
    }
    

  
}