import { api,track } from "lwc";
import { decodeError,isNotUndefinedOrNull } from 'shared/utils';
import FeatureElement from 'element/featureElement';


export default class EventViewer extends FeatureElement {

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