import * as Diff from 'diff';
import EditorCompleteWidget from 'editor/editorCompleteWidget';
import { createElement } from 'lwc';
import LOGGER from 'shared/logger';
import { isNotUndefinedOrNull } from 'shared/utils';

import { CompletionFormatter } from '../utils/utils.js';

/**
 * Creates a file selection object from the editor's current state
 * @param {Object} editor - Monaco editor instance
 * @returns {Object} File selection object containing file metadata
 */
const createFileSelection = editor => {
    LOGGER.debug('createFileSelection');
    return {
        type: 'File',
        fileURI: editor.getModel().uri,
        language: editor.getModel().getLanguageId(),
        content: editor.getModel().getValue(),
        range: editor.getModel().getFullModelRange(),
    };
};

/**
 * Creates a code selection object from the editor's current selection
 * @param {Object} editor - Monaco editor instance
 * @param {Object} range - Selection range
 * @returns {Object} Code selection object containing selected code metadata
 */
const createCodeSelection = (editor, range) => {
    LOGGER.debug('createCodeSelection');
    return {
        type: 'Code',
        fileURI: editor.getModel().uri,
        language: editor.getModel().getLanguageId(),
        content: editor.getModel().getValueInRange(range),
        range: range,
    };
};

/**
 * MonacoLwcWidget class that manages the integration between Monaco editor and LWC components
 * Handles text editing, decorations, and view zones for code completion
 */
class MonacoLwcWidget {
    // Widget identification and state
    id = 'monacoLwcWidget';
    isVisible = false;
    language = null;
    extraInstructions = null;
    onClose = null;

    // Editor and model references
    editor = null;
    monaco = null;
    disposable = null;
    versionId = null;
    originalText = null;
    lastDiffValue = null;
    previousValue = null;

    // Selection and content tracking
    currentSelection = null;
    currentSelectionValue = null;
    currentFile = null;
    line = 1;
    col = 1;

    // DOM and view management
    domNode = null;
    lwcElement = null;
    currentViewZoneId = null;
    resizeObserver = null;
    decorationIds = [];
    viewZoneIds = [];
    deltaDecoration = [];

    // Model references
    originalModel = null;
    temporaryModel = null;

    /**
     * Creates a new MonacoLwcWidget instance
     * @param {Object} options - Configuration options
     * @param {Object} options.monaco - Monaco editor instance
     * @param {Object} options.editor - Editor instance
     * @param {string} options.language - Programming language
     * @param {string} options.extraInstructions - Additional instructions
     * @param {Function} options.onClose - Callback when widget closes
     */
    constructor({ monaco, editor, language, extraInstructions, onClose }) {
        this.editor = editor;
        this.monaco = monaco;
        this.language = language || null;
        this.extraInstructions = extraInstructions || null;
        this.onClose = onClose || (() => {});

        // Track cursor position changes when widget is not visible
        this.disposable = editor.onDidChangeCursorSelection(e => {
            if (!this.isVisible) {
                this.col = e.selection.endColumn;
                this.line = e.selection.endLineNumber;
            }
        });

        this.init();
    }

    /**
     * Initializes the widget by creating the LWC component and setting up event listeners
     */
    init() {
        // Create and configure the LWC component
        this.lwcElement = createElement('slds-editor-complete-widget', {
            is: EditorCompleteWidget,
        });
        this.lwcElement.extraInstructions = this.extraInstructions;

        // Set up event listeners
        this.setupEventListeners();

        // Create DOM wrapper
        this.domNode = document.createElement('div');
        this.domNode.className = 'lwc-widget-wrapper';
        this.domNode.style.marginLeft = '30px';
        this.domNode.appendChild(this.lwcElement);
    }

    /**
     * Sets up event listeners for the LWC component
     */
    setupEventListeners() {
        this.lwcElement.addEventListener('text', event => {
            this.applyTextToEditor({ text: event.detail.fullText, isEnd: false });
        });

        this.lwcElement.addEventListener('refresh', event => {
            this.applyTextToEditor({ text: this.originalText, isEnd: true });
        });

        this.lwcElement.addEventListener('textend', event => {
            this.applyTextToEditor({ text: event.detail.fullText, isEnd: true });
        });

        this.lwcElement.addEventListener('close', event => {
            /* if (!this.editor.getRawOptions().readOnly && isNotUndefinedOrNull(this.originalText)) {
                    this.editor.getModel().setValue(this.originalText);
                } */

            // Restore the original model
            this.editor.setModel(this.originalModel);
            this.hide();
            this.onClose();
        });

        this.lwcElement.addEventListener('approve', event => {
            this.editor.setModel(this.originalModel);
            const edit = {
                range: this.originalModel.getFullModelRange(),
                text: this.temporaryModel.getValue(),
            };
            this.originalModel.pushEditOperations([], [edit], () => null);

            this.hide();
            this.onClose();
        });
    }

    /**
     * Cleans up resources when the widget is destroyed
     */
    destroy() {
        if (this.disposable) {
            this.disposable.dispose();
            this.isVisible = false;
        }
    }

    /**
     * Formats the output text for the editor
     * @param {string} output - Text to format
     * @returns {string} Formatted text
     */
    formatOutput = output => {
        const selection = this.editor.getSelection();
        const startColumn = selection.isEmpty() ? 1 : selection.startColumn;
        return new CompletionFormatter(output, startColumn).removeMarkdownCodeSyntax().build();
    };

    /**
     * Applies text changes to the editor
     * @param {Object} options - Text application options
     * @param {string} options.text - Text to apply
     * @param {boolean} options.isEnd - Whether this is the final text update
     */
    applyTextToEditor = async ({ text, isEnd }) => {
        const model = this.editor.getModel();
        const range = this.currentSelection?.range?.isEmpty()
            ? model.getFullModelRange()
            : this.currentSelection.range;

        const formattedText = this.formatOutput(text);
        const tempModel = this.monaco.editor.createModel(this.originalText, this.language);
        tempModel.applyEdits([{ range, text: formattedText }], false);

        this.applyDiff({
            newValue: tempModel.getValue(),
            newRange: range,
            currentLineNumber: formattedText.split('\n').length,
            isEnd,
        });

        tempModel.dispose();
    };

    /**
     * Hides the widget and cleans up decorations
     */
    hide() {
        this.clearAllDecorations();
        this.isVisible = false;
        this.currentSelection = null;
        this.removeWidgetFromViewZone();
    }

    /**
     * Shows the widget and initializes its state
     */
    show() {
        // Store original state
        this.versionId = this.editor.getModel().getVersionId();
        this.originalText = this.editor.getModel().getValue();
        this.originalModel = this.editor.getModel();
        // Set the current selection
        this.currentSelection = createCodeSelection(this.editor, this.editor.getSelection());
        this.currentFile = createFileSelection(this.editor);

        // Set the temporary model as the editor's model
        this.temporaryModel = this.monaco.editor.createModel(this.originalText, this.language);
        this.editor.setModel(this.temporaryModel);

        // Add the widget to the view zone
        this.addWidgetToViewZone(this.line - 1, this.col);

        this.isVisible = true;

        // Set up text selection decoration
        if (this.currentSelection && !this.currentSelection.range.isEmpty()) {
            this.deltaDecoration = this.editor.deltaDecorations(
                [],
                [
                    {
                        range: this.currentSelection.range,
                        options: {
                            className: 'selectedText',
                            stickiness:
                                this.monaco.editor.TrackedRangeStickiness
                                    .NeverGrowsWhenTypingAtEdges,
                        },
                    },
                ]
            );
            this.currentSelectionValue = this.originalModel.getValueInRange(
                this.currentSelection.range
            );
        }

        this.editor.setSelection(this.currentSelection.range);
        this.lwcElement.context = this.originalText;
        this.lwcElement.file = this.currentFile;
        this.lwcElement.selection = this.currentSelection;
        this.lwcElement.setFocus();
    }

    /**
     * Adds the widget to the editor's view zone
     * @param {number} insertAfterLine - Line number to insert after
     * @param {number} insertAfterColumn - Column number to insert after
     */
    addWidgetToViewZone = (insertAfterLine, insertAfterColumn) => {
        this.editor.changeViewZones(accessor => {
            // Clean up existing view zone
            if (this.currentViewZoneId !== null) {
                accessor.removeZone(this.currentViewZoneId);
                this.currentViewZoneId = null;
                if (this.resizeObserver) {
                    this.resizeObserver.disconnect();
                }
            }

            // Add new view zone
            this.currentViewZoneId = accessor.addZone({
                afterLineNumber: insertAfterLine,
                get heightInPx() {
                    return (
                        this.domNode.querySelector('slds-editor-complete-widget').offsetHeight ||
                        150
                    );
                },
                domNode: this.domNode,
            });

            // Set up resize observer
            this.resizeObserver = new ResizeObserver(() => this.updateViewZoneHeight());
            this.resizeObserver.observe(this.domNode.querySelector('slds-editor-complete-widget'));
        });
    };

    /**
     * Updates the view zone height based on widget content
     */
    updateViewZoneHeight = () => {
        if (!this.domNode || this.currentViewZoneId === null) return;

        requestAnimationFrame(() => {
            this.editor.changeViewZones(accessor => {
                accessor.layoutZone(this.currentViewZoneId);
            });
        });
    };

    /**
     * Removes the widget from the view zone
     */
    removeWidgetFromViewZone = () => {
        this.editor.changeViewZones(accessor => {
            accessor.removeZone(this.currentViewZoneId);
            this.currentViewZoneId = null;
            if (this.resizeObserver) {
                this.resizeObserver.disconnect();
                this.resizeObserver = null;
            }
        });
    };

    /**
     * Applies text differences to the editor with appropriate decorations
     * @param {Object} options - Diff application options
     * @param {string} options.newValue - New text value
     * @param {Object} options.newRange - Range for the new text
     * @param {boolean} options.isEnd - Whether this is the final update
     * @param {number} options.currentLineNumber - Current line number
     */
    applyDiff = ({ newValue, newRange, isEnd, currentLineNumber }) => {
        const model = this.editor.getModel();
        const diff = Diff.diffLines(this.originalText, newValue, {
            ignoreCase: true,
            ignoreWhitespace: true,
        });

        const decorations = [];
        const newViewZones = [];
        let newLineNumber = 1;
        const currentLinePointer = currentLineNumber + newRange.startLineNumber;

        // Process diff chunks
        diff.forEach(part => {
            const count = part.count;

            if (part.added) {
                if (count > 0) {
                    const maxLineNumber = Math.min(
                        newRange.endLineNumber,
                        newLineNumber + count - 1
                    );
                    if (maxLineNumber >= newLineNumber && maxLineNumber <= currentLinePointer) {
                        decorations.push({
                            lineNumber: newLineNumber,
                            range: maxLineNumber - newLineNumber,
                            data: {
                                range: new monaco.Range(newLineNumber, 1, maxLineNumber, 1),
                                options: {
                                    isWholeLine: true,
                                    className: 'insertedCodeDecoration',
                                },
                            },
                        });
                    }
                }
                newLineNumber += count;
            } else if (part.removed) {
                const anchorLine = Math.max(0, newLineNumber - 1);
                if (anchorLine < newRange.endLineNumber && anchorLine <= currentLinePointer) {
                    const heightInLines = Math.min(count, newRange.endLineNumber - anchorLine);
                    if (heightInLines > 0) {
                        const domNode = document.createElement('div');
                        domNode.className = 'deletedViewZone';
                        domNode.innerHTML = `<pre style="margin:0; line-height: 18px;">${part.value}</pre>`;

                        newViewZones.push({
                            lineNumber: anchorLine + heightInLines,
                            data: {
                                afterLineNumber: anchorLine,
                                heightInLines,
                                domNode,
                            },
                        });
                    }
                }
            } else {
                newLineNumber += count;
            }
        });

        // Apply decorations
        const visibleDecorations = decorations
            .filter(d => d.lineNumber < currentLinePointer || isEnd)
            .map(d => d.data);
        this.decorationIds = this.editor.deltaDecorations(this.decorationIds, visibleDecorations);

        // Update view zones
        this.editor.changeViewZones(changeAccessor => {
            this.viewZoneIds.forEach(zoneId => changeAccessor.removeZone(zoneId));
            this.viewZoneIds = [];

            const visibleViewZones = newViewZones
                .filter(d => d.lineNumber < currentLinePointer || isEnd)
                .map(d => d.data);

            visibleViewZones.forEach(zoneSpec => {
                this.viewZoneIds.push(changeAccessor.addZone(zoneSpec));
            });
        });

        // Update editor content if changed
        if (this.lastDiffValue !== newValue) {
            this.lastDiffValue = newValue;
            model.applyEdits([
                {
                    range: model.getFullModelRange(),
                    text: newValue,
                },
            ]);
        }
    };

    /**
     * Clears all decorations from the editor
     */
    clearAllDecorations = () => {
        this.decorationIds = this.editor.deltaDecorations(this.decorationIds, []);
        this.editor.changeViewZones(changeAccessor => {
            this.viewZoneIds.forEach(zoneId => changeAccessor.removeZone(zoneId));
            this.viewZoneIds = [];
        });
    };

    /**
     * Processes model changes and updates decorations accordingly
     * @param {Object} event - Model change event
     */
    processModelChange = event => {
        if (!this.isVisible) return;

        const currentVersion = this.editor.getModel().getAlternativeVersionId();
        if (this.versionId === currentVersion) {
            this.clearAllDecorations();
        } else if (currentVersion < this.versionId) {
            this.hide();
            this.currentVersion = null;
        } else if (currentVersion > this.versionId) {
            if (this.previousValue === event.changes[0].text) {
                return;
            }
            this.applyDiff({
                newValue: this.editor.getModel().getValue(),
                newRange: this.editor.getModel().getFullModelRange(),
                isEnd: true,
            });
        }

        this.previousValue = event.changes[0].text;
    };
}

export { MonacoLwcWidget };
