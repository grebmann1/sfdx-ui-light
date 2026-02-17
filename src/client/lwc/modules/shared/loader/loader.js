import { isChromeExtension } from 'shared/utils';

const scriptPromisesBySrc = new Map();

function getAssetUrl(path) {
    if (!path) return path;
    if (isChromeExtension() && typeof chrome !== 'undefined' && chrome?.runtime?.getURL) {
        const normalized = path.startsWith('/') ? path.slice(1) : path;
        return chrome.runtime.getURL(normalized);
    }
    return path;
}

function loadScriptOnce(src) {
    if (!src) {
        return Promise.reject(new Error('Missing script src'));
    }
    if (scriptPromisesBySrc.has(src)) {
        return scriptPromisesBySrc.get(src);
    }

    const promise = new Promise((resolve, reject) => {
        const existing = document.querySelector(`script[src="${src}"]`);
        if (existing) {
            resolve();
            return;
        }

        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
        document.head.appendChild(script);
    });

    scriptPromisesBySrc.set(src, promise);
    return promise;
}

export async function ensureMonacoLoaded() {
    if (typeof window !== 'undefined' && window.monaco) {
        return window.monaco;
    }
    const src = getAssetUrl('/libs/monaco/monaco.bundle.js');
    await loadScriptOnce(src);
    return window.monaco;
}

export async function ensureOpenAIAgentsBundleLoaded() {
    if (typeof window !== 'undefined' && window.OpenAIAgentsBundle) {
        return window.OpenAIAgentsBundle;
    }
    const src = getAssetUrl('/libs/openai/bundle.min.js');
    await loadScriptOnce(src);
    return window.OpenAIAgentsBundle;
}

export async function ensureMermaidLoaded() {
    if (typeof window !== 'undefined' && window.mermaid) {
        return window.mermaid;
    }
    const src = getAssetUrl('/libs/mermaid/mermaid.min.js');
    await loadScriptOnce(src);
    return window.mermaid;
}

