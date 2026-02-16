import { api } from 'lwc';
import ToolkitElement from 'core/toolkitElement';
import { setupMonaco } from 'editor/utils';

const CHANGE_EVENT_TIMEOUT = 300;
const LANGUAGE = 'plaintext';

export default class Diff extends ToolkitElement {
    @api theme = 'vs';

    _leftValue = '';
    _rightValue = '';
    _ignoreWhitespace = false;
    _ignoreCase = false;

    monaco;
    diffEditor;
    originalModel;
    modifiedModel;
    isLoading = true;
    hasLoaded = false;
    _hasRendered = false;
    _changeTimeout;
    _skipNextChange = false;

    @api
    get leftValue() {
        return this._leftValue;
    }
    set leftValue(value) {
        this._leftValue = value == null ? '' : String(value);
        this._applyValuesFromProps();
    }

    @api
    get rightValue() {
        return this._rightValue;
    }
    set rightValue(value) {
        this._rightValue = value == null ? '' : String(value);
        this._applyValuesFromProps();
    }

    @api
    get ignoreWhitespace() {
        return this._ignoreWhitespace;
    }
    set ignoreWhitespace(value) {
        this._ignoreWhitespace = !!value;
        this._applyOptionsFromProps();
    }

    @api
    get ignoreCase() {
        return this._ignoreCase;
    }
    set ignoreCase(value) {
        this._ignoreCase = !!value;
        this._applyOptionsFromProps();
    }

    connectedCallback() {}

    disconnectedCallback() {
        if (this._changeTimeout) {
            clearTimeout(this._changeTimeout);
        }
        if (this.diffEditor) {
            this.diffEditor.dispose();
            this.diffEditor = null;
        }
        if (this.originalModel && !this.originalModel.isDisposed()) {
            this.originalModel.dispose();
        }
        if (this.modifiedModel && !this.modifiedModel.isDisposed()) {
            this.modifiedModel.dispose();
        }
    }

    renderedCallback() {
        if (!this._hasRendered) {
            this._hasRendered = true;
            setupMonaco().then(monaco => {
                this.monaco = monaco;
                this.createDiffEditor();
            });
        }
    }

    createDiffEditor() {
        if (!this.monaco || !this.refs.editor) return;

        const container = this.refs.editor;
        container.style.width = '100%';
        container.style.height = '100%';

        this.originalModel = this.monaco.editor.createModel(this._leftValue, LANGUAGE);
        this.modifiedModel = this.monaco.editor.createModel(this._rightValue, LANGUAGE);

        this.diffEditor = this.monaco.editor.createDiffEditor(container, {
            theme: this.theme,
            readOnly: false,
            originalEditable: true,
            wordWrap: 'on',
            minimap: { enabled: false },
            automaticLayout: true,
            scrollBeyondLastLine: false,
            renderSideBySide: true,
            ignoreTrimWhitespace: this._ignoreWhitespace,
        });

        this.diffEditor.setModel({
            original: this.originalModel,
            modified: this.modifiedModel,
        });

        this._applyOptionsFromProps();

        const onDidChangeContent = () => {
            if (this._skipNextChange) return;
            if (this._changeTimeout) clearTimeout(this._changeTimeout);
            this._changeTimeout = setTimeout(() => {
                this._changeTimeout = null;
                this.dispatchChange();
            }, CHANGE_EVENT_TIMEOUT);
        };

        this.originalModel.onDidChangeContent(onDidChangeContent);
        this.modifiedModel.onDidChangeContent(onDidChangeContent);

        this.isLoading = false;
        this.hasLoaded = true;
        this.dispatchEvent(new CustomEvent('monacoloaded', { bubbles: true }));
    }

    dispatchChange() {
        this.dispatchEvent(
            new CustomEvent('change', {
                bubbles: true,
                detail: this.getValues(),
            })
        );
    }

    _applyValuesFromProps() {
        if (!this.originalModel || !this.modifiedModel) return;
        this._skipNextChange = true;
        this.originalModel.setValue(this._leftValue);
        this.modifiedModel.setValue(this._rightValue);
        setTimeout(() => {
            this._skipNextChange = false;
        }, 0);
    }

    /** @api */
    setValues({ left = '', right = '' } = {}) {
        this._leftValue = left == null ? '' : String(left);
        this._rightValue = right == null ? '' : String(right);
        this._applyValuesFromProps();
    }

    /** @api */
    getValues() {
        if (!this.originalModel || !this.modifiedModel) {
            return { left: '', right: '' };
        }
        return {
            left: this.originalModel.getValue(),
            right: this.modifiedModel.getValue(),
        };
    }

    _applyOptionsFromProps() {
        if (!this.diffEditor) return;
        try {
            this.diffEditor.updateOptions({
                ignoreTrimWhitespace: this._ignoreWhitespace,
            });
        } catch (e) {
            // ignore
        }
        try {
            this.diffEditor.updateOptions({ ignoreCase: this._ignoreCase });
        } catch (e) {
            // ignoreCase is not in Monaco's IDiffEditorBaseOptions; keep for future support
        }
    }

    /** @api */
    setIgnoreWhitespace(ignore) {
        this._ignoreWhitespace = !!ignore;
        this._applyOptionsFromProps();
    }

    /** @api */
    setIgnoreCase(ignore) {
        this._ignoreCase = !!ignore;
        this._applyOptionsFromProps();
    }
}
