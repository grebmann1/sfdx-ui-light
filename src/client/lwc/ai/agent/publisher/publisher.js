import {  api, track } from 'lwc';
import {
    isEmpty,
    isChromeExtension,
    runActionAfterTimeOut
} from 'shared/utils';
import ToolkitElement from 'core/toolkitElement';
import LOGGER from 'shared/logger';

export default class App extends ToolkitElement {
    @api isLoading = false;

    @api openaiKey;
    @api isAudioRecorderDisabled = false;

    // prompt
    _prompt;

    // Error
    error_title;
    error_message;
    errorIds;

    hasRendered = false;

    selectedFiles = [];
    imagePreviews = {};

    @track dragActive = false;

    get hasFiles() {
        return this.selectedFiles.length > 0;
    }
    get filePills() {
        return this.selectedFiles.map(file => ({
            file,
            isImage: file.type && file.type.startsWith('image/'),
            preview: this.imagePreviews[file.name] || ''
        }));
    }

    triggerFileInput = () => {
        const fileInput = this.template.querySelector('.file-input');
        if (fileInput) {
            fileInput.value = '';
            fileInput.click();
        }
    };

    handleFileChange = (event) => {
        const files = Array.from(event.target.files || []);
        files.forEach(file => {
            if (!this.selectedFiles.find(f => f.name === file.name && f.size === file.size)) {
                this.selectedFiles = [...this.selectedFiles, file];
                if (file.type && file.type.startsWith('image/')) {
                    this.generateImagePreview(file);
                }
            }
        });
    };

    handleDragOver = (event) => {
        event.preventDefault();
        this.dragActive = true;
        this.template.querySelector('.file-upload-container').classList.add('drag-active');
    };

    handleDragLeave = (event) => {
        event.preventDefault();
        this.dragActive = false;
        this.template.querySelector('.file-upload-container').classList.remove('drag-active');
    };

    handleDrop = (event) => {
        event.preventDefault();
        this.dragActive = false;
        this.template.querySelector('.file-upload-container').classList.remove('drag-active');
        const files = Array.from(event.dataTransfer.files || []);
        files.forEach(file => {
            // Only accept images and PDFs
            if ((file.type && file.type.startsWith('image/')) || file.type === 'application/pdf') {
                if (!this.selectedFiles.find(f => f.name === file.name && f.size === file.size)) {
                    this.selectedFiles = [...this.selectedFiles, file];
                    if (file.type && file.type.startsWith('image/')) {
                        this.generateImagePreview(file);
                    }
                }
            }
        });
    };

    generateImagePreview(file) {
        if (!file || !file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            this.imagePreviews = { ...this.imagePreviews, [file.name]: e.target.result };
            this.requestUpdate?.();
        };
        reader.readAsDataURL(file);
    }

    removeSelectedFile = (event) => {
        const name = event.target?.dataset?.filename;
        if (!name) return;
        this.selectedFiles = this.selectedFiles.filter(f => f.name !== name);
        const previews = { ...this.imagePreviews };
        delete previews[name];
        this.imagePreviews = previews;
    };

    get selectedFileName() {
        return this.selectedFiles.length === 1 ? this.selectedFiles[0].name : '';
    }
    get hasImagePreview() {
        return this.selectedFiles.some(f => f.type && f.type.startsWith('image/'));
    }

    handleMicClick = () => {
        // Optionally focus or trigger the audio recorder logic here
        // If you want to open a modal or start recording, add logic here
        // For now, this is a placeholder
    };

    handleStopClick = () => {
        this.dispatchEvent(new CustomEvent('stop'));
    };

    @api
    focusInput() {
        LOGGER.debug('##### focusInput #####');
        const textarea = this.template.querySelector('.chat-textarea');
        if (textarea) {
            textarea.focus();
        }
    }


    renderedCallback(){
        if(!this.hasRendered){  
            this.hasRendered = true;
            setTimeout(()=>{
                this.template.querySelector('.chat-textarea').focus();
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
        this.selectedFiles = [];
        this.imagePreviews = {};
        this.template.querySelector('.chat-textarea').value = null; // reset
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
        this.template.querySelector('.chat-textarea').value = speech;
    };


    handleSendClick = async () => {
        const value = this.template.querySelector('.chat-textarea').value;
        if (!isEmpty(value) || this.selectedFiles.length > 0) {
            this.dispatchEvent(new CustomEvent('send', { detail: { prompt: value.trim(), files: this.selectedFiles } }));
            this.resetPrompt();
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
