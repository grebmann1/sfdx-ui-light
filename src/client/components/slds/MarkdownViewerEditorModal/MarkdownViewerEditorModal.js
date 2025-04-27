import LightningModal from 'lightning/modal';
import { api } from 'lwc';
import { isUndefinedOrNull } from 'shared/utils';

export default class MarkdownViewerEditorModal extends LightningModal {
    @api title;
    @api value;

    currentModel;

    connectedCallback() {}

    handleCloseClick() {
        //this.close('canceled');
        this.close();
    }

    closeModal() {
        this.close();
    }

    /** events **/

    handleMonacoLoaded = () => {
        //this.isLoading = false;
        this.currentModel = this.refs.editor.createModel({
            body: this.value,
            language: 'markdown',
        });
        this.refs.editor.displayModel(this.currentModel);
    };

    handleSaveClick = e => {
        const value = this.refs.editor.currentModel.getValue();
        this.close({ value });
    };

    /** Getter **/
}
