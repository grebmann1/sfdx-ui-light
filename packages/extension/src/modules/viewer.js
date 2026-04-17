import { createBashInstance, createShellRunner } from 'core/bash';
import { getIndexedDbFileSystem } from 'core/fs';
import { marked } from 'shared/markdown';
import { CSV } from 'shared/utils';

const fs = getIndexedDbFileSystem();
const bash = createBashInstance();
const shellRunner = createShellRunner({ bash });

const fsBridgeScript = `
(function() {
  function sendRequest(type, payload, timeoutMs) {
    timeoutMs = timeoutMs || 30000;
    return new Promise(function(resolve, reject) {
      var id = crypto.randomUUID();
      var responseType = type.replace('_REQUEST', '_RESPONSE');

      function handler(event) {
        if (event.data && event.data.type === responseType && event.data.id === id) {
          window.removeEventListener('message', handler);
          clearTimeout(timeout);
          if (event.data.success) {
            resolve(event.data);
          } else {
            reject(new Error(event.data.error || type + ' failed'));
          }
        }
      }

      window.addEventListener('message', handler);
      var timeout = setTimeout(function() {
        window.removeEventListener('message', handler);
        reject(new Error(type + ' timeout'));
      }, timeoutMs);

      var message = Object.assign({ type: type, id: id }, payload);
      window.parent.postMessage(message, '*');
    });
  }

  // Expose the same API as the agent sandbox
  window.readFile = function(path) {
    return sendRequest('FS_READ_REQUEST', { path: path }).then(function(r) { return r.content; });
  };

  window.writeFile = function(path, content) {
    return sendRequest('FS_WRITE_REQUEST', { path: path, content: content });
  };

  window.listFiles = function(path) {
    return sendRequest('FS_LIST_REQUEST', { path: path }).then(function(r) { return r.entries; });
  };

  window.deleteFile = function(path) {
    return sendRequest('FS_DELETE_REQUEST', { path: path });
  };

  window.mkdir = function(path) {
    return sendRequest('FS_MKDIR_REQUEST', { path: path });
  };

  window.exists = function(path) {
    return sendRequest('FS_EXISTS_REQUEST', { path: path }).then(function(r) { return r.exists; });
  };

  window.stat = function(path) {
    return sendRequest('FS_STAT_REQUEST', { path: path }).then(function(r) { return r.stat; });
  };

  window.bash = function(command, opts) {
    var cwd = opts && opts.cwd;
    return sendRequest('BASH_REQUEST', { command: command, cwd: cwd }, 60000)
      .then(function(r) { return { stdout: r.stdout, stderr: r.stderr, exitCode: r.exitCode }; });
  };

  // Signal that the FS bridge is ready
  window.dispatchEvent(new Event('fs-bridge-ready'));
})();
`;

const viewState = {
    status: 'loading',
    payload: null,
};

const style = document.createElement('style');
style.textContent = `
  :root {
    color-scheme: light dark;
  }

  body {
    margin: 0;
    font-family: system-ui, -apple-system, sans-serif;
    color: #1f2933;
    background: #f7f9fc;
  }

  .viewer-root {
    display: flex;
    flex-direction: column;
    height: 100vh;
  }

  .viewer-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 16px;
    border-bottom: 1px solid #e1e5ee;
    background: #ffffff;
  }

  .viewer-title {
    font-size: 14px;
    font-weight: 600;
    color: #111827;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 70%;
  }

  .viewer-download {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 6px;
    border: none;
    background: #2563eb;
    color: #ffffff;
    font-size: 12px;
    cursor: pointer;
  }

  .viewer-download[disabled] {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .viewer-content {
    flex: 1;
    overflow: auto;
    background: #ffffff;
  }

  .viewer-center {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: #6b7280;
    font-size: 14px;
  }

  .viewer-error {
    color: #b91c1c;
  }

  .viewer-markdown,
  .viewer-text,
  .viewer-table {
    padding: 24px;
  }

  .viewer-text pre {
    white-space: pre-wrap;
    margin: 0;
    font-size: 13px;
  }

  .viewer-table table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }

  .viewer-table th,
  .viewer-table td {
    border: 1px solid #e5e7eb;
    padding: 8px 10px;
    text-align: left;
    vertical-align: top;
  }

  .viewer-table th {
    background: #f3f4f6;
    font-weight: 600;
  }
`;
document.head.appendChild(style);

const root = document.getElementById('root');
root.className = 'viewer-root';

const headerEl = document.createElement('div');
headerEl.className = 'viewer-header';

const titleEl = document.createElement('div');
titleEl.className = 'viewer-title';
titleEl.textContent = 'Loading...';

const downloadButton = document.createElement('button');
downloadButton.type = 'button';
downloadButton.className = 'viewer-download';
downloadButton.title = 'Download file';
downloadButton.textContent = 'Download';

headerEl.appendChild(titleEl);
headerEl.appendChild(downloadButton);

const contentEl = document.createElement('div');
contentEl.className = 'viewer-content';

root.appendChild(headerEl);
root.appendChild(contentEl);

let filePath = null;
let baseDir = '/';
let isSandboxReady = false;
let pendingHtml = null;
let iframeEl = null;

function normalizePath(path) {
    const value = String(path || '/').trim();
    if (!value.startsWith('/')) return `/${value}`;
    return value;
}

function dirname(path) {
    const normalized = normalizePath(path);
    const index = normalized.lastIndexOf('/');
    if (index <= 0) return '/';
    return normalized.slice(0, index);
}

function resolvePath(base, relative) {
    if (relative.startsWith('/')) return normalizePath(relative);
    return normalizePath(`${base}/${relative}`);
}

function getExtension(path) {
    const last = path.split('/').pop() || '';
    const parts = last.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

function isHtmlFile(path) {
    const ext = getExtension(path);
    return ext === 'html' || ext === 'htm';
}

function isMarkdownFile(path) {
    const ext = getExtension(path);
    return ext === 'md' || ext === 'markdown';
}

function isCsvFile(path) {
    const ext = getExtension(path);
    return ext === 'csv' || ext === 'tsv';
}

function getMimeType(path) {
    const ext = getExtension(path);
    switch (ext) {
        case 'html':
        case 'htm':
            return 'text/html';
        case 'md':
        case 'markdown':
            return 'text/markdown';
        case 'csv':
            return 'text/csv';
        case 'tsv':
            return 'text/tab-separated-values';
        case 'json':
            return 'application/json';
        case 'svg':
            return 'image/svg+xml';
        case 'png':
            return 'image/png';
        case 'jpg':
        case 'jpeg':
            return 'image/jpeg';
        case 'gif':
            return 'image/gif';
        case 'webp':
            return 'image/webp';
        case 'pdf':
            return 'application/pdf';
        default:
            return 'text/plain';
    }
}

function updateTitle(text) {
    titleEl.textContent = text;
    document.title = `Viewing: ${text}`;
}

function setDownloadEnabled(enabled) {
    downloadButton.disabled = !enabled;
}

function clearContent() {
    while (contentEl.firstChild) {
        contentEl.removeChild(contentEl.firstChild);
    }
}

function setLoading(message = 'Loading...') {
    viewState.status = 'loading';
    viewState.payload = null;
    clearContent();
    const center = document.createElement('div');
    center.className = 'viewer-center';
    center.textContent = message;
    contentEl.appendChild(center);
    setDownloadEnabled(false);
}

function setError(message) {
    viewState.status = 'error';
    viewState.payload = { message };
    clearContent();
    const center = document.createElement('div');
    center.className = 'viewer-center viewer-error';
    center.textContent = message;
    contentEl.appendChild(center);
    updateTitle(message);
    setDownloadEnabled(false);
}

function ensureSandboxIframe() {
    if (iframeEl) return;
    iframeEl = document.createElement('iframe');
    iframeEl.title = 'Viewer';
    iframeEl.style.width = '100%';
    iframeEl.style.height = '100%';
    iframeEl.style.border = '0';
    const src = typeof chrome !== 'undefined' && chrome.runtime?.getURL
        ? chrome.runtime.getURL('views/sandbox-render.html')
        : '/views/sandbox-render.html';
    iframeEl.src = src;
}

function renderHtml(html, raw) {
    viewState.status = 'html';
    viewState.payload = { html, raw };
    clearContent();
    ensureSandboxIframe();
    contentEl.appendChild(iframeEl);
    pendingHtml = html;
    if (isSandboxReady) {
        iframeEl.contentWindow?.postMessage({ type: 'render', html }, '*');
    }
    setDownloadEnabled(true);
}

async function renderMarkdown(content, raw) {
    viewState.status = 'markdown';
    viewState.payload = { content, raw };
    clearContent();
    const wrapper = document.createElement('div');
    wrapper.className = 'viewer-markdown';

    const html = marked(content || '');
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const fragment = document.createDocumentFragment();
    Array.from(doc.body.childNodes).forEach(node => fragment.appendChild(node));
    wrapper.appendChild(fragment);

    await inlineMarkdownImages(wrapper, baseDir);
    contentEl.appendChild(wrapper);
    setDownloadEnabled(true);
}

function renderCsv(parsed, raw) {
    viewState.status = 'csv';
    viewState.payload = { parsed, raw };
    clearContent();
    const wrapper = document.createElement('div');
    wrapper.className = 'viewer-table';

    const table = document.createElement('table');
    const headers = parsed.headers || [];
    const rows = Array.isArray(parsed.rows) ? parsed.rows : [];

    if (headers.length > 0) {
        const thead = document.createElement('thead');
        const headRow = document.createElement('tr');
        headers.forEach(header => {
            const th = document.createElement('th');
            th.textContent = header;
            headRow.appendChild(th);
        });
        thead.appendChild(headRow);
        table.appendChild(thead);
    }

    const tbody = document.createElement('tbody');
    rows.forEach(row => {
        const tr = document.createElement('tr');
        headers.forEach(header => {
            const td = document.createElement('td');
            td.textContent = row?.[header] != null ? String(row[header]) : '';
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrapper.appendChild(table);
    contentEl.appendChild(wrapper);
    setDownloadEnabled(true);
}

function renderText(content, raw) {
    viewState.status = 'text';
    viewState.payload = { content, raw };
    clearContent();
    const wrapper = document.createElement('div');
    wrapper.className = 'viewer-text';
    const pre = document.createElement('pre');
    pre.textContent = content || '';
    wrapper.appendChild(pre);
    contentEl.appendChild(wrapper);
    setDownloadEnabled(true);
}

async function inlineMarkdownImages(container, baseDirPath) {
    const images = Array.from(container.querySelectorAll('img[src]'));
    await Promise.all(
        images.map(async img => {
            const src = img.getAttribute('src') || '';
            if (
                src.startsWith('http:') ||
                src.startsWith('https:') ||
                src.startsWith('data:') ||
                src.startsWith('blob:')
            ) {
                return;
            }
            const resolved = resolvePath(baseDirPath, src);
            try {
                const base64 = await fs.readFile(resolved, 'base64');
                const mime = getMimeType(resolved);
                img.setAttribute('src', `data:${mime};base64,${base64}`);
            } catch (error) {
                console.error('Failed to load image:', error);
                const fallback = document.createElement('span');
                fallback.textContent = `[Image not found: ${src}]`;
                img.replaceWith(fallback);
            }
        })
    );
}

class HtmlResourceInliner {
    constructor(fsInstance) {
        this.fs = fsInstance;
        this.dataUrlCache = new Map();
        this.processing = new Set();
    }

    async loadHtml(filePath) {
        const html = await this.fs.readFile(filePath);
        const doc = new DOMParser().parseFromString(html, 'text/html');
        await this.processDocument(doc, dirname(filePath));
        return `<!DOCTYPE html>\n${doc.documentElement.outerHTML}`;
    }

    injectFsBridge(document) {
        const script = document.createElement('script');
        script.textContent = fsBridgeScript;
        const root = document.head || document.documentElement;
        root.insertBefore(script, root.firstChild);
    }

    async processDocument(document, baseDirPath) {
        this.injectFsBridge(document);

        const cssLinks = document.querySelectorAll('link[rel="stylesheet"][href]');
        for (const link of cssLinks) {
            const href = link.getAttribute('href');
            if (href && !href.startsWith('data:') && !href.startsWith('http')) {
                const resolved = resolvePath(baseDirPath, href);
                const css = await this.loadCssResource(resolved);
                if (css) {
                    const styleEl = document.createElement('style');
                    styleEl.textContent = css;
                    link.replaceWith(styleEl);
                }
            }
        }

        const scripts = document.querySelectorAll('script[src]');
        for (const script of scripts) {
            const src = script.getAttribute('src');
            if (src && !src.startsWith('data:') && !src.startsWith('http')) {
                const resolved = resolvePath(baseDirPath, src);
                const js = await this.loadTextResource(resolved);
                if (js) {
                    script.removeAttribute('src');
                    script.textContent = js;
                }
            }
        }

        const images = document.querySelectorAll('img[src], img[srcset]');
        for (const img of images) {
            const src = img.getAttribute('src');
            if (src && !src.startsWith('data:') && !src.startsWith('http')) {
                const resolved = resolvePath(baseDirPath, src);
                const dataUrl = await this.loadResourceAsDataUrl(resolved);
                if (dataUrl) {
                    img.setAttribute('src', dataUrl);
                }
            }

            const srcset = img.getAttribute('srcset');
            if (srcset) {
                const updated = await this.processSrcset(srcset, baseDirPath);
                img.setAttribute('srcset', updated);
            }
        }

        const media = document.querySelectorAll('video[src], audio[src], source[src]');
        for (const node of media) {
            const src = node.getAttribute('src');
            if (src && !src.startsWith('data:') && !src.startsWith('http')) {
                const resolved = resolvePath(baseDirPath, src);
                const dataUrl = await this.loadResourceAsDataUrl(resolved);
                if (dataUrl) {
                    node.setAttribute('src', dataUrl);
                }
            }
        }

        const videoPosters = document.querySelectorAll('video[poster]');
        for (const video of videoPosters) {
            const poster = video.getAttribute('poster');
            if (poster && !poster.startsWith('data:') && !poster.startsWith('http')) {
                const resolved = resolvePath(baseDirPath, poster);
                const dataUrl = await this.loadResourceAsDataUrl(resolved);
                if (dataUrl) {
                    video.setAttribute('poster', dataUrl);
                }
            }
        }

        const iframes = document.querySelectorAll('iframe[src]');
        for (const iframe of iframes) {
            const src = iframe.getAttribute('src');
            if (src && !src.startsWith('data:') && !src.startsWith('http')) {
                const resolved = resolvePath(baseDirPath, src);
                if (resolved.endsWith('.html')) {
                    const html = await this.loadHtmlResource(resolved);
                    if (html) {
                        iframe.removeAttribute('src');
                        iframe.setAttribute('srcdoc', html);
                    }
                }
            }
        }

        const styleTags = document.querySelectorAll('style');
        for (const styleEl of styleTags) {
            if (styleEl.textContent) {
                styleEl.textContent = await this.processCss(styleEl.textContent, baseDirPath);
            }
        }

        const inlineStyles = document.querySelectorAll('[style]');
        for (const node of inlineStyles) {
            const styleValue = node.getAttribute('style');
            if (styleValue && styleValue.includes('url(')) {
                const updated = await this.processCss(styleValue, baseDirPath);
                node.setAttribute('style', updated);
            }
        }
    }

    async processSrcset(srcset, baseDirPath) {
        const parts = srcset.split(',').map(value => value.trim());
        const updated = [];
        for (const part of parts) {
            const tokens = part.split(/\s+/);
            const url = tokens[0];
            const size = tokens.slice(1).join(' ');
            if (url && !url.startsWith('data:') && !url.startsWith('http')) {
                const resolved = resolvePath(baseDirPath, url);
                const dataUrl = await this.loadResourceAsDataUrl(resolved);
                if (dataUrl) {
                    updated.push(size ? `${dataUrl} ${size}` : dataUrl);
                    continue;
                }
            }
            updated.push(part);
        }
        return updated.join(', ');
    }

    async loadResourceAsDataUrl(filePath) {
        if (this.dataUrlCache.has(filePath)) {
            return this.dataUrlCache.get(filePath);
        }
        if (this.processing.has(filePath)) {
            console.warn(`Circular reference detected: ${filePath}`);
            return null;
        }
        this.processing.add(filePath);
        try {
            if (!(await this.fs.exists(filePath))) {
                console.warn(`File not found: ${filePath}`);
                return null;
            }
            const base64 = await this.fs.readFile(filePath, 'base64');
            const mime = getMimeType(filePath);
            const dataUrl = `data:${mime};base64,${base64}`;
            this.dataUrlCache.set(filePath, dataUrl);
            return dataUrl;
        } catch (error) {
            console.error(`Failed to load resource: ${filePath}`, error);
            return null;
        } finally {
            this.processing.delete(filePath);
        }
    }

    async loadTextResource(filePath) {
        try {
            if (await this.fs.exists(filePath)) {
                return await this.fs.readFile(filePath);
            }
            console.warn(`File not found: ${filePath}`);
            return null;
        } catch (error) {
            console.error(`Failed to load text resource: ${filePath}`, error);
            return null;
        }
    }

    async loadCssResource(filePath) {
        if (this.processing.has(filePath)) {
            console.warn(`Circular reference detected: ${filePath}`);
            return null;
        }
        this.processing.add(filePath);
        try {
            if (!(await this.fs.exists(filePath))) {
                console.warn(`File not found: ${filePath}`);
                return null;
            }
            const css = await this.fs.readFile(filePath);
            return await this.processCss(css, dirname(filePath));
        } catch (error) {
            console.error(`Failed to load CSS resource: ${filePath}`, error);
            return null;
        } finally {
            this.processing.delete(filePath);
        }
    }

    async loadHtmlResource(filePath) {
        if (this.processing.has(filePath)) {
            console.warn(`Circular reference detected: ${filePath}`);
            return null;
        }
        this.processing.add(filePath);
        try {
            if (!(await this.fs.exists(filePath))) {
                console.warn(`File not found: ${filePath}`);
                return null;
            }
            const html = await this.fs.readFile(filePath);
            const doc = new DOMParser().parseFromString(html, 'text/html');
            await this.processDocument(doc, dirname(filePath));
            return `<!DOCTYPE html>\n${doc.documentElement.outerHTML}`;
        } catch (error) {
            console.error(`Failed to load HTML resource: ${filePath}`, error);
            return null;
        } finally {
            this.processing.delete(filePath);
        }
    }

    async processCss(cssText, baseDirPath) {
        let result = cssText;
        const importRegex = /@import\s+(?:url\\(['"]?([^'")\\s]+)['"]?\\)|['"]([^'"]+)['"]);?/g;
        const imports = [];
        let match = null;
        for (; (match = importRegex.exec(cssText)) !== null; ) {
            const path = match[1] || match[2];
            if (path && !path.startsWith('data:') && !path.startsWith('http')) {
                imports.push({ match: match[0], path });
            }
        }

        for (const { match: fullMatch, path } of imports) {
            const resolved = resolvePath(baseDirPath, path);
            const css = await this.loadCssResource(resolved);
            if (css) {
                result = result.replace(fullMatch, css);
            }
        }

        const urlRegex = /url\\(['"]?(?!data:|blob:|https?:)([^'")\\s]+)['"]?\\)/g;
        const urls = [];
        for (; (match = urlRegex.exec(cssText)) !== null; ) {
            urls.push({ match: match[0], path: match[1] });
        }

        for (const { match: fullMatch, path } of urls) {
            const resolved = resolvePath(baseDirPath, path);
            const dataUrl = await this.loadResourceAsDataUrl(resolved);
            if (dataUrl) {
                result = result.replace(fullMatch, `url('${dataUrl}')`);
            }
        }

        return result;
    }
}

function updateFromQuery() {
    const fileParam = new URLSearchParams(window.location.search).get('file');
    if (!fileParam) {
        setError('Missing file param');
        return;
    }
    filePath = fileParam;
    baseDir = dirname(fileParam);
    updateTitle(fileParam.split('/').filter(Boolean).pop() || fileParam);
    loadFile();
}

async function loadFile() {
    if (!filePath) return;
    setLoading();
    try {
        const raw = await fs.readFile(filePath);
        if (isHtmlFile(filePath)) {
            const html = await new HtmlResourceInliner(fs).loadHtml(filePath);
            renderHtml(html, raw);
            return;
        }
        if (isMarkdownFile(filePath)) {
            await renderMarkdown(raw, raw);
            return;
        }
        if (isCsvFile(filePath)) {
            const delimiter = getExtension(filePath) === 'tsv' ? '\t' : ',';
            const parsed = CSV.parseCsvText(raw, { delimiter });
            renderCsv(parsed, raw);
            return;
        }
        renderText(raw, raw);
    } catch (error) {
        console.error('[viewer] Failed to load file', error);
        setError('Failed to load file');
    }
}

downloadButton.addEventListener('click', () => {
    if (!filePath) return;
    if (viewState.status === 'loading' || viewState.status === 'error') return;
    const raw = viewState.payload?.raw ?? viewState.payload?.content ?? '';
    const blob = new Blob([raw], { type: getMimeType(filePath) });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filePath.split('/').filter(Boolean).pop() || 'download';
    link.click();
    URL.revokeObjectURL(url);
});

window.addEventListener('popstate', updateFromQuery);
updateFromQuery();

window.addEventListener('message', (event) => {
    if (event.data?.type === 'sandbox-ready') {
        isSandboxReady = true;
        if (pendingHtml && iframeEl?.contentWindow) {
            iframeEl.contentWindow.postMessage({ type: 'render', html: pendingHtml }, '*');
        }
        return;
    }

    const data = event.data;
    if (!data?.type || !data.type.endsWith('_REQUEST')) return;

    const respond = (payload) => {
        if (event.source && 'postMessage' in event.source) {
            event.source.postMessage(payload, '*');
        }
    };

    const fail = (type, id, error) => {
        respond({
            type,
            id,
            success: false,
            error: error instanceof Error ? error.message : String(error),
        });
    };

    switch (data.type) {
        case 'BASH_REQUEST': {
            const command = String(data.command || '');
            const nextCwd = data.cwd ? String(data.cwd) : null;
            shellRunner.run(command, { cwd: nextCwd || undefined })
                .then(result =>
                    respond({
                        type: 'BASH_RESPONSE',
                        id: data.id,
                        success: true,
                        stdout: result.stdout,
                        stderr: result.stderr,
                        exitCode: result.exitCode,
                    })
                )
                .catch(error => fail('BASH_RESPONSE', data.id, error));
            return;
        }
        case 'FS_READ_REQUEST':
            fs.readFile(String(data.path || ''), String(data.encoding || 'utf-8'))
                .then(content =>
                    respond({
                        type: 'FS_READ_RESPONSE',
                        id: data.id,
                        success: true,
                        content,
                    })
                )
                .catch(error => fail('FS_READ_RESPONSE', data.id, error));
            return;
        case 'FS_WRITE_REQUEST':
            fs.writeFile(String(data.path || ''), String(data.content ?? ''), {
                encoding: data.encoding ? String(data.encoding) : undefined,
            })
                .then(() =>
                    respond({ type: 'FS_WRITE_RESPONSE', id: data.id, success: true })
                )
                .catch(error => fail('FS_WRITE_RESPONSE', data.id, error));
            return;
        case 'FS_LIST_REQUEST': {
            const list = async () => {
                if (typeof fs.readdirWithFileTypes === 'function') {
                    return await fs.readdirWithFileTypes(String(data.path || '/workspace'));
                }
                const names = await fs.readdir(String(data.path || '/workspace'));
                return names.map(name => ({
                    name,
                    isFile: false,
                    isDirectory: true,
                    isSymbolicLink: false,
                }));
            };
            list()
                .then(entries =>
                    respond({
                        type: 'FS_LIST_RESPONSE',
                        id: data.id,
                        success: true,
                        entries,
                    })
                )
                .catch(error => fail('FS_LIST_RESPONSE', data.id, error));
            return;
        }
        case 'FS_DELETE_REQUEST':
            fs.rm(String(data.path || ''), {
                recursive: data.recursive ?? true,
                force: data.force ?? true,
            })
                .then(() =>
                    respond({ type: 'FS_DELETE_RESPONSE', id: data.id, success: true })
                )
                .catch(error => fail('FS_DELETE_RESPONSE', data.id, error));
            return;
        case 'FS_MKDIR_REQUEST':
            fs.mkdir(String(data.path || ''), { recursive: data.recursive ?? true })
                .then(() =>
                    respond({ type: 'FS_MKDIR_RESPONSE', id: data.id, success: true })
                )
                .catch(error => fail('FS_MKDIR_RESPONSE', data.id, error));
            return;
        case 'FS_EXISTS_REQUEST':
            fs.exists(String(data.path || ''))
                .then(exists =>
                    respond({
                        type: 'FS_EXISTS_RESPONSE',
                        id: data.id,
                        success: true,
                        exists,
                    })
                )
                .catch(error => fail('FS_EXISTS_RESPONSE', data.id, error));
            return;
        case 'FS_STAT_REQUEST':
            fs.stat(String(data.path || ''))
                .then(stat =>
                    respond({
                        type: 'FS_STAT_RESPONSE',
                        id: data.id,
                        success: true,
                        stat,
                    })
                )
                .catch(error => fail('FS_STAT_RESPONSE', data.id, error));
            return;
        default:
            return;
    }
});
