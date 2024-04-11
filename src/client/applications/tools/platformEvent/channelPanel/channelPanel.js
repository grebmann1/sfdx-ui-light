import { api,track,wire } from "lwc";
import { decodeError,isNotUndefinedOrNull } from 'shared/utils';
import FeatureElement from 'element/featureElement';
import {
    connectStore,
    store,
    loadRecentChannels
} from 'platformevent/store';

export default class ChannelPanel extends FeatureElement {

    isLoading = false;

    @api items = [];
    @api selectedItem;
    @track recentChannels = [];
   
    @wire(connectStore, { store })
    storeChange({ channel,ui }) {
        if (channel) {
            console.log('channel',channel);
        }
        if(ui && ui.recentChannels){
            this.recentChannels = ui.recentChannels;
        }
    }


    connectedCallback() {
        store.dispatch(loadRecentChannels(this.connector.header.alias));
    }


    /** Events **/
    
    handleSelectChannel = (e) => {
        const { key } = e.target.dataset;
        const selectedChannel = this.recentChannels.find(x => x === key);
        if (selectedChannel) {
            this.dispatchEvent(new CustomEvent("recentselect", { 
                detail:{value:selectedChannel},
                bubbles: true,composed: true 
            }));
            this.template.querySelector('lightning-tabset').activeTabValue = 'Subscribed';
            //store.dispatch(updateSoql({connector:this.connector.conn,soql:selectedQuery.soql}));
        }
    }


    /** Methods  **/


    /** Getters */


  
}