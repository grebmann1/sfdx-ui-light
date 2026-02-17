import * as DiffLib from 'diff';
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

    monaco;
    originalModel;
    modifiedModel;
    leftEditor;
    rightEditor;
    isLoading = true;
    hasLoaded = false;
    _hasRendered = false;
    _changeTimeout;
    _skipNextChange = false;
    _leftDecorationIds = [];
    _rightDecorationIds = [];
    _leftScrollDisposable;
    _rightScrollDisposable;

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

    connectedCallback() {}

    disconnectedCallback() {
        if (this._changeTimeout) {
            clearTimeout(this._changeTimeout);
        }
        this._disposeEditors();
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
                this.createEditors();
            });
        }
    }

    createEditors() {
        if (!this.monaco || !this.refs.leftEditor || !this.refs.rightEditor) return;

        const leftContainer = this.refs.leftEditor;
        const rightContainer = this.refs.rightEditor;
        leftContainer.style.width = '100%';
        leftContainer.style.height = '100%';
        rightContainer.style.width = '100%';
        rightContainer.style.height = '100%';

        this.originalModel = this.monaco.editor.createModel(this._leftValue, LANGUAGE);
        this.modifiedModel = this.monaco.editor.createModel(this._rightValue, LANGUAGE);

        this.leftEditor = this.monaco.editor.create(leftContainer, {
            model: this.originalModel,
            theme: this.theme,
            readOnly: false,
            wordWrap: 'on',
            minimap: { enabled: false },
            automaticLayout: true,
            scrollBeyondLastLine: false,
        });

        this.rightEditor = this.monaco.editor.create(rightContainer, {
            model: this.modifiedModel,
            theme: this.theme,
            readOnly: false,
            wordWrap: 'on',
            minimap: { enabled: false },
            automaticLayout: true,
            scrollBeyondLastLine: false,
        });

        this._applyOptionsFromProps();
        this._recomputeDiff();

        let isSyncingFromLeft = false;
        let isSyncingFromRight = false;
        this._leftScrollDisposable = this.leftEditor.onDidScrollChange(e => {
            if (isSyncingFromRight) return;
            isSyncingFromLeft = true;
            this.rightEditor.setScrollTop(e.scrollTop);
            this.rightEditor.setScrollLeft(e.scrollLeft);
            isSyncingFromLeft = false;
        });
        this._rightScrollDisposable = this.rightEditor.onDidScrollChange(e => {
            if (isSyncingFromLeft) return;
            isSyncingFromRight = true;
            this.leftEditor.setScrollTop(e.scrollTop);
            this.leftEditor.setScrollLeft(e.scrollLeft);
            isSyncingFromRight = false;
        });

        const onDidChangeContent = () => {
            if (this._skipNextChange) return;
            this._recomputeDiff();
            if (this._changeTimeout) clearTimeout(this._changeTimeout);
            this._changeTimeout = setTimeout(() => {
                this._changeTimeout = null;
                this.dispatchChange();
            }, CHANGE_EVENT_TIMEOUT);
        };

        this.leftEditor.onDidChangeModelContent(onDidChangeContent);
        this.rightEditor.onDidChangeModelContent(onDidChangeContent);

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
        this._recomputeDiff();
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
        if (!this.leftEditor || !this.rightEditor) return;
        try {
            this.monaco?.editor?.setTheme?.(this.theme);
        } catch (e) {
            // ignore
        }
        this._recomputeDiff();
    }

    _disposeEditors() {
        if (this._leftScrollDisposable) {
            this._leftScrollDisposable.dispose();
            this._leftScrollDisposable = null;
        }
        if (this._rightScrollDisposable) {
            this._rightScrollDisposable.dispose();
            this._rightScrollDisposable = null;
        }
        if (this.leftEditor) {
            this.leftEditor.dispose();
            this.leftEditor = null;
        }
        if (this.rightEditor) {
            this.rightEditor.dispose();
            this.rightEditor = null;
        }
    }

    _normalizeTextForDiff(text) {
        let value = text == null ? '' : String(text);
        if (this._ignoreWhitespace) {
            value = value
                .split('\n')
                // Monaco's ignoreTrimWhitespace ignores leading/trailing whitespace
                .map(line => line.trim())
                .join('\n');
        }
        return value;
    }

    _getPartLineCount(part) {
        if (typeof part?.count === 'number') return part.count;
        const value = part?.value || '';
        if (!value) return 0;
        const lines = value.split('\n');
        return lines[lines.length - 1] === '' ? Math.max(0, lines.length - 1) : lines.length;
    }

    _recomputeDiff() {
        if (!this.monaco || !this.leftEditor || !this.rightEditor) return;
        if (!this.originalModel || !this.modifiedModel) return;

        const leftMax = this.originalModel.getLineCount();
        const rightMax = this.modifiedModel.getLineCount();

        const leftNormalized = this._normalizeTextForDiff(this.originalModel.getValue());
        const rightNormalized = this._normalizeTextForDiff(this.modifiedModel.getValue());

        const parts = DiffLib.diffLines(leftNormalized, rightNormalized);

        const leftDecorations = [];
        const rightDecorations = [];

        let leftLine = 1;
        let rightLine = 1;

        for (const part of parts) {
            const count = this._getPartLineCount(part);
            if (count <= 0) continue;

            if (part.removed) {
                const start = leftLine;
                const end = Math.min(leftMax, leftLine + count - 1);
                if (end >= start) {
                    leftDecorations.push({
                        range: new this.monaco.Range(start, 1, end, 1),
                        options: { isWholeLine: true, className: 'diff-line-removed' },
                    });
                }
                leftLine += count;
                continue;
            }

            if (part.added) {
                const start = rightLine;
                const end = Math.min(rightMax, rightLine + count - 1);
                if (end >= start) {
                    rightDecorations.push({
                        range: new this.monaco.Range(start, 1, end, 1),
                        options: { isWholeLine: true, className: 'diff-line-added' },
                    });
                }
                rightLine += count;
                continue;
            }

            leftLine += count;
            rightLine += count;
        }

        this._leftDecorationIds = this.leftEditor.deltaDecorations(
            this._leftDecorationIds,
            leftDecorations
        );
        this._rightDecorationIds = this.rightEditor.deltaDecorations(
            this._rightDecorationIds,
            rightDecorations
        );
    }

    /** @api */
    setIgnoreWhitespace(ignore) {
        this._ignoreWhitespace = !!ignore;
        this._applyOptionsFromProps();
    }
}
