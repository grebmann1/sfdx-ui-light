"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DesktopLegacyBus = void 0;
const node_crypto_1 = require("node:crypto");
class DesktopLegacyBus {
    pendingResponses = new Map();
    handleRendererMessage(payload) {
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
    async send(channel, args, target, timeoutMs = 30_000) {
        if (target.isDestroyed()) {
            throw new Error('The target desktop window is no longer available.');
        }
        const callbackChannel = `desktop:legacy:callback:${(0, node_crypto_1.randomUUID)()}`;
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
    rejectAll(reason) {
        for (const [channel, pending] of this.pendingResponses.entries()) {
            clearTimeout(pending.timeout);
            pending.reject(new Error(reason));
            this.pendingResponses.delete(channel);
        }
    }
}
exports.DesktopLegacyBus = DesktopLegacyBus;
