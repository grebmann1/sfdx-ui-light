import {
    IFRAME_JSFORCE_BRIDGE_PROTOCOL,
    IFRAME_JSFORCE_BRIDGE_QUERY_FLAG,
    IFRAME_JSFORCE_BRIDGE_QUERY_PARENT_ORIGIN_PARAM,
    IFRAME_JSFORCE_BRIDGE_QUERY_VERSION_PARAM,
    IFRAME_JSFORCE_BRIDGE_VERSION,
    IFRAME_JSFORCE_BRIDGE_WINDOW_MESSAGE_TYPES,
    IFRAME_JSFORCE_BRIDGE_PORT_MESSAGE_TYPES,
    isIframeJsforceBridgeEnvelope,
} from './iframeJsforceBridgeContract';

const DEFAULT_HANDSHAKE_TIMEOUT_MS = 15000;
const HELLO_RETRY_INTERVAL_MS = 450;

let bridgePortPromise: Promise<MessagePort> | null = null;

function getCurrentUrl(locationHref = globalThis.location?.href || '') {
    try {
        return new URL(locationHref);
    } catch {
        return null;
    }
}

export function isIframeJsforceBridgeEnabled(locationHref = globalThis.location?.href || '') {
    const url = getCurrentUrl(locationHref);
    if (!url) {
        return false;
    }
    return url.searchParams.get(IFRAME_JSFORCE_BRIDGE_QUERY_FLAG) === '1';
}

function getExpectedParentOrigin(locationHref = globalThis.location?.href || '') {
    const url = getCurrentUrl(locationHref);
    if (!url) {
        return '*';
    }
    const explicitOrigin = String(
        url.searchParams.get(IFRAME_JSFORCE_BRIDGE_QUERY_PARENT_ORIGIN_PARAM) || ''
    ).trim();
    if (!explicitOrigin) {
        return '*';
    }
    try {
        return new URL(explicitOrigin).origin;
    } catch {
        return '*';
    }
}

function getExpectedProtocolVersion(locationHref = globalThis.location?.href || '') {
    const url = getCurrentUrl(locationHref);
    if (!url) {
        return IFRAME_JSFORCE_BRIDGE_VERSION;
    }
    const rawVersion = Number(url.searchParams.get(IFRAME_JSFORCE_BRIDGE_QUERY_VERSION_PARAM));
    return Number.isFinite(rawVersion) ? rawVersion : IFRAME_JSFORCE_BRIDGE_VERSION;
}

export async function bootstrapIframeJsforceBridge({
    timeoutMs = DEFAULT_HANDSHAKE_TIMEOUT_MS,
} = {}) {
    if (bridgePortPromise) {
        return await bridgePortPromise;
    }
    if (!isIframeJsforceBridgeEnabled()) {
        throw new Error('Iframe JSForce bridge is disabled for this URL.');
    }
    if (typeof window === 'undefined' || window.parent === window) {
        throw new Error('Iframe JSForce bridge requires a parent window.');
    }

    const expectedParentOrigin = getExpectedParentOrigin();
    const expectedProtocolVersion = getExpectedProtocolVersion();

    bridgePortPromise = new Promise((resolve, reject) => {
        let timeoutHandle: number | null = null;
        let helloHandle: number | null = null;

        const clearTimers = () => {
            if (timeoutHandle) {
                window.clearTimeout(timeoutHandle);
                timeoutHandle = null;
            }
            if (helloHandle) {
                window.clearInterval(helloHandle);
                helloHandle = null;
            }
        };

        const cleanup = () => {
            clearTimers();
            window.removeEventListener('message', handleBridgePortTransfer);
        };

        const onFailure = (error: unknown) => {
            cleanup();
            bridgePortPromise = null;
            reject(error);
        };

        const sendHello = () => {
            try {
                window.parent.postMessage(
                    {
                        protocol: IFRAME_JSFORCE_BRIDGE_PROTOCOL,
                        version: expectedProtocolVersion,
                        type: IFRAME_JSFORCE_BRIDGE_WINDOW_MESSAGE_TYPES.HELLO,
                    },
                    expectedParentOrigin
                );
            } catch {
                // ignore and keep retrying until timeout
            }
        };

        const handleBridgePortTransfer = (event: MessageEvent) => {
            if (event.source !== window.parent) {
                return;
            }
            if (expectedParentOrigin !== '*' && event.origin !== expectedParentOrigin) {
                return;
            }
            if (!isIframeJsforceBridgeEnvelope(event.data)) {
                return;
            }
            if (event.data.type !== IFRAME_JSFORCE_BRIDGE_WINDOW_MESSAGE_TYPES.PORT) {
                return;
            }

            const [port] = Array.isArray(event.ports) ? event.ports : [];
            if (!(port instanceof MessagePort)) {
                onFailure(
                    new Error('Iframe JSForce bridge port transfer did not include a MessagePort.')
                );
                return;
            }

            cleanup();
            port.start?.();
            port.postMessage({
                protocol: IFRAME_JSFORCE_BRIDGE_PROTOCOL,
                version: expectedProtocolVersion,
                type: IFRAME_JSFORCE_BRIDGE_PORT_MESSAGE_TYPES.READY,
            });
            resolve(port);
        };

        window.addEventListener('message', handleBridgePortTransfer);
        timeoutHandle = window.setTimeout(
            () => {
                onFailure(new Error('Timed out waiting for iframe JSForce bridge handshake.'));
            },
            Math.max(1000, Number(timeoutMs) || DEFAULT_HANDSHAKE_TIMEOUT_MS)
        );
        helloHandle = window.setInterval(sendHello, HELLO_RETRY_INTERVAL_MS);
        sendHello();
    });

    return await bridgePortPromise;
}
