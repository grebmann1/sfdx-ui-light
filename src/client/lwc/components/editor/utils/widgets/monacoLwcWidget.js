import * as Diff from 'diff';
import PromptWidget from 'editor/promptWidget';
import { CompletionFormatter } from 'editor/utils';
import { createElement } from 'lwc';
import LOGGER from 'shared/logger';
import { isUndefinedOrNull, isNotUndefinedOrNull } from 'shared/utils';

// TODO: Add undo/redo tracking for fast undo/redo of the widget. We can't reuse the undo/redo of the editor because it will keep the decorations.

class MonacoLwcWidget {
    constructor(monaco, editor, language, extraInstructions) {
        this.editor = editor;
        this.monaco = monaco;
        this.domNode = null;
        this.id = 'monacoLwcWidget';
        this.currentViewZoneId = null;
        this.resizeObserver = null;
        this.line = 1;
        this.col = 1;
        this.deltaDecoration = [];
        this.decorationIds = [];
        this.viewZoneIds = [];
        this.isVisible = false;
        this.savedSelection = null;
        this.lwcElement = null;
        this.language = language || null;
        this.extraInstructions = extraInstructions || null;
        this.originalText = null;

        // current version of the model
        this.versionId = null;
        this.valueModel;

        this.disposable = editor.onDidChangeCursorSelection(e => {
            // Only update position if widget is not visible
            if (!this.isVisible) {
                this.col = e.selection.endColumn;
                this.line = e.selection.endLineNumber;
            }
        });
        this.init();
    }

    init() {
        // Create the LWC component
        this.lwcElement = createElement('editor-prompt-widget', {
            is: PromptWidget,
        });

        // Add extra instructions
        this.lwcElement.extraInstructions = this.extraInstructions;
        // Attach an event listener for the "Generate" button
        this.lwcElement.addEventListener('generate', event => {
            this.originalText = this.editor.getModel().getValue();
            this.applyTextToEditor(event.detail.output);
            //this.hide();
        });

        this.lwcElement.addEventListener('close', event => {
            if (!this.editor.getRawOptions().readOnly && isNotUndefinedOrNull(this.originalText)) {
                // Process
                this.editor.getModel().setValue(this.originalText);
            }
            this.hide();
        });

        this.lwcElement.addEventListener('approve', event => {
            // Process
            this.hide();
        });

        // Create a wrapper for the LWC component
        this.domNode = document.createElement('div');
        this.domNode.className = 'lwc-widget-wrapper';
        this.domNode.appendChild(this.lwcElement);

        // Style the wrapper
        //this.domNode.style.position = 'absolute';
        //this.domNode.style.zIndex = '1000';
        //this.domNode.style.right = '20px'; // Position from right edge
        //this.domNode.style.width = '400px'; // Set fixed width

        // Add the widget to Monaco editor
        //this.editor.addContentWidget(this);
        //this.isVisible = true;
    }

    destroy() {
        if (this.disposable) {
            //this.editor.removeContentWidget(this);
            this.disposable.dispose();
            this.isVisible = false;
        }
    }

    formatOutput = output => {
        const selection = this.editor.getSelection();
        const startColumn = selection.isEmpty() ? 1 : selection.startColumn;
        return new CompletionFormatter(output, startColumn)
            .removeMarkdownCodeSyntax()
            .removeExcessiveNewlines()
            .removeInvalidLineBreaks()
            .indentByColumn()
            .build();
    };

    applyTextToEditor = output => {
        this.versionId = this.editor.getModel().getVersionId();
        this.valueModel = this.editor.getModel().getValue();

        const model = this.editor.getModel();
        const selection = this.editor.getSelection();
        const range = selection.isEmpty() ? model.getFullModelRange() : selection;
        const formattedOutput = this.formatOutput(output);
        LOGGER.debug('formattedOutput', formattedOutput);
        const editOperation = { range, text: formattedOutput };
        // Apply the change to the model
        const _tempModel = this.monaco.editor.createModel(model.getValue(), model.getLanguageId());
        _tempModel.applyEdits([editOperation], false);
        const newText = _tempModel.getValue();
        this._applyDiff(newText);
        /* model.pushEditOperations([], [editOperation], () => null); */
        //model.applyEdits([editOperation], false);
    };

    getId() {
        return this.id;
    }

    getDomNode() {
        return this.domNode;
    }

    getPosition() {
        return {
            position: {
                lineNumber: this.line,
                column: this.col < 5 ? 5 : this.col,
            },
            secondaryPosition: {
                lineNumber: this.line,
                column: 5,
            },
            preference: [
                this.monaco.editor.ContentWidgetPositionPreference.ABOVE,
                this.monaco.editor.ContentWidgetPositionPreference.BELOW,
            ],
        };
    }

    hide() {
        // Clear decorations when hiding
        this.clearAllDecorations();
        //this.editor.removeContentWidget(this);
        this.isVisible = false;
        this.savedSelection = null;
        this.removeWidgetFromViewZone();
    }

    show() {
        //this.removeWidgetFromViewZone();
        this.addWidgetToViewZone(this.line - 1);
        // Save the current selection before showing widget
        this.savedSelection = this.editor.getSelection();
        //this.editor.addContentWidget(this);
        this.isVisible = true;
        // Set the context for the widget

        // Create a decoration for the selected text
        if (this.savedSelection && !this.savedSelection.isEmpty()) {
            this.deltaDecoration = this.editor.deltaDecorations(
                [],
                [
                    {
                        range: this.savedSelection,
                        options: {
                            className: 'selectedText',
                            stickiness:
                                this.monaco.editor.TrackedRangeStickiness
                                    .NeverGrowsWhenTypingAtEdges,
                        },
                    },
                ]
            );
        }
        // Force the editor to maintain selection
        this.editor.setSelection(this.savedSelection);
        this.editor.layoutContentWidget(this);

        // Get the full editor content as context
        this.lwcElement.context = this.editor.getModel().getValue();

        // Get the selected text if there is a selection
        const selectedText =
            this.savedSelection && !this.savedSelection.isEmpty()
                ? this.editor.getModel().getValueInRange(this.savedSelection)
                : '';
        this.lwcElement.selectedText = selectedText;
    }

    addWidgetToViewZone = insertAfterLine => {
        this.editor.changeViewZones(accessor => {
            // Remove existing view zone if already present
            if (this.currentViewZoneId !== null) {
                accessor.removeZone(this.currentViewZoneId);
                this.currentViewZoneId = null;
                if (this.resizeObserver) {
                    this.resizeObserver.disconnect();
                }
            }
            // Initial measurement before adding the view zone
            //const measuredHeight = this.domNode.querySelector('editor-prompt-widget').internalHeight || 150; // Default to 40px if not rendered yet

            // Add the view zone with an initial height
            this.currentViewZoneId = accessor.addZone({
                afterLineNumber: insertAfterLine,
                get heightInPx() {
                    return this.domNode.querySelector('editor-prompt-widget').offsetHeight || 150;
                },
                domNode: this.domNode,
            });

            // Observe changes in widget size
            this.resizeObserver = new ResizeObserver(() => this.updateViewZoneHeight());
            this.resizeObserver.observe(this.domNode.querySelector('textarea'));
        });
    };

    updateViewZoneHeight = () => {
        if (!this.domNode || this.currentViewZoneId === null) return;

        requestAnimationFrame(() => {
            this.editor.changeViewZones(accessor => {
                accessor.layoutZone(this.currentViewZoneId);
            });
        });
    };

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

    lastDiffValue = null;
    _applyDiff = newValue => {
        // Keep track of the current text and decoration/widget IDs.
        const model = this.editor.getModel();
        // Check if the new value is different from the previous value to avoid double calculation
        // Compute a line-by-line diff.
        let diff = Diff.diffLines(this.valueModel, newValue, {
            ignoreCase: true,
            ignoreWhitespace: true,
        });
        //console.log('diff', diff);

        let decorations = [];
        let newViewZones = [];
        let newLineNumber = 1;

        diff.forEach(part => {
            const count = part.count;
            if (part.added) {
                // Mark added text with a green decoration.
                if (count > 0) {
                    const range = new monaco.Range(newLineNumber, 1, newLineNumber + count - 1, 1);
                    decorations.push({
                        range: range,
                        options: {
                            isWholeLine: true,
                            className: 'insertedCodeDecoration',
                        },
                    });
                }
                newLineNumber += count; // Advance in the new text.
            } else if (part.removed) {
                //  Create a view zone that displays the deleted text.
                //    The view zone is inserted after the previous line. If newLineNumber is 1,
                //    we set afterLineNumber to 0 to have it at the top.
                let anchorLine = newLineNumber > 1 ? newLineNumber - 1 : 0;
                let domNode = document.createElement('div');
                domNode.className = 'deletedViewZone';
                domNode.innerHTML = `<pre style="margin:0">${part.value.trim()}</pre>`;
                // Determine the height (in lines) for the view zone.
                let heightInLines = count > 0 ? count : 1;
                newViewZones.push({
                    afterLineNumber: anchorLine,
                    heightInLines: heightInLines,
                    domNode: domNode,
                });
            } else {
                // Unchanged text: simply advance.
                newLineNumber += count;
            }
        });

        // Apply the new decorations (this will remove previous ones).
        this.decorationIds = this.editor.deltaDecorations(this.decorationIds, decorations);

        // Update view zones: remove old zones and add the new ones.
        this.editor.changeViewZones(changeAccessor => {
            // Remove any old view zones.
            this.viewZoneIds.forEach(zoneId => changeAccessor.removeZone(zoneId));
            this.viewZoneIds = [];
            // Add each new view zone from our diff.
            newViewZones.forEach(zoneSpec => {
                let id = changeAccessor.addZone(zoneSpec);
                this.viewZoneIds.push(id);
            });
        });

        // Update the editor’s content.
        const range = model.getFullModelRange();

        // Store the new value as the last diff value
        if (this.lastDiffValue !== newValue) {
            this.lastDiffValue = newValue;
            model.pushEditOperations([], [{ range, text: newValue }], () => null);
        }
    };

    clearAllDecorations = () => {
        this.decorationIds = this.editor.deltaDecorations(this.decorationIds, []);
        this.editor.changeViewZones(changeAccessor => {
            // Remove any old view zones.
            this.viewZoneIds.forEach(zoneId => changeAccessor.removeZone(zoneId));
            this.viewZoneIds = [];
        });
    };

    previousValue = null;
    processModelChange = event => {
        if (!this.isVisible) return;

        const currentVersion = this.editor.getModel().getAlternativeVersionId();
        if (this.versionId === currentVersion) {
            // Remove the decorations
            this.clearAllDecorations();
        } else if (currentVersion < this.versionId) {
            // Add the decorations
            this.hide();
            this.currentVersion = null;
        } else if (currentVersion > this.versionId) {
            if (this.previousValue === event.changes[0].text) {
                return;
            }
            this._applyDiff(this.editor.getModel().getValue());
        }

        // Update the previous value
        this.previousValue = event.changes[0].text;
    };
}

export default MonacoLwcWidget;
