import { randomUUID } from 'node:crypto';

import type { WebContents } from 'electron';

type PendingLegacyResponse = {
    reject: (error: Error) => void;
    resolve: (payload: unknown) => void;
    timeout: NodeJS.Timeout;
};

export class DesktopLegacyBus {
    private readonly pendingResponses = new Map<string, PendingLegacyResponse>();

    handleRendererMessage(payload: { args?: unknown; channel?: string }): boolean {
        const channel = String(payload.channel || '').trim();
        if (!channel) {
            return false;
        }

        const pending = this.pendingResponses.get(channel);
        if (!pending) {
            return false;
        }

        clearTimeout(pending.timeout);
        this.pendingResponses.delete(channel);
        pending.resolve(payload.args);
        return true;
    }

    async send(
        channel: string,
        args: Record<string, unknown>,
        target: WebContents,
        timeoutMs = 30_000
    ): Promise<unknown> {
        if (target.isDestroyed()) {
            throw new Error('The target desktop window is no longer available.');
        }

        const callbackChannel = `desktop:legacy:callback:${randomUUID()}`;

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.pendingResponses.delete(callbackChannel);
                reject(new Error(`Timed out waiting for renderer response on ${channel}.`));
            }, timeoutMs);

            this.pendingResponses.set(callbackChannel, {
                resolve,
                reject,
                timeout,
            });

            target.send(`desktop:legacy:${channel}`, [args, callbackChannel]);
        });
    }

    rejectAll(reason: string): void {
        for (const [channel, pending] of this.pendingResponses.entries()) {
            clearTimeout(pending.timeout);
            pending.reject(new Error(reason));
            this.pendingResponses.delete(channel);
        }
    }
}
