/**
 * Chrome Extension Port Singleton Handler
 * Inspired by src/client_chrome/components/views/default/default.js
 */
let _chromePort = null;

export function getChromePort() {
    return _chromePort;
}

export function registerChromePort(chromePort) {
    _chromePort = chromePort;
    return _chromePort;
}

export function disconnectChromePort() {
    if (_chromePort) {
        _chromePort.disconnect();
        _chromePort = null;
    }
}
