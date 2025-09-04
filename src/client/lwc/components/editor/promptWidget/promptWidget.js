import { LightningElement, api, track } from 'lwc';
import Toast from 'lightning/toast';
import { runActionAfterTimeOut, guid, isEmpty } from 'shared/utils';
import LOGGER from 'shared/logger';
import { ROLES } from 'ai/utils';
import ASSISTANTS from 'ai/assistants';

export default class PromptWidget extends LightningElement {
    @api value = ''; // For text input binding
    @api context = '';
    @api selectedText = '';
    @api extraInstructions = '';
    @track height = 0;

    @track isLoading = false;
    @track isApprovalDisplayed = false;
    connectedCallback() {
        this.setFocus();
        requestAnimationFrame(() => {
            this.updateHeight();
        });
    }

    renderedCallback() {
        this.updateHeight();
    }

    /** Methods */

    setFocus = () => {
        setTimeout(() => {
            const textarea = this.template.querySelector('textarea');
            if (textarea) textarea.focus();
        }, 50); //
    };

    clearInput() {
        const textarea = this.template.querySelector('textarea');
        if (textarea) textarea.value = '';
        this.value = '';
    }

    /** Event Handlers */

    handleInput = e => {
        this.value = e.target.value;
    };

    handleKeyDown = e => {
        if (e.key === 'Enter' && !e.shiftKey && !this.isLoading) {
            e.preventDefault();
            e.stopPropagation();
            this.handleGenerate();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            this.handleClose();
        }
    };

    // Emit an event when the button is clicked
    handleGenerate = async () => {
        const instructions = this.value;
        this.isLoading = true;
        try {
            const assistant = new ASSISTANTS.Assistant({
                name: 'editor-complete',
                instructions: `You are an AI Assistant that will execute the instructions of the user taking this text/code into context to generate code/text : \n"""\n${this.context}\n"""`,
            }).init();
            if (this.extraInstructions) {
                assistant.addContext(this.extraInstructions);
            }
            const messages = await assistant
                .addMessages([
                    {
                        role: ROLES.USER,
                        content: `Instructions: \`\`\`${instructions}\`\`\`
                                Selected Text to modify: \`\`\`${
                                    isEmpty(this.selectedText) ? this.context : this.selectedText
                                }\`\`\`
                                Output the selected text with the modification/enhancement requested without any additional text or comments.
                                Output the code in the same language as the selected text in this format:
                                \`\`\`<language>\n<code>\n\`\`\`
                            `,
                    },
                ])
                .execute();

            const message = messages[messages.length - 1];
            const output = message.content;
            if (output) {
                this.isApprovalDisplayed = true;
                this.clearInput();
                this.dispatchEvent(
                    new CustomEvent('generate', {
                        detail: { output },
                    })
                );
            }
        } catch (error) {
            LOGGER.error('handleGenerate', error);
            Toast.show({
                message: 'Error while generating the code/text. Please try again.',
                theme: 'error',
                label: 'Error',
            });
            this.clearInput();
        } finally {
            this.isLoading = false;
        }
    };

    handleClose() {
        this.clearInput();
        this.isApprovalDisplayed = false;
        this.dispatchEvent(new CustomEvent('close'));
    }

    handleApprove() {
        this.clearInput();
        this.isApprovalDisplayed = false;
        this.dispatchEvent(new CustomEvent('approve'));
    }

    updateHeight() {
        const element = this.template.querySelector('.prompt-widget-container');
        if (element) {
            this.height = element.clientHeight;
            //console.log('Component Height:', this.height);
            this.dispatchEvent(
                new CustomEvent('heightchange', { detail: { height: this.height } })
            );
        }
    }

    /** getters */

    @api
    get internalHeight() {
        return this.height;
    }

    get hasText() {
        return !isEmpty(this.value);
    }

    get label() {
        return this.isLoading ? 'Generating...' : 'Generate';
    }
}
