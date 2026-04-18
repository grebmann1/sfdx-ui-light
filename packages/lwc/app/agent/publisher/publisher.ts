import { api, track } from 'lwc';
import { isEmpty, isChromeExtension, runActionAfterTimeOut } from 'shared/utils';
import ToolkitElement from 'core/toolkitElement';
import {
    MODELS,
    INTERNAL_MODELS,
    DEFAULT_MODEL,
    DEFAULT_REASONING,
    REASONING_OPTIONS,
} from 'agent/utils';
import LOGGER from 'shared/logger';

export default class App extends ToolkitElement {
    @api isLoading = false;

    @api openaiKey: string | undefined;
    @api isAudioRecorderDisabled = false;
    @api isInternal = false;
    @api availableModels = MODELS;

    @track selectedModel = DEFAULT_MODEL;
    @track selectedReasoning = DEFAULT_REASONING;

    get resolvedAvailableModels() {
        if (this.isInternal) {
            return INTERNAL_MODELS;
        }
        return Array.isArray(this.availableModels) && this.availableModels.length > 0
            ? this.availableModels
            : MODELS;
    }

    normalizeModelValue = value => {
        const modelOptions = this.resolvedAvailableModels;
        const fallbackModel = modelOptions[0]?.value || DEFAULT_MODEL;
        const raw = typeof value === 'string' ? value.trim() : '';
        if (!raw) return fallbackModel;
        const lowered = raw.toLowerCase();
        const exactValue = modelOptions.find(option => option.value === raw);
        if (exactValue) return exactValue.value;
        const valueCaseInsensitive = modelOptions.find(
            option => String(option.value || '').toLowerCase() === lowered
        );
        if (valueCaseInsensitive) return valueCaseInsensitive.value;
        const labelMatch = modelOptions.find(
            option => String(option.label || '').toLowerCase() === lowered
        );
        if (labelMatch) return labelMatch.value;
        const aliasMatch = modelOptions.find(option =>
            String(option.value || '')
                .toLowerCase()
                .startsWith(`${lowered}-`)
        );
        return aliasMatch ? aliasMatch.value : fallbackModel;
    };

    normalizeReasoningValue = value => {
        const raw = typeof value === 'string' ? value.trim() : '';
        if (!raw) return DEFAULT_REASONING;
        const lowered = raw.toLowerCase();
        const exactValue = REASONING_OPTIONS.find(option => option.value === raw);
        if (exactValue) return exactValue.value;
        const valueCaseInsensitive = REASONING_OPTIONS.find(
            option => String(option.value || '').toLowerCase() === lowered
        );
        if (valueCaseInsensitive) return valueCaseInsensitive.value;
        const labelMatch = REASONING_OPTIONS.find(
            option => String(option.label || '').toLowerCase() === lowered
        );
        return labelMatch ? labelMatch.value : DEFAULT_REASONING;
    };

    @api
    get model() {
        return this.selectedModel;
    }
    set model(val) {
        this.selectedModel = this.normalizeModelValue(val);
    }

    @api
    get reasoning() {
        return this.selectedReasoning;
    }
    set reasoning(val) {
        const normalizedReasoning = this.normalizeReasoningValue(val);
        this.selectedReasoning = normalizedReasoning;
    }

    get isReasoningReadOnly() {
        return !!this.isInternal;
    }

    get showReasoningSelect() {
        return !this.isReasoningReadOnly;
    }

    handleModelChange = event => {
        const model = this.normalizeModelValue(event.target.value);
        this.selectedModel = model;
        this.dispatchEvent(
            new CustomEvent('modelchange', { detail: { model }, bubbles: true, composed: true })
        );
    };

    handleReasoningChange = event => {
        if (this.isReasoningReadOnly) {
            return;
        }
        const reasoning = this.normalizeReasoningValue(event.detail?.value ?? event.target?.value);
        this.selectedReasoning = reasoning;
        this.dispatchEvent(
            new CustomEvent('reasoningchange', {
                detail: { reasoning },
                bubbles: true,
                composed: true,
            })
        );
    };

    // prompt
    _prompt: string | null = null;

    // Error
    error_title: string | null = null;
    error_message: string | null = null;
    errorIds: string[] | undefined;

    hasRendered = false;

    selectedFiles: File[] = [];
    imagePreviews: Record<string, string> = {};

    @track dragActive = false;

    isSupportedFile = (file: File) => {
        if (!file || !file.type) return false;
        return (
            file.type.startsWith('image/') ||
            file.type === 'application/pdf' ||
            file.type === 'text/csv' ||
            file.type === 'application/json' ||
            file.type === 'text/plain'
        );
    };

    triggerFileInput = () => {
        const fileInput = this.template.querySelector('.file-input') as HTMLInputElement | null;
        if (fileInput) {
            fileInput.value = '';
            fileInput.click();
        }
    };

    handleFileChange = event => {
        const files = Array.from(event.target.files || []);
        files.forEach(file => {
            if (this.isSupportedFile(file)) {
                if (!this.selectedFiles.find(f => f.name === file.name && f.size === file.size)) {
                    this.selectedFiles = [...this.selectedFiles, file];
                    if (file.type.startsWith('image/')) {
                        this.generateImagePreview(file);
                    }
                }
            }
        });
    };

    handleDragOver = event => {
        event.preventDefault();
        this.dragActive = true;
        this.template.querySelector('.file-upload-container')?.classList.add('drag-active');
    };

    handleDragLeave = event => {
        event.preventDefault();
        this.dragActive = false;
        this.template.querySelector('.file-upload-container')?.classList.remove('drag-active');
    };

    handleDrop = event => {
        event.preventDefault();
        this.dragActive = false;
        this.template.querySelector('.file-upload-container')?.classList.remove('drag-active');
        const files = Array.from(event.dataTransfer.files || []);
        files.forEach(file => {
            if (this.isSupportedFile(file)) {
                if (!this.selectedFiles.find(f => f.name === file.name && f.size === file.size)) {
                    this.selectedFiles = [...this.selectedFiles, file];
                    if (file.type.startsWith('image/')) {
                        this.generateImagePreview(file);
                    }
                }
            }
        });
    };

    generateImagePreview(file: File) {
        if (!file || !file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = e => {
            this.imagePreviews = { ...this.imagePreviews, [file.name]: e.target.result as string };
            this.requestUpdate?.();
        };
        reader.readAsDataURL(file);
    }

    removeSelectedFile = event => {
        const name = event.currentTarget?.dataset?.filename;
        if (!name) return;
        this.selectedFiles = this.selectedFiles.filter(f => f.name !== name);
        const previews = { ...this.imagePreviews };
        delete previews[name];
        this.imagePreviews = previews;
    };

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
        const textarea = this.template.querySelector(
            '.chat-textarea'
        ) as HTMLTextAreaElement | null;
        if (textarea) {
            textarea.focus();
        }
    }

    resizeTextarea = (textarea?: HTMLTextAreaElement | null) => {
        const target =
            textarea ||
            (this.template.querySelector('.chat-textarea') as HTMLTextAreaElement | null);
        if (!target) {
            return;
        }

        target.style.height = 'auto';
        const computedStyles = getComputedStyle(target);
        const maxHeight = Number.parseFloat(computedStyles.maxHeight) || 160;
        const nextHeight = Math.min(target.scrollHeight, maxHeight);

        target.style.height = `${nextHeight}px`;
        target.style.overflowY = target.scrollHeight > maxHeight ? 'auto' : 'hidden';
    };

    renderedCallback() {
        const modelOptions = this.resolvedAvailableModels;
        const normalized = this.normalizeModelValue(this.selectedModel);
        this.selectedModel = modelOptions.some(model => model.value === normalized)
            ? normalized
            : modelOptions[0]?.value;
        if (!this.hasRendered) {
            this.hasRendered = true;
            setTimeout(() => {
                this.focusInput();
                this.resizeTextarea();
            }, 300);
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
        const textarea = this.template.querySelector(
            '.chat-textarea'
        ) as HTMLTextAreaElement | null;
        if (textarea) {
            textarea.value = '';
            this.resizeTextarea(textarea);
        }
        this.focusInput();
    };

    /** Events **/

    handleInputChange = e => {
        this.resizeTextarea(e.target);
        runActionAfterTimeOut(
            e.target.value,
            async newValue => {
                this._prompt = newValue;
            },
            { timeout: 100, key: 'einstein.agent.publisher.inputChange' }
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
        this._prompt = speech;
        const textarea = this.template.querySelector(
            '.chat-textarea'
        ) as HTMLTextAreaElement | null;
        if (textarea) {
            textarea.value = speech;
            this.resizeTextarea(textarea);
        }
    };

    handleSendClick = async () => {
        const textarea = this.template.querySelector(
            '.chat-textarea'
        ) as HTMLTextAreaElement | null;
        const value = textarea?.value || '';
        if (!isEmpty(value) || this.selectedFiles.length > 0) {
            this.dispatchEvent(
                new CustomEvent('send', {
                    detail: {
                        prompt: value.trim(),
                        files: this.selectedFiles,
                        model: this.selectedModel,
                        reasoning: this.selectedReasoning,
                    },
                })
            );
            this.resetPrompt();
        }
    };

    /** Getters **/

    get hasFiles() {
        return this.selectedFiles.length > 0;
    }
    get filePills() {
        return this.selectedFiles.map(file => ({
            file,
            isImage: file.type && file.type.startsWith('image/'),
            preview: this.imagePreviews[file.name] || '',
        }));
    }

    get selectedFileName() {
        return this.selectedFiles.length === 1 ? this.selectedFiles[0].name : '';
    }
    get hasImagePreview() {
        return this.selectedFiles.some(f => f.type && f.type.startsWith('image/'));
    }

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

    get renderedModelOptions() {
        const selectedModel = this.normalizeModelValue(this.selectedModel);
        return this.resolvedAvailableModels.map(model => {
            const colonIdx = model.label.indexOf(': ');
            const displayLabel =
                colonIdx !== -1 ? model.label.slice(colonIdx + 2) : model.label;
            const provider =
                (model as { provider?: string }).provider ||
                (colonIdx !== -1 ? model.label.slice(0, colonIdx).toLowerCase() : null);
            return {
                ...model,
                displayLabel,
                provider,
                isSelected: model.value === selectedModel,
            };
        });
    }

    get renderedModelOptionGroups() {
        const options = this.renderedModelOptions;
        const map = new Map<string, { key: string; label: string; options: typeof options }>();
        options.forEach(model => {
            const key = model.provider || 'default';
            if (!map.has(key)) {
                const label = key !== 'default' ? key.charAt(0).toUpperCase() + key.slice(1) : '';
                map.set(key, { key, label, options: [] });
            }
            map.get(key)!.options.push(model);
        });
        return Array.from(map.values());
    }

    get hasMultipleProviderGroups() {
        return this.renderedModelOptionGroups.length > 1;
    }
}
