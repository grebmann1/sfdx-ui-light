import { LightningElement,api,track} from "lwc";
import { isUndefinedOrNull,classSet,ROLES } from "shared/utils";
import ToolkitElement from 'core/toolkitElement';


export default class Message extends ToolkitElement {

   
    @api item;

    connectedCallback(){

    }


    /** Methods **/

    

    /** Events **/


    /** Getters **/

    get isUser(){
        return this.item?.role === ROLES.USER;
    }

    get originMessage(){
        return this.isUser?'You':'Assistant';
    }

    get body(){
        return this.item?.content || '';
    }

    get itemClass(){
        return classSet('slds-chat-listitem ')
        .add({
            'slds-chat-listitem_outbound':this.isUser,
            'slds-chat-listitem_inbound':!this.isUser
        }).toString();
    }

    get itemMessageClass(){
        return classSet('slds-chat-message__text')
        .add({
            'slds-chat-message__text_outbound':this.isUser,
            'slds-chat-message__text_inbound':!this.isUser
        }).toString();
    }
}