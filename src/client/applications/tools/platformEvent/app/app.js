import { api,track } from "lwc";
import { decodeError,isNotUndefinedOrNull,isUndefinedOrNull,guid } from 'shared/utils';
import FeatureElement from 'element/featureElement';
import { PlatformEvent } from 'platformevent/utils';



import lib from 'cometd';



const cometd = new lib.CometD();


export default class App extends FeatureElement {

    isLoading = false;
    channelName;// = 'CCR_TaskNotification__e'; 
    // Apex
    apexScript; // ='CCR_TaskNotification__e event = new CCR_TaskNotification__e();\n// Publish the event\nDatabase.SaveResult result = EventBus.publish(event);';
    isApexContainerDisplayed = false;
    isApexRunning = false;

    @track subscribedChannels = [];


    /** */
    @track messagesDisplayed = [];//[{id:1712150227604,receivedDate:1712150227604,content:{channel:"/event/CCR_TaskNotification__e",data:{event:{EventApiName:"CCR_TaskNotification__e",EventUuid:"b2d74e15-07db-4856-81f2-aa65e904bb64",replayId:1499957}}}}];
    @track selectedChannel; //new PlatformEvent({name:'CCR_TaskNotification__e'});
    @track selectedEventItem;// = this.messagesDisplayed[0];


    connectedCallback(){
        console.log('cometd',cometd,this.connector);
        cometd.configure({
            url: `/cometd/${guid()}`,
            requestHeaders: {
              Authorization: `Bearer ${this.connector.conn.accessToken}`,
              'salesforceproxy-endpoint':`${this.connector.conn.instanceUrl}/cometd/${this.connector.conn.version}/`
            },
            appendMessageTypeToURL : false,
            //logLevel: 'debug'
        });
        //cometd.websocketEnabled = false;

        cometd.handshake(status => {
            //console.log('Status is',status);
            if(!status.successful){
                console.error('Error during handshake');
            }else{
                console.log('Connected');
            }
        });
    }

    disconnectedCallback() {
        if (cometd) {
            // Unsubscribe from the channel
            cometd.unsubscribeAll();

            // Disconnect from the CometD server
            cometd.disconnect();

            //console.log('Disconnected from CometD server');
        }
    }


    /** Events **/

    handleToggleChange = (e) => {
        this.isApexContainerDisplayed = e.detail.checked;
    }

    handleChannelNameChange = (e) => {
        this.channelName = e.detail.value;
        e.currentTarget.setCustomValidity('');
        e.currentTarget.reportValidity();
    }

    handleApexScriptChange = (e) => {
        this.apexScript = e.detail.value;
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

    handleReceivedMessage = (item) => {
        //console.log('handleReceivedMessage',item);
        if(item.content.channel === this.selectedChannel?.channel){
            this.messagesDisplayed.push(item);
        }
    }
    handleEmptyMessages = () => {
        // Reset message list
        this.messagesDisplayed = [];
    }

    subscribeChannel = (e) => {
        const input = this.template.querySelector('.input-validate')
        if(this.subscribedChannels.map(x => x.name).includes(this.channelName)){
            input.setCustomValidity('Already subscribed');
            input.reportValidity();
            return;
        }
        const newEvent = this.newPlatformEvent();
        newEvent.subscribe(cometd,this.handleReceivedMessage)
        this.subscribedChannels.push(newEvent);
        this.selectedChannel = newEvent; // assign as selected event
        console.log('this.selectedChannel',this.selectedChannel);
    }

    unsubscribeChannel = (e) => {}

    handleChannelSelection = (e) => {
        const name = e.detail.value;
        const _item = this.subscribedChannels.find(x => x.name == name);
        if(_item){
            this.selectedChannel = _item;
            this.messagesDisplayed = this.selectedChannel.messages;
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
        console.log('executeApex');
        this.connector.conn.tooling.executeAnonymous(this.apexScript, (err, res) => {
            console.log('err, res',err, res);
            if (err) { 
                return console.error(err);
            }else if(!res.success){
                const input = this.template.querySelector('.input-apex');
                input.setCustomValidity(`Error: ${res.compileProblem}`);
                input.reportValidity();
            }

            this.isApexRunning = false;
            // ...
        });
    }

    /** Methods  **/

    newPlatformEvent = () => {
        return new PlatformEvent({
            name:this.channelName
        });
    }

    /** Getters */

    get selectedChannelName(){
        return this.selectedChannel?.name;
    }

    get isSubscribeDisabled(){
        return isUndefinedOrNull(this.channelName);
    }

    get isSelectedChannelDisplayed(){
        return isNotUndefinedOrNull(this.selectedChannel);
    }

    get isExecuteApexDisabled(){
        return isUndefinedOrNull(this.apexScript) || this.isApexRunning;
    }

    get isEventViewerDisplayed(){
        return isNotUndefinedOrNull(this.selectedEventItem);
    }
  
}