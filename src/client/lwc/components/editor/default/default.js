import { api, wire } from 'lwc';
import ToolkitElement from 'core/toolkitElement';
import Toast from 'lightning/toast';
import {
    classSet,
    isNotUndefinedOrNull,
    runActionAfterTimeOut,
    guid,
    isChromeExtension,
    autoDetectAndFormat,
} from 'shared/utils';
import { store, connectStore } from 'core/store';
import { SOQL, APEX, VF, LOG } from 'editor/languages';
import { registerAIWidgets, setupMonaco } from 'editor/utils';
import { MonacoLwcWidget } from 'editor/editorCompleteWidget';

const CHANGE_EVENT_TIMEOUT = 500;

export default class Default extends ToolkitElement {
    @api maxHeight;
    @api isReadOnly = false;
    @api files = [];
    @api currentFile;
    @api metadataType;
    @api isActionHidden = false;
    @api isAddTabEnabled = false;

    @api isTabEnabled = false; // by default, we display tabs
    @api theme;

    // Hidden feature

    @api isToolkitHidden = false;
    @api isEinsteinHidden = false;
    @api isCopyHidden = false;
    @api isFormatHidden = false;
    currentPromptWidget;

    models = [];
    editor;

    isEditMode = false;
    isLoading = false;
    hasLoaded = false;

    counter = 0;

    _useToolingApi = false;

    /*@wire(connectStore, { store })
    storeChange({ ui,sobject }) {}
    */

    connectedCallback() {}

    disconnectedCallback() {
        // Dispose Monaco listeners to prevent memory leaks
        if(this.editor) {
            //this.editor.setModel(null);
            //this.editor.dispose();
            //this.monaco.editor.getModels().forEach(model => model.dispose());
        }
    }

    renderedCallback() {
        if (!this._hasRendered) {
            this._hasRendered = true;
            setupMonaco().then(monaco => {
                this.monaco = monaco;
                this.loadMonacoEditor();
            });
        }
    }

    /** Events */

    handleCopyClick = () => {
        navigator.clipboard.writeText(this.currentModel.getValue());
        Toast.show({
            label: `Exported to your clipboard`,
            variant: 'success',
        });
    };

    handleFormatClick = () => {
        if (!this.currentModel) return;
        const format = autoDetectAndFormat(this.currentModel.getValue());
        if (format === 'json') {
            try {
                this.currentModel.setValue(
                    JSON.stringify(JSON.parse(this.currentModel.getValue()), null, 2)
                );
            } catch (e) {
                Toast.show({ label: 'Invalid JSON', variant: 'error' });
            }
        } else {
            Toast.show({ label: 'Format not supported', variant: 'warning' });
        }
        if (this.monaco && this.editor) {
            this.monaco.editor.setModelLanguage(this.currentModel, format);
        }
    };

    handleOpenContextCopilot = () => {
        // Add the widget to Monaco editor
        if (!this.currentPromptWidget.isVisible) {
            this.currentPromptWidget.show();
        }
    };

    /** Methods **/

    createEditor = model => {
        if (!this.monaco || !this.refs.editor) return;
        this.currentFile = model;
        this.editor = this.monaco.editor.create(this.refs.editor, {
            model: model,
            theme: this.theme || 'vs',
            readOnly: this.isReadOnly,
            wordWrap: 'on',
            stickyScroll: { enabled: false },
            autoIndent: true,
            formatOnType: true,
            formatOnPaste: true,
            minimap: {
                enabled: false,
            },
            automaticLayout: true,
            scrollBeyondLastLine: false,
            fixedOverflowWidgets: true,
        });

        if (!this.isReadOnly) {

            // Widget for Inline Prompt
            this.currentPromptWidget = new MonacoLwcWidget({
                monaco: this.monaco,
                editor: this.editor,
                language: model.getLanguageId(),
                onClose: () => {
                    this.sendChangeEvent();
                },
            });

            // Register AI Widgets
            registerAIWidgets({
                monaco: this.monaco,
                editor: this.editor,
                language: model.getLanguageId(),
                handleOpenContextCopilot: this.handleOpenContextCopilot
            });

            this.editor.onDidChangeModelContent(this.handleModelContentChange);
        }
    };

    loadMonacoEditor = async () => {
        if (!this.monaco) return;
        APEX.configureApexLanguage(this.monaco);
        SOQL.configureSoqlLanguage(this.monaco);
        VF.configureVisualforceLanguage(this.monaco);
        LOG.configureApexLogLanguage(this.monaco);
        APEX.configureApexCompletions(this.monaco);
        this.dispatchEvent(new CustomEvent('monacoloaded', { bubbles: true }));
        this.hasLoaded = true;
    };

    handleModelContentChange = event => {
        this.currentPromptWidget?.processModelChange(event);
        runActionAfterTimeOut(
            this.editor?.getValue(),
            value => {
                this.dispatchEvent(
                    new CustomEvent('change', {
                        detail: {
                            value: this.editor?.getValue(),
                            type: autoDetectAndFormat(this.editor?.getValue()),
                        },
                        bubbles: true,
                    })
                );
            },
            { timeout: CHANGE_EVENT_TIMEOUT }
        );
    };

    @api
    addMarkers = markers => {
        if (this.monaco && this.currentModel) {
            this.monaco.editor.setModelMarkers(this.currentModel, 'owner', markers);
        }
    };

    @api
    resetMarkers = () => {
        if (this.monaco && this.currentModel) {
            this.monaco.editor.setModelMarkers(this.currentModel, 'owner', []);
        }
    };

    @api
    displayModel = model => {
        if (this.editor) {
            this.editor.setModel(model); // set last model
        } else if (this.monaco) {
            this.createEditor(model);
        }
    };

    @api
    createModel = ({ body, language }) => {
        if (!this.monaco) return null;
        return this.monaco.editor.createModel(body, language);
    };

    @api
    resetPromptWidget = () => {
        console.log('resetPromptWidget');
        this.currentPromptWidget?.hide();
    };

    sendChangeEvent = () => {
        runActionAfterTimeOut(
            this.editor.getValue(),
            value => {
                this.dispatchEvent(
                    new CustomEvent('change', {
                        detail: {
                            value: value,
                            type: autoDetectAndFormat(value),
                        },
                        bubbles: true,
                    })
                );
            },
            { timeout: 200 }
        );
    };

    /** Getters */

    @api
    get currentModel() {
        return this.editor?.getModel() || null;
    }

    @api
    get currentEditor() {
        return this.editor;
    }

    @api
    get currentMonaco() {
        return this.monaco;
    }

    get isToolkitDisplayed() {
        return !this.isToolkitHidden;
    }

    get isCopyDisplayed() {
        return !this.isCopyHidden;
    }

    get isFormatDisplayed() {
        return !this.isFormatHidden;
    }

    get isEinsteinDisplayed() {
        return !this.isEinsteinHidden;
    }
}
