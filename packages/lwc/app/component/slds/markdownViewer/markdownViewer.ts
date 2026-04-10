import { api, LightningElement, createElement } from 'lwc';
import { ensureMermaidLoaded } from 'shared/loader';
import { marked } from 'shared/markdown';
import { getIndexedDbFileSystem } from 'core/fs';
import {
    guid,
    isEmpty,
    normalizeString as normalize,
    runActionAfterTimeOut,
} from 'shared/utils';
import sldsCodeBlock from 'slds/codeBlock';
import MarkdownViewerEditorModal from 'slds/MarkdownViewerEditorModal';

const SFTOOLKIT_PREFIX = 'sftoolkit:';

function extractSftoolkitPath(href) {
    if (typeof href !== 'string' || !href.startsWith(SFTOOLKIT_PREFIX)) return null;
    const path = href.slice(SFTOOLKIT_PREFIX.length);
    return path.startsWith('/') ? path : '/' + path;
}

function extractVirtualWorkspacePath(urlValue) {
    if (typeof urlValue !== 'string' || urlValue.trim().length === 0) return null;
    const sftoolkitPath = extractSftoolkitPath(urlValue);
    if (sftoolkitPath) return sftoolkitPath;
    try {
        const parsed = new URL(urlValue, window.location.href);
        const pathName = parsed.pathname || '';
        if (!pathName.startsWith('/workspace/')) return null;
        return pathName;
    } catch (_) {
        return null;
    }
}

function mimeTypeFromPath(path) {
    const lower = String(path || '').toLowerCase();
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
    if (lower.endsWith('.webp')) return 'image/webp';
    if (lower.endsWith('.gif')) return 'image/gif';
    if (lower.endsWith('.svg')) return 'image/svg+xml';
    if (lower.endsWith('.pdf')) return 'application/pdf';
    if (lower.endsWith('.txt') || lower.endsWith('.md')) return 'text/plain';
    if (lower.endsWith('.json')) return 'application/json';
    return 'application/octet-stream';
}

function isImageMimeType(mimeType) {
    return typeof mimeType === 'string' && mimeType.startsWith('image/');
}

function getFilename(path) {
    return String(path || '').split('/').filter(Boolean).pop() || 'file';
}

const FILE_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>`;
const OPEN_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`;
const DOWNLOAD_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;

function buildFileAttachmentHTML(path, filename) {
    const escapedPath = path.replace(/"/g, '&quot;');
    const escapedName = filename.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<span class="sftoolkit-file-attachment" data-path="${escapedPath}">${FILE_ICON_SVG}<span class="sftoolkit-file-name" title="${escapedName}">${escapedName}</span><button class="sftoolkit-file-btn" data-action="open" data-path="${escapedPath}" title="Open">${OPEN_ICON_SVG}</button><button class="sftoolkit-file-btn" data-action="download" data-path="${escapedPath}" title="Download">${DOWNLOAD_ICON_SVG}</button></span>`;
}

export default class MarkdownViewer extends LightningElement {
    hasRendered = false;
    _renderRequested = false;
    _lastRenderedValue = null;
    _instanceKey = '';
    _linkClickBound = false;
    _objectUrls: string[] = [];
    fs = getIndexedDbFileSystem();

    _value = '';

    connectedCallback() {
        this._instanceKey = guid();
    }
    @api
    set value(value) {
        this._value = value;
        this._renderRequested = true;
        if (this.hasRendered) {
            this.scheduleRender();
        }
    }
    get value() {
        return this._value;
    }

    renderedCallback() {
        this.hasRendered = true;
        this.ensureLinkClickHandling();
        if (this._renderRequested) {
            this.scheduleRender();
        }
    }

    disconnectedCallback() {
        if (this._linkClickBound && this.refs?.container) {
            this.refs.container.removeEventListener('click', this.handleContainerClick);
        }
        this._linkClickBound = false;
        this._objectUrls.forEach(url => URL.revokeObjectURL(url));
        this._objectUrls = [];
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

    scheduleRender = () => {
        runActionAfterTimeOut(
            null,
            () => {
                this.renderIfNeeded();
            },
            { timeout: 0, key: this._instanceKey }
        );
    };

    renderIfNeeded = () => {
        this._renderRequested = false;
        const value = this.value || '';
        if (this._lastRenderedValue === value) return;
        this._lastRenderedValue = value;
        this.setMarkdown(value);
    };

    ensureLinkClickHandling = () => {
        if (this._linkClickBound) return;
        if (!this.refs?.container) return;
        this.refs.container.addEventListener('click', this.handleContainerClick);
        this._linkClickBound = true;
    };

    handleContainerClick = async event => {
        // Handle file attachment action buttons
        const btn = event?.target?.closest?.('.sftoolkit-file-btn');
        if (btn) {
            event.preventDefault();
            event.stopPropagation();
            const action = btn.getAttribute('data-action');
            const path = btn.getAttribute('data-path');
            if (path) {
                await this.openVirtualFile(path, action === 'download');
            }
            return;
        }

        // Handle sftoolkit: anchor links that weren't replaced (e.g. failed inline load)
        const anchor = event?.target?.closest?.('a[href]');
        if (!anchor) return;
        const href = anchor.getAttribute('href') || '';
        const workspacePath = extractVirtualWorkspacePath(href);
        if (!workspacePath) return;
        event.preventDefault();
        event.stopPropagation();
        await this.openVirtualFile(workspacePath, false);
    };

    openVirtualFile = async (path, download = false) => {
        try {
            await this.fs.ready;
            const bytes = await this.fs.readFileBuffer(path);
            const mime = mimeTypeFromPath(path);
            const blob = new Blob([bytes], { type: mime });
            const objectUrl = URL.createObjectURL(blob);
            if (download) {
                const a = document.createElement('a');
                a.href = objectUrl;
                a.download = getFilename(path);
                a.click();
            } else {
                window.open(objectUrl, '_blank');
            }
            setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
        } catch (_) {
            // Best-effort fallback — nothing to show without the FS
        }
    };

    setMarkdown = markdown => {
        const html = marked()(markdown);
        this.refs.container.innerHTML = html;
        this.enable_sftoolkitLinks();
        runActionAfterTimeOut(
            html,
            async () => {
                this.enable_codeViewer();
            },
            { timeout: 500, key: `${this._instanceKey}.enableCodeViewer` }
        );
    };

    enable_sftoolkitLinks = async () => {
        const anchors = Array.from(
            this.refs.container.querySelectorAll('a[href^="sftoolkit:"]')
        );
        for (const anchor of anchors) {
            const href = anchor.getAttribute('href') || '';
            const path = extractSftoolkitPath(href);
            if (!path) continue;
            const mime = mimeTypeFromPath(path);
            const filename = getFilename(path);
            if (isImageMimeType(mime)) {
                await this.replaceAnchorWithImage(anchor, path, filename, mime);
            } else {
                this.replaceAnchorWithFileAttachment(anchor, path, filename);
            }
        }
    };

    replaceAnchorWithImage = async (anchor, path, filename, mime) => {
        try {
            await this.fs.ready;
            const bytes = await this.fs.readFileBuffer(path);
            const blob = new Blob([bytes], { type: mime });
            const objectUrl = URL.createObjectURL(blob);
            this._objectUrls.push(objectUrl);
            const img = document.createElement('img');
            img.src = objectUrl;
            img.alt = filename;
            img.className = 'sftoolkit-inline-image';
            anchor.replaceWith(img);
        } catch (_) {
            // Leave anchor in place if FS read fails
        }
    };

    replaceAnchorWithFileAttachment = (anchor, path, filename) => {
        const wrapper = document.createElement('span');
        wrapper.innerHTML = buildFileAttachmentHTML(path, filename);
        anchor.replaceWith(wrapper.firstChild);
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
            (Object.assign(newElement, {
                codeBlock: el.innerHTML,
                language: mapping[c] || c,
                title: '',
            }),
                (el.innerHTML = ''),
                el.appendChild(newElement));
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
            const mermaid = await ensureMermaidLoaded();
            if (!mermaid) return;
            if (await mermaid.parse(diagramText)) {
                const { svg, bindFunctions } = await mermaid.render('graphDiv', diagramText);
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
