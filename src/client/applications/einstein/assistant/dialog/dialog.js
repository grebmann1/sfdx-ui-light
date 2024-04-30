import { LightningElement,api,track} from "lwc";
import { isUndefinedOrNull,isEmpty,ROLES,guid } from "shared/utils";
import FeatureElement from 'element/featureElement';

export default class Dialog extends FeatureElement {

    worker;
    threadId;
    isLoading = false;

    @api openaiKey;
    @api openaiAssistantId;

    @track messages = [];

    connectedCallback(){
        this.worker = new Worker(chrome.runtime.getURL('workers/openaiWorker/worker.js'));

        this.worker.addEventListener('message',this.handleMessage);
        this.worker.addEventListener('error', this.handleError);

        /*const messageTest = localStorage.getItem('messages-test');
        if(!isEmpty(messageTest)){
            this.messages = JSON.parse(messageTest);
        }*/
    }

    disconnectedCallback(){
        if(this.worker){
            this.worker.removeEventListener('message',this.handleMessage);
            this.worker.removeEventListener('error', this.handleError);
            this.worker.terminate();
        }
        
    }



    /** Methods **/
    

    generateMessageForWorker = (content,extraInformation,threadId) => {
        return {
            type:'executeRequest_includingContext',
            openai_key:this.openaiKey,
            openai_assistant_id:this.openaiAssistantId,
            body:{
                content,
                extraInformation,
                threadId
            }
        }
    }

    /** Events **/
    handleSendClick = () => {
        const value = this.template.querySelector('.slds-publisher__input').value;
        console.log('value',value);
        if(!isEmpty(value)){
            this.isLoading = true;
            this.messages.push({
                role:ROLES.USER,
                content:value,
                id:guid()
            })
            this.worker.postMessage(this.generateMessageForWorker(value,null,this.threadId));
            this.template.querySelector('.slds-publisher__input').value  = null; // reset
        }
    }

    handleMessage = (event) => {
        if(event.data.type === 'success'){
            const { answer,extraInformation,threadId } = event.data.data;
            this.messages.push({
                role:ROLES.ASSISTANT,
                content:answer,
                id:guid()
            });
            //console.log('messages',this.messages);
            this.threadId = threadId;
            this.isLoading = false;
            //localStorage.setItem('messages-test',JSON.stringify(this.messages));
            window.setTimeout(()=> {
                const messageElements = this.template.querySelectorAll('assistant-message');
                messageElements[messageElements.length - 1].scrollTo({ top: 0, behavior: 'auto' });
            },100);
        //worker.terminate(); // don't forget to delete worker
        }
        console.log('message',event.data); // handle message
        
    }

    handleError = (error) => {
        console.error(error); // handle error
        worker.terminate(); // don't forget to delete worker
        this.isLoading = false;
    };



    /** Getters **/

    
}