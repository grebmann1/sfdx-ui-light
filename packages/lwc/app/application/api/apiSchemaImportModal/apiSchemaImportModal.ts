import LightningModal from 'lightning/modal';
import { api, track } from 'lwc';

export default class ApiSchemaImportModal extends LightningModal {
    @api title = 'Import API Schema';
    @track value = '';
    currentModel: any = null;

    connectedCallback() {}

    handleCloseClick = (): void => {
        this.close();
    };

    handleImportClick = (): void => {
        const value = this.currentModel ? this.currentModel.getValue() : '';
        this.close({ value });
    };

    handleFileChange = (event: any): void => {
        const { value } = event.detail;
        if (this.currentModel) {
            this.currentModel.setValue(value);
        } else {
            this.value = value;
        }
    };

    handleMonacoLoaded = (): void => {
        this.currentModel = this.refs.editor.createModel({
            body: this.value,
            language: this.detectLanguage(this.value),
        });
        this.refs.editor.displayModel(this.currentModel);
    };

    handleEditorChange = (event: any): void => {
        // Optionally update value for two-way binding
        this.value = event.detail.value;
    };

    detectLanguage = (text: string): 'json' | 'yaml' => {
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
