import { createElement } from 'lwc';
import PromptWidget from 'editor/promptWidget';
import { CompletionFormatter } from 'editor/utils';
import LOGGER from 'shared/logger';

class MonacoLwcWidget {
    constructor(monaco, editor,language,extraInstructions) {
        this.editor = editor;
        this.monaco = monaco;
        this.domNode = null;
        this.id = 'monacoLwcWidget';
        this.line = 1;
        this.col = 1;
        this.deltaDecoration = [];
        this.isVisible = false;
        this.savedSelection = null;
        this.lwcElement = null;
        this.language = language || null;
        this.extraInstructions = extraInstructions || null;
        this.disposable = editor.onDidChangeCursorSelection((e) => {
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
        this.lwcElement.addEventListener('generate', (event) => {
            LOGGER.debug('copilot generated output',event.detail.output);
            this.applyTextToEditor(event.detail.output);
            this.hide();
        });

        this.lwcElement.addEventListener('close', (event) => {
            this.hide();
        });

        // Create a wrapper for the LWC component
        this.domNode = document.createElement('div');
        this.domNode.className = 'lwc-widget-wrapper';
        this.domNode.appendChild(this.lwcElement);

        // Style the wrapper
        this.domNode.style.position = 'absolute';
        this.domNode.style.zIndex = '1000';
        this.domNode.style.right = '20px'; // Position from right edge
        this.domNode.style.width = '400px'; // Set fixed width

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

    formatOutput = (output) => {
        const selection = this.editor.getSelection();
        const startColumn = selection.isEmpty() ? 1 : selection.startColumn;
        return new CompletionFormatter(
            output,
            startColumn
          )
            .removeMarkdownCodeSyntax()
            .removeExcessiveNewlines()
            .removeInvalidLineBreaks()
            .indentByColumn()
            .build();
    }
    
    applyTextToEditor = (output) => {
        const model = this.editor.getModel();
        const selection = this.editor.getSelection();
        const range = selection.isEmpty() ? 
            model.getFullModelRange() : 
            selection;
        const formattedOutput = this.formatOutput(output);
        model.pushEditOperations([], [{
            range,
            text: formattedOutput  
        }], () => null);
    }

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
                column: this.col < 5 ? 5 : this.col
            },
            secondaryPosition: {
                lineNumber: this.line,
                column: 5
            },
            preference: [
                this.monaco.editor.ContentWidgetPositionPreference.ABOVE,
                this.monaco.editor.ContentWidgetPositionPreference.BELOW
            ]
        };
    }

    hide() {
        // Clear decorations when hiding
        if (this.deltaDecoration.length > 0) {
            this.editor.deltaDecorations(this.deltaDecoration, []);
            this.deltaDecoration = [];
        }
        this.editor.removeContentWidget(this);
        this.isVisible = false;
        this.savedSelection = null;
    }

    show() {
        // Save the current selection before showing widget
        this.savedSelection = this.editor.getSelection();
        this.editor.addContentWidget(this);
        this.isVisible = true;
        // Set the context for the widget
        
        
        // Create a decoration for the selected text
        if (this.savedSelection && !this.savedSelection.isEmpty()) {
            this.deltaDecoration = this.editor.deltaDecorations([], [{
                range: this.savedSelection,
                options: {
                    className: 'selectedText',
                    stickiness: this.monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
                }
            }]);
        }
        // Force the editor to maintain selection
        this.editor.setSelection(this.savedSelection);
        this.editor.layoutContentWidget(this);

        // Get the full editor content as context
        this.lwcElement.context = this.editor.getModel().getValue();
        
        // Get the selected text if there is a selection
        const selectedText = this.savedSelection && !this.savedSelection.isEmpty() 
            ? this.editor.getModel().getValueInRange(this.savedSelection)
            : '';
        this.lwcElement.selectedText = selectedText;
    }
}

export default MonacoLwcWidget;
