/**
 * Chrome Extension Port Singleton Handler
 * Inspired by src/client_chrome/components/views/default/default.js
 */
type ChromePort = {
    disconnect: () => void;
};

let _chromePort: ChromePort | null = null;

export function getChromePort(): ChromePort | null {
    return _chromePort;
}

export function registerChromePort(chromePort: ChromePort): ChromePort {
    _chromePort = chromePort;
    return _chromePort;
}

export function disconnectChromePort(): void {
    if (_chromePort) {
        _chromePort.disconnect();
        _chromePort = null;
    }
}
