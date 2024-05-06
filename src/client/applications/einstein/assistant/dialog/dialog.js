import { LightningElement,api,track} from "lwc";
import { isUndefinedOrNull,isEmpty,ROLES,guid } from "shared/utils";
import FeatureElement from 'element/featureElement';
import { upsertThreadList,storeThread,getThread } from 'assistant/utils';

export default class Dialog extends FeatureElement {

    worker;
    @api threadId;
    isLoading = false;

    @api openaiKey;
    @api openaiAssistantId;

    @track messages = [];

    connectedCallback(){
        this.worker = new Worker(chrome.runtime.getURL('workers/openaiWorker/worker.js'));

        this.worker.addEventListener('message',this.handleMessage);
        this.worker.addEventListener('error', this.handleError);

        this.loadExistingThread();
       
    }

    disconnectedCallback(){
        if(this.worker){
            this.worker.removeEventListener('message',this.handleMessage);
            this.worker.removeEventListener('error', this.handleError);
            this.worker.terminate();
        }
        
    }



    /** Methods **/

    loadExistingThread = async () => {
        if(this.threadId){
            this.messages = await getThread(this.threadId);
            this.scrollToBottom();
        }
    }
    

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

    scrollToBottom = () => {
        window.setTimeout(()=> {
            const messageElements = this.template.querySelectorAll('assistant-message');
            if(this.isLoading){
                this.template.querySelector('.slds-chat-listitem').scrollIntoView({ behavior: 'smooth', block: 'end' });
            }else{
                messageElements[messageElements.length - 1].scrollIntoView({ behavior: 'smooth', block: 'end' });
            }
            
        },100);
    }

    /** Events **/
    handleSendClick = () => {
        const value = this.template.querySelector('.slds-publisher__input').value;
        if(!isEmpty(value)){
            this.isLoading = true;
            this.messages.push({
                role:ROLES.USER,
                content:value,
                id:guid()
            })
            this.scrollToBottom();
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
            storeThread(this.threadId,this.messages);
            upsertThreadList(this.threadId);
            this.scrollToBottom();
        //worker.terminate(); // don't forget to delete worker
        }
        
    }

    handleError = (error) => {
        console.error(error); // handle error
        worker.terminate(); // don't forget to delete worker
        this.isLoading = false;
    };



    /** Getters **/

    
}