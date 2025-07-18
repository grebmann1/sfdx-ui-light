import { LightningElement, api, track } from 'lwc';
import Toast from 'lightning/toast';
import LOGGER from 'shared/logger';
import { isEmpty, isUndefinedOrNull } from 'shared/utils';
import { ROLES } from 'ai/utils';
import ASSISTANTS from 'ai/assistants';
import {
    ctrlKStream_userMessage,
    ctrlKStream_systemMessage,
    voidPrefixAndSuffix,
    defaultQuickEditFimTags,
    StreamParser,
} from './utils/utils';
import hotkeysManager from './utils/hotkeysmanager';

// Export the MonacoLwcWidget class
export { MonacoLwcWidget } from './widget/monacoLwcWidget.js';

/**
 * A widget component that provides code completion and generation capabilities
 * using AI assistance. It integrates with the Monaco editor to provide
 * intelligent code suggestions and completions.
 */
export default class EditorCompleteWidget extends LightningElement {
    // ===== Public API Properties =====
    @api value = '';
    @api context = '';
    @api selectedText = null;
    @api extraInstructions = '';
    @api file;
    @api selection;

    // ===== Tracked Properties =====
    @track height = 0;
    @track isLoading = false;
    @track isApprovalDisplayed = false;
    @track currentAssistant = null;

    // ===== Lifecycle Methods =====
    connectedCallback() {
        this.setFocus();
        requestAnimationFrame(() => this.updateHeight());
    }

    disconnectedCallback() {
        LOGGER.debug('unsubscribing hotkeys');
        hotkeysManager.unsubscribe('ctrl+enter,command+enter', this.handleAccept);
        hotkeysManager.unsubscribe('ctrl+backspace,command+backspace', this.handleClose);
    }

    renderedCallback() {
        this.updateHeight();
    }

    // ===== UI Interaction Methods =====
    /**
     * Sets focus on the textarea element
     */
    @api
    setFocus = () => {
        this.isApprovalDisplayed = false; // If we set the focus on the textarea, we need to reset the approval display
        setTimeout(() => {
            const textarea = this.template.querySelector('textarea');
            textarea?.focus();
        }, 50);
    };

    /**
     * Handles input changes in the textarea
     * @param {Event} e - The input event
     */
    handleInput = e => {
        this.value = e.target.value;
    };

    /**
     * Handles keyboard events
     * @param {KeyboardEvent} e - The keyboard event
     */
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

    // ===== Code Generation Methods =====
    /**
     * Initiates code generation based on input instructions
     */
    handleGenerate = async () => {
        if (isEmpty(this.value)) return;

        this.isLoading = true;
        try {
            const result = await this.generateCode();
            if (result) {
                this.handleGenerationSuccess(result);
            }
        } catch (error) {
            this.handleGenerationError(error);
        } finally {
            this.isLoading = false;
        }
    };

    /**
     * Generates code using the AI assistant
     * @returns {Promise<string>} The generated code
     */
    async generateCode() {
        const { startLine, endLine, prefix, suffix, originalCode, language } =
            this.prepareGenerationContext();
        const { userContent, systemContent } = this.prepareAssistantMessages(
            prefix,
            suffix,
            originalCode,
            language
        );

        let fullTextSoFar = '';
        this.currentAssistant = new ASSISTANTS.Assistant({ name: 'editor-complete' });

        const responses = await this.currentAssistant
            .init()
            .setInstructions(systemContent)
            .addMessages([{ role: ROLES.USER, content: userContent }])
            .onStream(this.handleTextStream(fullTextSoFar)) // handleTextStream is a function that returns a function that handles the text stream
            .onStreamEnd(message => {
                this.handleTextEnd(message.content);
            })
            .execute();

        this.currentAssistant = null;
        return this.parseFinalResponse(responses);
    }

    /**
     * Prepares the context for code generation
     * @returns {Object} Generation context
     */
    prepareGenerationContext() {
        const isFullFile = isUndefinedOrNull(this.selection) || this.selection.range.isEmpty();
        const { startLine, endLine } = this.getSelectionLines(isFullFile);
        const { prefix, suffix } = voidPrefixAndSuffix({
            fullFileStr: this.file.content,
            startLine,
            endLine,
        });
        const originalCode = this.getOriginalCode(isFullFile, startLine, endLine);
        const language = this.file.language;

        return { startLine, endLine, prefix, suffix, originalCode, language };
    }

    /**
     * Prepares messages for the AI assistant
     * @param {string} prefix - Code prefix
     * @param {string} suffix - Code suffix
     * @param {string} originalCode - Original code
     * @param {string} language - Programming language
     * @returns {Object} Prepared messages
     */
    prepareAssistantMessages(prefix, suffix, originalCode, language) {
        const userContent = ctrlKStream_userMessage({
            selection: originalCode,
            instructions: this.value,
            prefix,
            suffix,
            isOllamaFIM: false,
            fimTags: defaultQuickEditFimTags,
            language,
        });
        const systemContent = ctrlKStream_systemMessage({
            quickEditFIMTags: defaultQuickEditFimTags,
        });

        return { userContent, systemContent };
    }

    /**
     * Handles streaming text updates
     * @param {string} fullTextSoFar - Current full text
     * @returns {Function} Text handler function
     */
    handleTextStream(fullTextSoFar) {
        return message => {
            const parser = new StreamParser(
                `<${defaultQuickEditFimTags.midTag}>`,
                `</${defaultQuickEditFimTags.midTag}>`
            );
            parser.is(message.content);
            const parsedText = parser.getResult();

            if (fullTextSoFar !== parsedText) {
                this.dispatchEvent(
                    new CustomEvent('text', {
                        detail: {
                            text: fullTextSoFar,
                            delta: parsedText.substring(fullTextSoFar.length),
                            fullText: parsedText,
                        },
                    })
                );
                fullTextSoFar = parsedText;
            }
        };
    }

    /**
     * Handles the end of text streaming
     * @param {string} content - Final content
     */
    handleTextEnd = content => {
        const parser = new StreamParser(
            `<${defaultQuickEditFimTags.midTag}>`,
            `</${defaultQuickEditFimTags.midTag}>`
        );
        parser.is(content);
        const parsedText = parser.getResult();

        this.dispatchEvent(
            new CustomEvent('textend', {
                detail: { fullText: parsedText },
            })
        );
    };

    /**
     * Parses the final response from the assistant
     * @param {Array} responses - Assistant responses
     * @returns {string} Parsed text
     */
    parseFinalResponse(responses) {
        const message = responses[responses.length - 1];
        const parser = new StreamParser(
            `<${defaultQuickEditFimTags.midTag}>`,
            `</${defaultQuickEditFimTags.midTag}>`
        );
        parser.is(message.content);
        return parser.getResult();
    }

    // ===== Selection and Code Management =====
    /**
     * Gets the selection line numbers
     * @param {boolean} isFullFile - Whether the entire file is selected
     * @returns {Object} The start and end line numbers
     */
    getSelectionLines(isFullFile) {
        return {
            startLine: isFullFile ? 1 : this.selection?.range?.startLineNumber || 1,
            endLine: isFullFile
                ? this.file.range.endLineNumber
                : this.selection?.range?.endLineNumber,
        };
    }

    /**
     * Gets the original code based on selection
     * @param {boolean} isFullFile - Whether the entire file is selected
     * @param {number} startLine - Start line number
     * @param {number} endLine - End line number
     * @returns {string} The selected code
     */
    getOriginalCode(isFullFile, startLine, endLine) {
        return isFullFile
            ? this.file.content
            : this.file.content
                  .split('\n')
                  .slice(startLine - 1, endLine)
                  .join('\n');
    }

    // ===== Event Handlers =====
    /**
     * Handles successful code generation
     * @param {string} output - The generated code
     */
    handleGenerationSuccess(output) {
        if (!output) return;

        this.isApprovalDisplayed = true;
        hotkeysManager.subscribe('ctrl+enter,command+enter', this.handleAccept);
        hotkeysManager.subscribe('ctrl+backspace,command+backspace', this.handleClose);
        this.dispatchEvent(
            new CustomEvent('generate', {
                detail: { output },
            })
        );
    }

    /**
     * Handles code generation errors
     * @param {Error} error - The error object
     */
    handleGenerationError(error) {
        LOGGER.error('Code generation failed', error);

        // If the error is an AbortError, don't show the error toast
        if (error.name !== 'AbortError') {
            Toast.show({
                message: 'Error while generating the code/text. Please try again.',
                theme: 'error',
                label: 'Error',
            });
        }

        // Clear any partial generation
        //
        /* this.dispatchEvent(
            new CustomEvent('refresh')
        ); */
    }

    /**
     * Clears the input field
     */
    clearInput() {
        const textarea = this.template.querySelector('textarea');
        if (textarea) {
            textarea.value = '';
        }
        this.value = '';
    }

    /**
     * Handles closing the widget
     */
    handleClose = () => {
        if (this.isLoading) {
            this.handleStop();
        }
        this.clearInput();
        this.dispatchEvent(new CustomEvent('close'));
    };

    /**
     * Handles approving the generated code
     */
    handleAccept = () => {
        this.clearInput();
        this.dispatchEvent(new CustomEvent('approve'));
    };

    // ===== UI Update Methods =====
    /**
     * Updates the widget height
     */
    updateHeight() {
        const element = this.template.querySelector('.prompt-widget-container');
        if (element) {
            this.height = element.clientHeight;
            this.dispatchEvent(
                new CustomEvent('heightchange', {
                    detail: { height: this.height },
                })
            );
        }
    }

    /**
     * Handles stopping the current generation
     */
    handleStop = () => {
        if (this.currentAssistant) {
            this.currentAssistant.stopExecution();
            this.currentAssistant = null;
            this.isLoading = false;
            // Dispatch a textend event with empty content to clear any partial generation
            this.dispatchEvent(
                new CustomEvent('textend', {
                    detail: { fullText: this.getOriginalCode(true) },
                })
            );
        }
    };

    // ===== Getters =====
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

    get isTextareaDisabled() {
        return this.isLoading || this.isApprovalDisplayed;
    }
}
