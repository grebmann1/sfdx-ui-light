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
        return JSON.stringify(this.item, null, 4);
    }

  
}