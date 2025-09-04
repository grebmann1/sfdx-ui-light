import LightningModal from 'lightning/modal';
import { api, track } from 'lwc';

export default class ApiSchemaImportModal extends LightningModal {
    @api title = 'Import API Schema';
    @track value = '';
    currentModel;

    connectedCallback() {}

    handleCloseClick = () => {
        this.close();
    };

    handleImportClick = () => {
        const value = this.currentModel ? this.currentModel.getValue() : '';
        this.close({ value });
    };

    handleFileChange = (event) => {
        const { value } = event.detail;
        if (this.currentModel) {
            this.currentModel.setValue(value);
        } else {
            this.value = value;
        }
    };

    handleMonacoLoaded = () => {
        this.currentModel = this.refs.editor.createModel({
            body: this.value,
            language: this.detectLanguage(this.value),
        });
        this.refs.editor.displayModel(this.currentModel);
    };

    handleEditorChange = (event) => {
        // Optionally update value for two-way binding
        this.value = event.detail.value;
    };

    detectLanguage = (text) => {
        // Simple detection for JSON or YAML
        try {
            JSON.parse(text);
            return 'json';
        } catch (e) {
            // Not JSON, assume YAML
            return 'yaml';
        }
    };
}