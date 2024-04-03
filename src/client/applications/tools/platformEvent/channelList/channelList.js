import { api,track } from "lwc";
import { decodeError,isNotUndefinedOrNull } from 'shared/utils';
import FeatureElement from 'element/featureElement';


export default class ChannelList extends FeatureElement {

    isLoading = false;

    @api items = [];
    @api selectedItem;
   


    connectedCallback(){
      
    }


    /** Events **/


    /** Methods  **/


    /** Getters */


  
}