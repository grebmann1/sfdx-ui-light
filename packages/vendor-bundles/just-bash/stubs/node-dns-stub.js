/**
 * Browser stub for node:dns. just-bash uses it for fetch private-IP checks.
 * lookup() resolves with an empty list so no private IPs are reported.
 */
export function lookup(hostname, options, callback) {
    if (typeof options === 'function') {
        callback = options;
        options = {};
    }
    if (typeof callback !== 'function') {
        callback = () => {};
    }
    setTimeout(() => callback(null, []), 0);
}
