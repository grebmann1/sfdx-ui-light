import { LightningElement, api, track } from 'lwc';
import { ensureMermaidLoaded } from 'shared/loader';
import { isEmpty, runActionAfterTimeOut, guid } from 'shared/utils';

let prismWrapHookInstalled = false;

export default class CodeBlock extends LightningElement {
    prismInitialized = false;
    prism;
    isLight = false;
    _needsHighlight = false;
    _lastHighlightedLanguage = null;
    _lastHighlightedCode = null;

    @api
    set language(value) {
        this._language = value.toLowerCase();
        this._needsHighlight = true;
        if (this.prismInitialized === true) {
            this.highlightCodeSegment();
        }
    }
    get language() {
        return this._language;
    }

    @track _codeBlock;
    @api
    set codeBlock(value) {
        this._codeBlock = value;
        this._needsHighlight = true;
        if (this.prismInitialized === true) {
            this.highlightCodeSegment();
        }
    }
    get codeBlock() {
        return this._codeBlock;
    }

    renderedCallback() {
        this.loadPrism();
    }

    connectedCallback() {
        this.template.addEventListener('click', this.handleCodeBlockClicks);
    }

    disconnectedCallback() {
        this.template.removeEventListener('click', this.handleCodeBlockClicks);
    }

    /** Methods  **/

    loadPrism() {
        if (this.prismInitialized === true && this._needsHighlight !== true) {
            return;
        }
        this.prismInitialized = true;
        if (this.prism === undefined) {
            this.prism = window.Prism;
        }
        if (!this.prism) {
            return;
        }
        if (!prismWrapHookInstalled) {
            prismWrapHookInstalled = true;
            this.prism.hooks.add('wrap', function (env) {
                if (env.type !== 'string') return;
                const text = env.content.replaceAll('"', '').replaceAll("'", '');
                if (text.startsWith('/') || text.startsWith('http')) {
                    env.attributes['data-url'] = text;
                    env.tag = 'a';
                    if (env.classes.length > 0) {
                        env.classes.push('slds-link');
                    }
                }
            });
        }
        this.highlightCodeSegment();
    }

    _getDecodedCodeBlock() {
        return String(this._codeBlock || '')
            .replaceAll('&lt;', '<')
            .replaceAll('&gt;', '>')
            .replaceAll('&amp;', '&')
            .replaceAll('&quot;', '"')
            .replaceAll('&#039;', "'");
    }

    highlightCodeSegment() {
        if (!this.prism || this._needsHighlight !== true) {
            return;
        }
        const code = this._getDecodedCodeBlock();
        if (this._lastHighlightedLanguage === this.language && this._lastHighlightedCode === code) {
            this._needsHighlight = false;
            return;
        }
        this._lastHighlightedLanguage = this.language;
        this._lastHighlightedCode = code;
        this._needsHighlight = false;

        if (this.language === 'mermaid') {
            this.highlightCode_mermaid();
        } else {
            this.highlightCode_default(code);
        }
    }

    highlightCode_mermaid = () => {
        let codeBlockEl = this.template.querySelector('pre');
        this.renderMermaid(codeBlockEl);
    };

    highlightCode_default = (decodedCode) => {
        let codeBlockEl = this.template.querySelector('pre');
        if (!codeBlockEl) return;
        codeBlockEl.textContent = '';
        codeBlockEl.classList.add('line-numbers');
        const codeEl = document.createElement('code');
        codeEl.classList.add(`language-${this._language}`);
        codeEl.textContent = decodedCode || '';
        codeBlockEl.appendChild(codeEl);
        this.prism.highlightAllUnder(codeBlockEl, false, () => {
            //console.log('callback');
        });
    };

    /*dynamiseLinks = () => {
		//console.log('this.refs.codeblockcontainer',this.refs);
		const elements = [...this.refs.codeblockcontainer.querySelectorAll('.token.string')];
		//console.log('elements',elements);
		elements.forEach(x => {
			const text = x.innerText.replaceAll('"','').replaceAll('\'','');
			if(text.startsWith('/') || text.startsWith('http')){
				//console.log('relative link');
				//x.innerHTML
			}
		})
	}*/

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
            el.innerHTML = this._codeBlock;
            const diagramText = this.fixDiagram(el.innerText);
            const mermaid = await ensureMermaidLoaded();
            if (!mermaid) return;
            if (await mermaid.parse(diagramText)) {
                const { svg } = await mermaid.render(`id-${guid()}`, diagramText); // 'graphDiv'
                el.innerHTML = svg;
            } else {
                console.warn('Invalid format');
            }
        } catch (e) {
            console.warn('Unknown diagram & error', e);
        }
    };

    download_mermaid = () => {
        const svgElement = this.refs.codeblockcontainer.querySelector('svg');
        // Set minimum dimensions for the SVG
        const minWidth = 1200; // Increase for higher resolution
        const minHeight = 800; // Increase for higher resolution

        // Get the original size of the SVG
        const originalWidth = svgElement.viewBox.baseVal.width;
        const originalHeight = svgElement.viewBox.baseVal.height;

        // Calculate the scale factor to maintain aspect ratio
        const scaleX = minWidth / originalWidth;
        const scaleY = minHeight / originalHeight;
        const scale = Math.max(scaleX, scaleY);

        // Adjust canvas size for higher resolution
        const canvasWidth = originalWidth * scale;
        const canvasHeight = originalHeight * scale;

        const svgData = new XMLSerializer().serializeToString(svgElement);
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        const img = new Image();

        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);

        img.onload = () => {
            // Set canvas size to double for higher resolution
            canvas.width = canvasWidth * 2;
            canvas.height = canvasHeight * 2;

            // Scale context to ensure high resolution
            context.scale(2, 2);

            // Fill the canvas with a white background
            context.fillStyle = '#FFFFFF';
            context.fillRect(0, 0, canvas.width / 2, canvas.height / 2);

            // Scale and draw the SVG image onto the canvas
            context.drawImage(img, 0, 0, canvasWidth, canvasHeight);

            // Create a link to download the image
            const a = document.createElement('a');
            a.href = canvas.toDataURL('image/png');
            a.download = 'mermaid-diagram.png';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        };
        img.src = url;
    };

    /** Events **/

    handleCodeBlockClicks = e => {
        if (e.target.matches('a')) {
            if (!isEmpty(e.target.dataset?.url)) {
                this.dispatchEvent(
                    new CustomEvent('customlink', {
                        detail: {
                            url: e.target.dataset.url,
                        },
                        bubbles: true,
                        composed: true,
                    })
                );
            }
        }
    };

    handleCopy = () => {
        navigator.clipboard.writeText(this._getDecodedCodeBlock());
    };

    /** Getters **/

    get isMermaidDownloadDisplayed() {
        return this.language === 'mermaid';
    }

    get classTheme() {
        if (this.language === 'mermaid') {
            return 'dx-theme-light dx-variant-card';
        } else {
            return 'dx-theme-dark dx-variant-card';
        }
    }

    get variant() {
        if (this.language === 'mermaid') {
            return 'bare';
        } else {
            return 'bare-inverse';
        }
    }
}
