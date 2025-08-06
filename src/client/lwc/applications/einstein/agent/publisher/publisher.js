import { LightningElement, api, track, wire } from 'lwc';
import {
    isEmpty,
    isChromeExtension,
    runActionAfterTimeOut
} from 'shared/utils';
import ToolkitElement from 'core/toolkitElement';

export default class App extends ToolkitElement {
    isLoading = false;

    @api openaiKey;
    @api isAudioRecorderDisabled = false;

    // prompt
    _prompt;

    // Error
    error_title;
    error_message;
    errorIds;

    hasRendered = false;


    renderedCallback(){
        if(!this.hasRendered){  
            this.hasRendered = true;
            setTimeout(()=>{
                this.template.querySelector('.slds-publisher__input').focus();
            },300);
        }
    }


    /** Methods **/

    resetError = () => {
        this.error_title = null;
        this.error_message = null;
    };

    resetPrompt = () => {
        this._prompt = null;
        this.template.querySelector('.slds-publisher__input').value = null; // reset
    };


    /** Events **/


    handleInputChange = e => {
        runActionAfterTimeOut(
            e.target.value,
            async newValue => {
                this._prompt = newValue;
            },
            { timeout: 100 }
        );
    };

    handleKeyDown = e => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault(); // Prevent the default behavior of Enter key
            this.handleSendClick();
        }
    };

    handleClearClick = e => {
        this.resetPrompt();
        this.dispatchEvent(new CustomEvent('clear'));
    };

    handleSpeechChange = e => {
        const speech = e.detail.value;
        //console.log('speech data',speech);
        this._prompt = speech;
        this.template.querySelector('.slds-publisher__input').value = speech;
    };


    handleSendClick = async () => {
        const value = this.template.querySelector('.slds-publisher__input').value;
        if (!isEmpty(value)) {
            this.resetPrompt();
            this.dispatchEvent(new CustomEvent('send', { detail: { prompt: value.trim() } }));
        }
    };
    


    /** Getters **/

    get isAudioAssistantDisplayed() {
        return !isEmpty(this.openaiKey) && !isChromeExtension();
    }

    get isClearButtonDisabled() {
        return this.isLoading;
    }

    get isSendButtonDisabled() {
        return this.isLoading || isEmpty(this._prompt);
    }

    get isAudioRecorderDisplayed() {
        return !this.isAudioRecorderDisabled;
    }
}
