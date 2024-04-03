import moment from 'moment';
const STATUS_NEW = 'New';
const STATUS_SUBSCRIBED = 'Subscribed';
const STATUS_UNSUBSCRIBED = 'Unsubscribed';
const STATUS_ERROR = 'Error';

export class PlatformEvent {
    name;
    status;
    messages = [];

    _subscription;
    _instance;

    constructor({name}) {
        this.name = name;
        this.status = STATUS_NEW;
    }

    subscribe = (instance,callback) => {
        try{
            this._instance = instance;
            this._subscription = instance.subscribe(`/event/${this.name}`, (message) => {
                const item = { id: Date.now(),receivedDate: Date.now(),content: message};
                console.log('Received message:', item);
                this.messages.push(item);
                callback(item);
            });
            this.status = STATUS_SUBSCRIBED;
        }catch(e){
            this.status = STATUS_ERROR;
        }
    }

    unsubscribe = () => {
        this._instance.unsubscribe(this._subscription,null,()=>{
            this.status = STATUS_UNSUBSCRIBED;
        });
    }

    /** Getters **/
    get channel(){
        return `/event/${this.name}`;
    }

    get badgeClass(){
        return this.status == STATUS_SUBSCRIBED ? 'slds-theme_success': (this.status == STATUS_ERROR ? 'slds-theme_error' : 'slds-badge');
    }

    get formattedReceivedDate(){
        return moment(this.receivedDate).format(); 
    }
}