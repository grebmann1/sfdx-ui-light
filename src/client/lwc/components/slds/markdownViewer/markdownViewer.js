import { api, LightningElement, createElement } from 'lwc';
import { marked } from 'shared/markdown';
import { isEmpty, classSet, normalizeString as normalize } from 'shared/utils';
import sldsCodeBlock from 'slds/codeBlock';
import MarkdownViewerEditorModal from 'slds/MarkdownViewerEditorModal';

export default class MarkdownViewer extends LightningElement {
    hasRendered = false;
    
    _value = '';
    @api 
    set value(value) {
        this._value = value;
        if(this.hasRendered){
            this.getDown(value);
        }
    }
    get value() {
        return this._value;
    }

    renderedCallback() {
        this.hasRendered = true;
        this.getDown(this.value);
    }

    /** Methods */

    @api
    showEditor = () => {
        //this.variant = VARIANTS.EDITOR;
        MarkdownViewerEditorModal.open({
            title: 'Edit Markdown',
            value: this.value,
            size: 'full',
        }).then(async data => {
            if (data) {
                const { value } = data;
                // update the value
                this.value = value;
                this.getDown(this.value);
                this.dispatchEvent(
                    new CustomEvent('change', { detail: { value }, bubbles: true, composed: true })
                );
            }
        });
    };

    getDown = content => {
        this.setMarkdown(content);
    };

    setMarkdown = markdown => {
        var html = marked()(markdown);
        this.refs.container.innerHTML = html;
        this.enable_codeViewer();
        //this.enable_mermaid();
    };

    enable_codeViewer = () => {
        //console.log('transformCodeBlockToComponents');
        const mapping = { js: 'javascript', apex: 'apex' };
        // pre .language-java,pre .language-apex,pre .language-javascript,pre .language-soql
        this.refs.container.querySelectorAll('pre [class^="language-"]').forEach(el => {
            //const newTarget = el.parentNode;

            el.setAttribute('lwc:dom', 'manual');
            const list = el.classList;
            let c = '';
            for (const d in list)
                if (typeof list[d] == 'string') {
                    const p = list[d];
                    p.startsWith('language-') && (c = p.split('-')[1]);
                }
            const newElement = createElement('slds-code-block', {
                is: sldsCodeBlock,
            });
            //console.log('createElement',mapping[c] || c);
            Object.assign(newElement, {
                codeBlock: el.innerHTML,
                language: mapping[c] || c,
                title: '',
            }),
                (el.innerHTML = ''),
                el.appendChild(newElement);
            //newTarget.replaceWith(newElement)
        });
    };

    enable_mermaid = () => {
        this.refs.container.querySelectorAll('pre .language-mermaid').forEach(async el => {
            this.renderMermaid(el);
        });
    };

    fixDiagram = input => {
        function fixClassName(line) {
            if (isEmpty(line) || line.includes('classDiagram')) return line;

            const match = line.match(/(class|Class)([a-zA-Z0-9]*)\s*\{/);
            if (match) {
                const oldClassName = match[1] + match[2];
                const newClassName = match[2];
                //const newClassName = camelCaseToLowercaseWords(className); // we dont use, it's more complicate
                return line.replace(oldClassName, `class ${newClassName}`);
            }
            return line;
        }

        function fixClassNameInLinks(line) {
            if (isEmpty(line) || line.includes('classDiagram')) return line;
            const match = line.match(/(class|Class)([a-zA-Z0-9]+)/);
            if (match) {
                return line.replace(/(class|Class)([a-zA-Z0-9]+)/g, '$2');
            } else {
                return line;
            }
        }

        // Split the input into lines for easier manipulation.
        const lines = input.split('\n');
        let fixedDiagram = [];

        lines.forEach(line => {
            //line = line.trim();

            /*if (line.startsWith('classDiagram')) {
                isValidDiagram = true;
            }*/

            // Fix class names
            line = fixClassName(line);
            //console.log('line1',line);
            line = fixClassNameInLinks(line);
            //console.log('line2',line);
            fixedDiagram.push(line);
        });

        // Join the fixed lines back into a single string.
        //console.log('test',fixedDiagram.join('\n'));
        return fixedDiagram.join('\n');
    };

    renderMermaid = async el => {
        try {
            const diagramText = this.fixDiagram(el.innerText);
            //console.log('diagramText');
            //console.log(diagramText);
            if (await mermaid.parse(diagramText)) {
                const { svg, bindFunctions } = await window.mermaid.render('graphDiv', diagramText);
                el.innerHTML = svg;
            } else {
                //console.log('Invalid format')
            }
        } catch (e) {
            //console.log('Unknown diagram & error',e);
        }
    };

    /** Getters **/

    @api
    get internalHtml() {
        return this.refs.container.innerHTML;
    }

    @api
    get internalElement() {
        return this.refs.container;
    }
}
