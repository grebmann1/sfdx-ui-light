const DEFAULT_HANDSHAKE_TIMEOUT_MS = 15000;
const HELLO_RETRY_INTERVAL_MS = 450;

type BootstrapIframePortHandshakeOptions = {
    protocol: string;
    defaultVersion: number;
    queryVersionParam: string;
    queryParentOriginParam: string;
    helloMessageType: string;
    portMessageType: string;
    readyMessageType: string;
    timeoutMs?: number;
    isEnabled: (locationHref?: string) => boolean;
    isEnvelope: (value: unknown) => boolean;
    disabledErrorMessage: string;
    missingParentErrorMessage: string;
    missingPortErrorMessage: string;
    timeoutErrorMessage: string;
    onPortTransferMessage?: (message: Record<string, unknown>) => void;
};

function getCurrentUrl(locationHref = globalThis.location?.href || '') {
    try {
        return new URL(locationHref);
    } catch {
        return null;
    }
}

export function resolveExpectedParentOrigin({
    locationHref = globalThis.location?.href || '',
    queryParentOriginParam,
}: {
    locationHref?: string;
    queryParentOriginParam: string;
}) {
    const url = getCurrentUrl(locationHref);
    if (!url) {
        return '*';
    }
    const explicitOrigin = String(url.searchParams.get(queryParentOriginParam) || '').trim();
    if (!explicitOrigin) {
        return '*';
    }
    try {
        return new URL(explicitOrigin).origin;
    } catch {
        return '*';
    }
}

export function resolveExpectedProtocolVersion({
    locationHref = globalThis.location?.href || '',
    defaultVersion,
    queryVersionParam,
}: {
    locationHref?: string;
    defaultVersion: number;
    queryVersionParam: string;
}) {
    const url = getCurrentUrl(locationHref);
    if (!url) {
        return defaultVersion;
    }
    const rawVersion = Number(url.searchParams.get(queryVersionParam));
    return Number.isFinite(rawVersion) ? rawVersion : defaultVersion;
}

export async function bootstrapIframePortHandshake(
    options: BootstrapIframePortHandshakeOptions
): Promise<MessagePort> {
    const {
        protocol,
        defaultVersion,
        queryVersionParam,
        queryParentOriginParam,
        helloMessageType,
        portMessageType,
        readyMessageType,
        timeoutMs = DEFAULT_HANDSHAKE_TIMEOUT_MS,
        isEnabled,
        isEnvelope,
        disabledErrorMessage,
        missingParentErrorMessage,
        missingPortErrorMessage,
        timeoutErrorMessage,
        onPortTransferMessage,
    } = options;

    if (!isEnabled()) {
        throw new Error(disabledErrorMessage);
    }
    if (typeof window === 'undefined' || window.parent === window) {
        throw new Error(missingParentErrorMessage);
    }

    const expectedParentOrigin = resolveExpectedParentOrigin({
        queryParentOriginParam,
    });
    const expectedProtocolVersion = resolveExpectedProtocolVersion({
        defaultVersion,
        queryVersionParam,
    });

    return await new Promise((resolve, reject) => {
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
            reject(error);
        };

        const sendHello = () => {
            try {
                window.parent.postMessage(
                    {
                        protocol,
                        version: expectedProtocolVersion,
                        type: helloMessageType,
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
            if (!isEnvelope(event.data)) {
                return;
            }
            if (event.data.type !== portMessageType) {
                return;
            }

            const [port] = Array.isArray(event.ports) ? event.ports : [];
            if (!(port instanceof MessagePort)) {
                onFailure(new Error(missingPortErrorMessage));
                return;
            }

            cleanup();
            if (typeof onPortTransferMessage === 'function') {
                try {
                    onPortTransferMessage(
                        event.data && typeof event.data === 'object'
                            ? (event.data as Record<string, unknown>)
                            : {}
                    );
                } catch {
                    // ignore metadata extraction errors
                }
            }
            port.start?.();
            port.postMessage({
                protocol,
                version: expectedProtocolVersion,
                type: readyMessageType,
            });
            resolve(port);
        };

        window.addEventListener('message', handleBridgePortTransfer);
        timeoutHandle = window.setTimeout(
            () => {
                onFailure(new Error(timeoutErrorMessage));
            },
            Math.max(1000, Number(timeoutMs) || DEFAULT_HANDSHAKE_TIMEOUT_MS)
        );
        helloHandle = window.setInterval(sendHello, HELLO_RETRY_INTERVAL_MS);
        sendHello();
    });
}
