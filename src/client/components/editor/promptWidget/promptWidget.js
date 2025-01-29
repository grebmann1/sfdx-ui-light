import { LightningElement, api,track } from 'lwc';
import Toast from 'lightning/toast';
import { runActionAfterTimeOut,guid,isEmpty } from 'shared/utils';
import LOGGER from 'shared/logger';
import { ROLES } from 'ai/utils';
import ASSISTANTS from 'ai/assistants';
export default class PromptWidget extends LightningElement {
    
    
    @api value = ''; // For text input binding
    @api context = '';
    @api selectedText = '';
    @api extraInstructions = '';


    @track isLoading = false;

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

    handleInput = (e) => {
        this.value = e.target.value;
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
        const instructions = this.value;
        this.isLoading = true;
        try{
            const assistant = new ASSISTANTS.Assistant({
                name: 'editor-complete',
                instructions: `You are an AI Assistant that will execute the instructions of the user taking this text/code into context to generate code/text : \n"""\n${this.context}\n"""`
            }).init();
            if(this.extraInstructions){
                assistant.addContext(this.extraInstructions);
            }
            const messages = await assistant.addMessages([
                {
                    role:ROLES.USER,
                    content: `Instructions: \`\`\`${instructions}\`\`\`
                                Selected Text to modify: \`\`\`${isEmpty(this.selectedText) ? this.context : this.selectedText}\`\`\`
                                Output the selected text with the modification/enhancement requested without any additional text or comments.
                                Output the code in the same language as the selected text in this format:
                                \`\`\`<language>\n<code>\n\`\`\`
                            `
                }
            ]).execute();

            const message = messages[messages.length - 1];
            const output = message.content;
            if(output){
                this.template.querySelector('textarea').value = null; // Clear the input field
                this.value = null;
                this.dispatchEvent(new CustomEvent('generate', { 
                    detail: { output }
                }));
            }
        }catch(error){
            LOGGER.error('handleGenerate',error);
            Toast.show({
                message: 'Error while generating the code/text. Please try again.',
                theme: 'error',
                label: 'Error'
            });
        }finally{
            this.isLoading = false;
        }
    }

    handleClose() {
        this.template.querySelector('textarea').value = null;
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
