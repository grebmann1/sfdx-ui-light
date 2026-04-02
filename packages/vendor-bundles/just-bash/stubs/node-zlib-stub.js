/**
 * Browser stub for node:zlib. just-bash uses it for gzip/gunzip commands.
 * Exports Node-compatible constants; gunzipSync/gzipSync throw in the browser.
 */
export const constants = {
    Z_NO_COMPRESSION: 0,
    Z_BEST_SPEED: 1,
    Z_BEST_COMPRESSION: 9,
    Z_DEFAULT_COMPRESSION: -1,
};

function notAvailable() {
    throw new Error('gzip/gunzip not available in browser');
}

export function gunzipSync() {
    notAvailable();
}

export function gzipSync() {
    notAvailable();
}
