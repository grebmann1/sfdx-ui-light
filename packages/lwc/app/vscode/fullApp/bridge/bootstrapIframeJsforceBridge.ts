import { bootstrapIframePortHandshake } from './bootstrapIframePortHandshake';
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

export async function bootstrapIframeJsforceBridge({
    timeoutMs = DEFAULT_HANDSHAKE_TIMEOUT_MS,
} = {}) {
    if (bridgePortPromise) {
        return await bridgePortPromise;
    }
    bridgePortPromise = bootstrapIframePortHandshake({
        protocol: IFRAME_JSFORCE_BRIDGE_PROTOCOL,
        defaultVersion: IFRAME_JSFORCE_BRIDGE_VERSION,
        queryVersionParam: IFRAME_JSFORCE_BRIDGE_QUERY_VERSION_PARAM,
        queryParentOriginParam: IFRAME_JSFORCE_BRIDGE_QUERY_PARENT_ORIGIN_PARAM,
        helloMessageType: IFRAME_JSFORCE_BRIDGE_WINDOW_MESSAGE_TYPES.HELLO,
        portMessageType: IFRAME_JSFORCE_BRIDGE_WINDOW_MESSAGE_TYPES.PORT,
        readyMessageType: IFRAME_JSFORCE_BRIDGE_PORT_MESSAGE_TYPES.READY,
        timeoutMs,
        isEnabled: isIframeJsforceBridgeEnabled,
        isEnvelope: isIframeJsforceBridgeEnvelope,
        disabledErrorMessage: 'Iframe JSForce bridge is disabled for this URL.',
        missingParentErrorMessage: 'Iframe JSForce bridge requires a parent window.',
        missingPortErrorMessage:
            'Iframe JSForce bridge port transfer did not include a MessagePort.',
        timeoutErrorMessage: 'Timed out waiting for iframe JSForce bridge handshake.',
    }).catch(error => {
        bridgePortPromise = null;
        throw error;
    });

    return await bridgePortPromise;
}
