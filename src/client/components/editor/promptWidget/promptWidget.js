import { LightningElement, api,track } from 'lwc';
import { runActionAfterTimeOut,guid,isEmpty } from 'shared/utils';
import LOGGER from 'shared/logger';
import { ROLES } from 'ai/utils';
import ASSISTANTS from 'ai/assistants';

export default class PromptWidget extends LightningElement {
    
    @api value = ''; // For text input binding
    @api context = '';
    @api selectedText = '';



    @track isLoading = false;

    /** Methods */
    connectedCallback(){
        this.setFocus();
    }
    
    /** Methods */

    setFocus = () => {
        setTimeout(() => {
            this.template.querySelector('textarea').focus();
        }, 50); //
    }

    /** Event Handlers */

    handleTextChange(event) {
        this.value = event.target.value;
    }

    handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey && !this.isLoading) {
            e.preventDefault();
            e.stopPropagation();
            this.handleGenerate();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            this.handleClose();
        }
    }


    // Emit an event when the button is clicked
    handleGenerate = async ()=> {
        const instructions = this.template.querySelector('textarea').value;
        this.isLoading = true;
        try{
            const assistant = new ASSISTANTS.Assistant({
                name: 'editor-complete',
                instructions: `You are an AI Assistant that will execute the instructions of the user taking this text/code into context to generate code/text : \n"""\n${this.context}\n"""`
            }).init();
            const messages = await assistant.addMessages([
                {
                    role:ROLES.USER,
                    content: `Instructions: ${instructions}
                                Selected Text to modify: \`\`\`${isEmpty(this.selectedText) ? this.context : this.selectedText}\`\`\`
                                Output the selected text with the modification requested without any additional text or comments.
                            `
                }
            ]).execute();

            LOGGER.agent('messages',messages);

            const message = messages[messages.length - 1];
            const output = message.content;
            if(output){
                this.dispatchEvent(new CustomEvent('generate', { 
                    detail: { output }
                }));
            }
        }catch(error){
            LOGGER.error('handleGenerate',error);
        }finally{
            this.isLoading = false;
        }
    }

    handleClose() {
        this.value = null;
        this.dispatchEvent(new CustomEvent('close'));
    }

    /** getters */
    get hasText() {
        return !isEmpty(this.value);
    }

    get label() {
        return this.isLoading ? 'Generating...' : 'Generate';
    }
}
