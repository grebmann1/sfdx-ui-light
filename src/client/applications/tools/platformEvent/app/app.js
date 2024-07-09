import { api,track,wire } from "lwc";
import { decodeError,isNotUndefinedOrNull,isUndefinedOrNull,guid,isEmpty,checkIfPresent } from 'shared/utils';
import { PlatformEvent } from 'platformevent/utils';
import { connectStore,store } from 'platformevent/store';

import ToolkitElement from 'core/toolkitElement';
import Toast from 'lightning/toast';
import lib from 'cometd';



const cometd = new lib.CometD();


export default class App extends ToolkitElement {

    isLoading = false;
    channelName;// = 'CCR_TaskNotification__e'; 
    // Apex
    apexScript = ''; // ='CCR_TaskNotification__e event = new CCR_TaskNotification__e();\n// Publish the event\nDatabase.SaveResult result = EventBus.publish(event);';
    isApexContainerDisplayed = false;
    isManualChannelDisplayed = false;
    isApexRunning = false;

    @track subscribedChannels = [];
    @track eventObjects = [];


    /** */
    @track messagesDisplayed = [];//[{id:1712150227604,receivedDate:1712150227604,content:{channel:"/event/CCR_TaskNotification__e",data:{event:{EventApiName:"CCR_TaskNotification__e",EventUuid:"b2d74e15-07db-4856-81f2-aa65e904bb64",replayId:1499957}}}}];
    @track selectedChannel; //new PlatformEvent({name:'CCR_TaskNotification__e'});
    @track selectedEventItem;// = this.messagesDisplayed[0];


    /** Lookup */
    @track lookup_selectedEvents = [];
    @track lookup_errors = [];

    @wire(connectStore, { store })
    storeChange({ channel }) {
        if (channel) {
            this.store_handleReceivedMessage(channel)
        }
    }


    connectedCallback(){
        this.loadCache();
        this.describeAll();
        cometd.configure({
            url: `/cometd/${guid()}`,
            requestHeaders: {
              Authorization: `Bearer ${this.connector.conn.accessToken}`,
              'salesforceproxy-endpoint':`${this.connector.conn.instanceUrl}/cometd/${this.connector.conn.version}/`
            },
            appendMessageTypeToURL : false,
            //logLevel: 'debug'
        });
        cometd.handshake(status => {
            if(!status.successful){
                console.error('Error during handshake',status);
            }else{
                //console.log('Connected');
            }
        });
    }

    disconnectedCallback() {
        if (cometd) {
            // Unsubscribe from the channel
            cometd.clearSubscriptions();
            // Disconnect from the CometD server
            cometd.disconnect();
        }
    }


    /** Events **/

    handleMonacoLoaded = (e) => {
        //console.log('loaded');
        this.refs.editor.displayFiles(
            'ApexClass',[
                {   
                    id:'abc',
                    path:'abc',
                    name:'Script',
                    apiVersion:60,
                    body:this.apexScript,
                    language:'apex',
                }
            ]
        );
    }

    handleEditorChange = (e) => {
        //console.log('handleEditorChange',e.detail);
        this.apexScript = e.detail.value;
        let key = `${this.connector.configuration.alias}-platformevent-script`;
        window.defaultStore.setItem(key,this.apexScript);
    }

    handleApexToggleChange = (e) => {
        this.isApexContainerDisplayed = e.detail.checked;
    }

    handleManualChannelToggleChange = (e) => {
        this.isManualChannelDisplayed = e.detail.checked;
    }

    handleChannelNameChange = (e) => {
        this.channelName = e.detail.value;
        e.currentTarget.setCustomValidity('');
        e.currentTarget.reportValidity();
    }

    handleEventSelection = (e) => {
        //console.log('handleEventSelection',e.detail);
        this.selectedEventItem = e.detail.value;
        try{
            this.messagesDisplayed.find(x => x.id == this.selectedEventItem.id).isRead = true;
            this.subscribedChannels.find(x => x.name == this.selectedChannelName).messages.find(x => x.id == this.selectedEventItem.id).isRead = true;
        }catch(e){
            console.error('Issue update events',e);
        }
    }

    store_handleReceivedMessage = (data) => {
        //console.log('handleReceivedMessage',item.content.channel,this.selectedChannel?.channel);
        if(data.channel === this.selectedChannel?.channel){
            this.messagesDisplayed = [...data.messages]; // reset
        }
    }

    handleEmptyMessages = () => {
        // Reset message list
        this.selectedChannel.cleanMessages(); 
        this.selectedEventItem = null;
    }

    subscribeChannel = (e) => {
        const eventName = this.isManualChannelDisplayed?this.subscribe_manual():this.subscribe_lookup();
        this.cometdSubscribe(eventName);
        this.template.querySelector('platformevent-channel-panel').showSubscribedTab();
    }

    cometdSubscribe = (eventName) => {
        const newEvent = this.newPlatformEvent(eventName);
            newEvent.subscribe(cometd)
        this.subscribedChannels.push(newEvent);
        // Display new Channel
        this.selectedChannel = newEvent; 
        this.messagesDisplayed = newEvent.messages;
        // Reset
        this.channelName = null;
        this.lookup_selectedEvents = [];
    }

    subscribe_manual = () => {
        const input = this.template.querySelector('.input-validate')
        if(this.subscribedChannels.map(x => x.name).includes(this.channelName)){
            input.setCustomValidity('Already subscribed !');
            input.reportValidity();
            return;
        }else if(!this.channelName.startsWith('/')){
            input.setCustomValidity('Wrong Format, please follow this approach : /event/dummmy__e');
            input.reportValidity();
            return;
        }
    }

    subscribe_lookup = () => {
        if(this.lookup_selectedEvents.length == 0) return null;

        const apiName = this.lookup_selectedEvents[0].id;
        //console.log('apiName',apiName);
        const eventName = apiName.endsWith('__e')?`/event/${apiName}`:`/data/${apiName}`;
        if(this.subscribedChannels.map(x => x.name).includes(eventName)){
            this.lookup_errors.push({ message:"Already subscribed !"})
        }

        return eventName;
    }

    unsubscribeChannel = (e) => {}

    handleChannelSelection = (e) => {
        const name = e.detail.value;
        const _item = this.subscribedChannels.find(x => x.name == name);
        if(_item){
            this.selectedChannel = _item;
            this.messagesDisplayed = _item.messages;
        }
    }

    handleRecentChannelSelection = (e) => {
        const eventName = e.detail.value;
        if(!this.subscribedChannels.map(x => x.name).includes(eventName)){
            this.cometdSubscribe(eventName)
        }
    }

    handleChannelDeletion = (e) => {
        const name = e.detail.value;
        this.subscribedChannels = this.subscribedChannels.filter(x => x.name != name);
        if(this.selectedChannel?.name == name){
            // reset
            this.selectedChannel = null;
            this.selectedEventItem = null;
        }
    }

    executeApex = (e) => {
        this.isApexRunning = true;
        this.refs.editor.executeApex(null,(err,res) => {
            if(res.success){
                Toast.show({
                    label: 'Apex run : Success',
                    //message: 'Exported to your clipboard', // Message is hidden in small screen
                    variant:'success',
                });
            }else{
                Toast.show({
                    label: 'Apex run : Failed',
                    message: res.exceptionMessage, // Message is hidden in small screen
                    variant:'error',
                });
                //console.log('res',res,err);
            }
            this.isApexRunning = false;
        });
    }

    lookup_handleSearch = (e) => {
        const lookupElement = e.target;
        const keywords = e.detail.rawSearchTerm;
        const results = this.eventObjects.filter(x => checkIfPresent(x.name,keywords)).map(x => this.formatForLookup(x.name));
        lookupElement.setSearchResults(results);
    }

    lookup_handleSelectionChange = (e) => {
        const selection = this.template.querySelector('slds-lookup').getSelection();
        this.lookup_selectedEvents = selection;
    }

    

    /** Methods  **/

    formatForLookup = (item) => {
        return {
            id: item,
            title: item
        };
    }

    load_toolingGlobal = async () => {
        let result = await this.connector.conn.describeGlobal();
        return result?.sobjects || [];
    }

    describeAll = async () => {
        this.isLoading = true;
        try{
            const records = (await this.load_toolingGlobal()) || [];
            this.eventObjects = records.filter(x => x.name.endsWith('ChangeEvent') || x.name.endsWith('__e'));
        }catch(e){
            console.error(e);
        }
        this.isLoading = false;
    }

    loadCache = async () => {
        try{
            let key = `${this.connector.configuration.alias}-platformevent-script`;
            const _script = await window.defaultStore.getItem(key);
            if(!isEmpty(_script)){
                this.apexScript = _script;
            }
        }catch(e){
            console.error(e);
        }
    }

    newPlatformEvent = (name) => {
        return new PlatformEvent({
            name,
            alias:this.connector.configuration.alias
        });
    }

    /** Getters */

    get selectedChannelName(){
        return this.selectedChannel?.name;
    }

    get isSubscribeDisabled(){
        return isUndefinedOrNull(this.channelName) && (isUndefinedOrNull(this.lookup_selectedEvents) || this.lookup_selectedEvents.length == 0);
    }

    get isSelectedChannelDisplayed(){
        return isNotUndefinedOrNull(this.selectedChannel);
    }

    get isExecuteApexDisabled(){
        return isEmpty(this.apexScript) || this.isApexRunning;
    }

    get isEventViewerDisplayed(){
        return isNotUndefinedOrNull(this.selectedEventItem);
    }
  
}