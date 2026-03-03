/**
 * Formatting utilities
 */

export function formatBytes(bytes, decimals = 2) {
    if (!+bytes) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function basicTextFormatter(text, filter) {
    var regex = new RegExp('(' + filter + ')', 'gim');
    if (regex.test(text)) {
        text = text
            .toString()
            .replace(regex, `<span style="font-weight:Bold; color:blue;">$1</span>`);
    }
    return text;
}

export const shortFormatter = new Intl.NumberFormat('en-US', {
    notation: 'compact',
    compactDisplay: 'short',
    maximumFractionDigits: 1,
});

export function detectLanguageFromContentType(header) {
    if (!header) return null;
    const contentTypeLine = header
        .split('\n')
        .find(line => line.toLowerCase().startsWith('content-type:'));
    if (!contentTypeLine) return null;
    const value = contentTypeLine.split(':')[1]?.toLowerCase() || '';
    if (value.includes('json')) return 'json';
    if (value.includes('xml')) return 'xml';
    if (value.includes('html')) return 'html';
    if (value.includes('javascript')) return 'javascript';
    if (value.includes('text/plain')) return 'text';
    // Add more as needed
    return null;
}

export const autoDetectAndFormat = (text, header) => {
    // 1. Try header-based detection first
    const langFromHeader = detectLanguageFromContentType(header);
    if (langFromHeader) return langFromHeader;

    // 2. Fallback to content-based detection
    const trimmedText = (text || '').trim();
    if (trimmedText.startsWith('{') || trimmedText.startsWith('[')) {
        return 'json';
    }
    if (trimmedText.startsWith('<')) {
        return 'xml';
    }
    return null;
};
