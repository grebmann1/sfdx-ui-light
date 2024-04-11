import moment from 'moment';
import {
    store,
    receiveMessageSuccess,
    subscribeChannelSuccess,
    cleanMessages
} from 'platformevent/store';

const STATUS_NEW = 'New';
const STATUS_SUBSCRIBED = 'Subscribed';
const STATUS_UNSUBSCRIBED = 'Unsubscribed';
const STATUS_ERROR = 'Error';

export class PlatformEvent {
    name;
    alias; // for storage & filter
    status;
    messages = [];

    _subscription;
    _instance;

    constructor({name,alias}) {
        this.name = name;
        this.status = STATUS_NEW;
        this.alias = alias;
    }

    subscribe = (instance) => {
        try{
            this._instance = instance;
            this._subscription = instance.subscribe(this.name, (message) => {
                const item = { id: message.data.event.replayId,receivedDate: Date.now(),content: message};
                console.log('Received message:', item);
                this.messages.push(item);
                //callback(item);
                store.dispatch(receiveMessageSuccess(item,this.messages,this.name));
            });
            this.status = STATUS_SUBSCRIBED;
            store.dispatch(subscribeChannelSuccess(this.name,this.alias))
        }catch(e){
            this.status = STATUS_ERROR;
        }
    }

    unsubscribe = () => {
        this._instance.unsubscribe(this._subscription,null,()=>{
            this.status = STATUS_UNSUBSCRIBED;
        });
    }

    cleanMessages = () => {
        this.messages = [];
        store.dispatch(cleanMessages(this.name));
    }

    /** Getters **/
    get channel(){
        return this.name;
    }

    get formattedName(){
        return this.name.split('/').slice(-1)[0];
    }

    get badgeClass(){
        return this.status == STATUS_SUBSCRIBED ? 'slds-theme_success': (this.status == STATUS_ERROR ? 'slds-theme_error' : 'slds-badge');
    }

    get formattedReceivedDate(){
        return moment(this.receivedDate).format(); 
    }
}