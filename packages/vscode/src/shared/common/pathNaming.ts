export function sanitizePathSegment(seg: unknown) {
    return String(seg ?? 'unnamed')
        .replace(/[\\/:*?"<>|]/g, '_')
        .replace(/\s+/g, ' ')
        .trim();
}

export function extFromAuraFormat(format: unknown) {
    const f = String(format || '').toUpperCase();
    if (f === 'JS') return 'js';
    if (f === 'CSS') return 'css';
    if (f === 'SVG') return 'svg';
    if (f === 'XML') return 'xml';
    return 'txt';
}

export function auraFilename(bundleName: unknown, defType: unknown, format: unknown) {
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
