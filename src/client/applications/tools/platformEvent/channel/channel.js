import { api,track,wire } from "lwc";
import { decodeError,isNotUndefinedOrNull,classSet } from 'shared/utils';
import ToolkitElement from 'core/toolkitElement';
import {
    connectStore,
    store,
} from 'platformevent/store';

export default class Channel extends ToolkitElement {

    isLoading = false;
    counter = 0;
    @api selectedItem;
    @api 
    set item(value){
        this._item = value;
        if(value){
            this.counter = value?.messages?.length;
        }
    }
    get item(){
        return this._item;
    }

    @wire(connectStore, { store })
    storeChange({ channel }) {
        if (channel) {
            this.store_handleReceivedMessage(channel)
        }
    }


    /** Events **/

    store_handleReceivedMessage = (data) => {
        //console.log('handleReceivedMessage',item.content.channel,this.selectedChannel?.channel);
        if(data.channel === this.item?.channel){
            this.counter = data.messages.length; // reset
        }
    }

    selectChannel = (e) => {
        this.dispatchEvent(new CustomEvent("select", { 
            detail:{value:this.item.name},
            bubbles: true,composed: true 
        }));
    }

    removeChannel = () => {
        this.item.unsubscribe();
        this.dispatchEvent(new CustomEvent("delete", { 
            detail:{value:this.item.name},
            bubbles: true,composed: true 
        }));
    }
    

    /** Methods  **/

    /** Getters */

    get formatedMessageCount(){
        return this.counter;
    }

    get itemClass(){
        return classSet("slds-p-around_small slds-border_bottom channel-item slds-grid slds-wrap slds-justify-content-space-between slds-align-items_center")
        .add({
            'slds-is-active':this.selectedItem == this.item.name,
        }).toString();
    }

}