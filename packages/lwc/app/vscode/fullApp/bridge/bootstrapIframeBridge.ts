import { bootstrapIframePortHandshake } from './bootstrapIframePortHandshake';
import {
    IFRAME_FS_BRIDGE_PROTOCOL,
    IFRAME_FS_BRIDGE_QUERY_FLAG,
    IFRAME_FS_BRIDGE_QUERY_PARENT_ORIGIN_PARAM,
    IFRAME_FS_BRIDGE_QUERY_VERSION_PARAM,
    IFRAME_FS_BRIDGE_VERSION,
    IFRAME_FS_BRIDGE_WINDOW_MESSAGE_TYPES,
    IFRAME_FS_BRIDGE_PORT_MESSAGE_TYPES,
    isIframeFsBridgeEnvelope,
} from './iframeFsBridgeContract';

const DEFAULT_HANDSHAKE_TIMEOUT_MS = 15000;

let bridgePortPromise: Promise<MessagePort> | null = null;
let bridgeWorkspaceRoot = '/workspace';

function getCurrentUrl(locationHref = globalThis.location?.href || '') {
    try {
        return new URL(locationHref);
    } catch {
        return null;
    }
}

export function isIframeFsBridgeEnabled(locationHref = globalThis.location?.href || '') {
    const url = getCurrentUrl(locationHref);
    if (!url) {
        return false;
    }
    return url.searchParams.get(IFRAME_FS_BRIDGE_QUERY_FLAG) === '1';
}

export function getIframeBridgeWorkspaceRoot() {
    return bridgeWorkspaceRoot;
}

export async function bootstrapIframeBridge({ timeoutMs = DEFAULT_HANDSHAKE_TIMEOUT_MS } = {}) {
    if (bridgePortPromise) {
        return await bridgePortPromise;
    }
    bridgePortPromise = bootstrapIframePortHandshake({
        protocol: IFRAME_FS_BRIDGE_PROTOCOL,
        defaultVersion: IFRAME_FS_BRIDGE_VERSION,
        queryVersionParam: IFRAME_FS_BRIDGE_QUERY_VERSION_PARAM,
        queryParentOriginParam: IFRAME_FS_BRIDGE_QUERY_PARENT_ORIGIN_PARAM,
        helloMessageType: IFRAME_FS_BRIDGE_WINDOW_MESSAGE_TYPES.HELLO,
        portMessageType: IFRAME_FS_BRIDGE_WINDOW_MESSAGE_TYPES.PORT,
        readyMessageType: IFRAME_FS_BRIDGE_PORT_MESSAGE_TYPES.READY,
        timeoutMs,
        isEnabled: isIframeFsBridgeEnabled,
        isEnvelope: isIframeFsBridgeEnvelope,
        disabledErrorMessage: 'Iframe filesystem bridge is disabled for this URL.',
        missingParentErrorMessage: 'Iframe filesystem bridge requires a parent window.',
        missingPortErrorMessage: 'Iframe bridge port transfer did not include a MessagePort.',
        timeoutErrorMessage: 'Timed out waiting for iframe filesystem bridge handshake.',
        onPortTransferMessage(message) {
            bridgeWorkspaceRoot =
                typeof message.workspaceRoot === 'string' && message.workspaceRoot.trim()
                    ? message.workspaceRoot
                    : '/workspace';
        },
    }).catch(error => {
        bridgePortPromise = null;
        throw error;
    });

    return await bridgePortPromise;
}
