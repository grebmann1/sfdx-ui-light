import { api,track } from "lwc";
import { decodeError,isNotUndefinedOrNull } from 'shared/utils';
import ToolkitElement from 'core/toolkitElement';


export default class EventViewer extends ToolkitElement {

    isLoading = false;

    @api item;
   


    connectedCallback(){
      
    }


    /** Events **/


    /** Methods  **/


    /** Getters */

    get content(){
        const data = this.item?.content || this.item;
        return JSON.stringify(data, null, 4);
    }

  
}