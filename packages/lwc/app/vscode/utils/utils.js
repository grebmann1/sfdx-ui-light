export function encodeUtf8(text) {
    return new TextEncoder().encode(text ?? '');
}

export const STORAGE_KEYS = {
    instanceUrl: 'sf_workbench_instanceUrl',
    accessToken: 'sf_workbench_accessToken',
    useProxy: 'sf_workbench_useProxy',
    proxyUrl: 'sf_workbench_proxyUrl',
    panelCollapsed: 'sf_workbench_panelCollapsed',
};

export function sanitizePathSegment(seg) {
    return String(seg ?? 'unnamed')
        .replace(/[\\/:*?"<>|]/g, '_')
        .replace(/\s+/g, ' ')
        .trim();
}

export function extFromAuraFormat(format) {
    const f = String(format || '').toUpperCase();
    if (f === 'JS') return 'js';
    if (f === 'CSS') return 'css';
    if (f === 'SVG') return 'svg';
    if (f === 'XML') return 'xml';
    return 'txt';
}

export function auraFilename(bundleName, defType, format) {
    const b = sanitizePathSegment(bundleName);
    const t = String(defType || '').toUpperCase();
    switch (t) {
        case 'APPLICATION':
            return `${b}.app`;
        case 'COMPONENT':
            return `${b}.cmp`;
        case 'EVENT':
            return `${b}.evt`;
        case 'INTERFACE':
            return `${b}.intf`;
        case 'TOKENS':
            return `${b}.tokens`;
        case 'TESTSUITE':
            return `${b}.testSuite`;
        case 'STYLE':
            return `${b}.css`;
        case 'CONTROLLER':
            return `${b}Controller.js`;
        case 'HELPER':
            return `${b}Helper.js`;
        case 'RENDERER':
            return `${b}Renderer.js`;
        case 'DESIGN':
            return `${b}.design`;
        case 'DOCUMENTATION':
            return `${b}.auradoc`;
        case 'SVG':
            return `${b}.svg`;
        default: {
            const ext = extFromAuraFormat(format);
            return `${b}.${t.toLowerCase()}.${ext}`;
        }
    }
}

export async function mapWithConcurrency(items, concurrency, fn) {
    const list = Array.isArray(items) ? items : [];
    const limit = Math.max(1, Math.min(concurrency || 4, list.length || 1));
    const out = new Array(list.length);
    let nextIdx = 0;
    const workers = Array.from({ length: limit }, async () => {
        while (nextIdx < list.length) {
            const idx = nextIdx;
            nextIdx += 1;
            out[idx] = await fn(list[idx], idx);
        }
    });
    await Promise.all(workers);
    return out;
}

const buffer = {};
export function runActionAfterTimeOut(value, action, { timeout = 300, key = 'default' } = {}) {
    if (buffer[key]) {
        clearTimeout(buffer[key]);
    }
    // eslint-disable-next-line @lwc/lwc/no-async-operation
    buffer[key] = setTimeout(() => {
        action(value);
    }, timeout);
}
