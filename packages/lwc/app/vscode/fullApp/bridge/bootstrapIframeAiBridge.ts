import { bootstrapIframePortHandshake } from './bootstrapIframePortHandshake';
import {
    IFRAME_AI_BRIDGE_PROTOCOL,
    IFRAME_AI_BRIDGE_QUERY_FLAG,
    IFRAME_AI_BRIDGE_QUERY_PARENT_ORIGIN_PARAM,
    IFRAME_AI_BRIDGE_QUERY_VERSION_PARAM,
    IFRAME_AI_BRIDGE_VERSION,
    IFRAME_AI_BRIDGE_WINDOW_MESSAGE_TYPES,
    IFRAME_AI_BRIDGE_PORT_MESSAGE_TYPES,
    isIframeAiBridgeEnvelope,
} from './iframeAiBridgeContract';

const DEFAULT_HANDSHAKE_TIMEOUT_MS = 15000;

let bridgePortPromise: Promise<MessagePort> | null = null;

function getCurrentUrl(locationHref = globalThis.location?.href || '') {
    try {
        return new URL(locationHref);
    } catch {
        return null;
    }
}

export function isIframeAiBridgeEnabled(locationHref = globalThis.location?.href || '') {
    const url = getCurrentUrl(locationHref);
    if (!url) {
        return false;
    }
    return url.searchParams.get(IFRAME_AI_BRIDGE_QUERY_FLAG) === '1';
}

export async function bootstrapIframeAiBridge({ timeoutMs = DEFAULT_HANDSHAKE_TIMEOUT_MS } = {}) {
    if (bridgePortPromise) {
        return await bridgePortPromise;
    }
    bridgePortPromise = bootstrapIframePortHandshake({
        protocol: IFRAME_AI_BRIDGE_PROTOCOL,
        defaultVersion: IFRAME_AI_BRIDGE_VERSION,
        queryVersionParam: IFRAME_AI_BRIDGE_QUERY_VERSION_PARAM,
        queryParentOriginParam: IFRAME_AI_BRIDGE_QUERY_PARENT_ORIGIN_PARAM,
        helloMessageType: IFRAME_AI_BRIDGE_WINDOW_MESSAGE_TYPES.HELLO,
        portMessageType: IFRAME_AI_BRIDGE_WINDOW_MESSAGE_TYPES.PORT,
        readyMessageType: IFRAME_AI_BRIDGE_PORT_MESSAGE_TYPES.READY,
        timeoutMs,
        isEnabled: isIframeAiBridgeEnabled,
        isEnvelope: isIframeAiBridgeEnvelope,
        disabledErrorMessage: 'Iframe AI bridge is disabled for this URL.',
        missingParentErrorMessage: 'Iframe AI bridge requires a parent window.',
        missingPortErrorMessage: 'Iframe AI bridge port transfer did not include a MessagePort.',
        timeoutErrorMessage: 'Timed out waiting for iframe AI bridge handshake.',
    }).catch(error => {
        bridgePortPromise = null;
        throw error;
    });

    return await bridgePortPromise;
}
