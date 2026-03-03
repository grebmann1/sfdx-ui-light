/**
 * Base64url-safe encode/decode for JSON payloads (URL-safe, UTF-8 friendly).
 */

/**
 * Encode an object to a base64url string suitable for query params.
 * @param {Object} obj - Plain object to encode
 * @returns {string} Base64url string (no +, /, or padding)
 */
export function encodeJsonToBase64Url(obj) {
    const json = JSON.stringify(obj);
    const encoded = btoa(unescape(encodeURIComponent(json)));
    return encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Decode a base64url string back to a plain object.
 * @param {string} str - Base64url string from encodeJsonToBase64Url
 * @returns {Object} Decoded object
 */
export function decodeBase64UrlToJson(str) {
    if (!str || typeof str !== 'string') return null;
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    const pad = base64.length % 4;
    if (pad) base64 += '='.repeat(4 - pad);
    try {
        const decoded = decodeURIComponent(escape(atob(base64)));
        return JSON.parse(decoded);
    } catch {
        return null;
    }
}
