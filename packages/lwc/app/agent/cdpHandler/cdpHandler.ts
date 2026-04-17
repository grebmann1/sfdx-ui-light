import LOGGER from 'shared/logger';
import { GOOGLE_DRIVE_SCOPES } from '../googleAuth/constants.js';

/**
 * Chrome Debugger Bridge (CdpHandler)
 *
 * Bridges the sandbox iframe to Chrome DevTools Protocol: attach/detach debugger,
 * run CDP commands, execute code in the sandbox, and manage tabs. Uses chrome.debugger and chrome.tabs.
 *
 * One CdpHandler per conversation (map keyed by conversationId). Use getOrCreateCdpHandler(conversationId, iframe, deps)
 * or ensureCdpHandlerInitialized(conversationId, deps).
 *
 * deps: optional; pass whatever the handler or callers need (e.g. for future use).
 */

const cdpHandlersByConversationId = new Map();

/**
 * Returns the CdpHandler for the given conversation, or null if none exists.
 * @param {string} conversationId
 * @returns {CdpHandler | null}
 */
export function getCdpHandlerForConversation(conversationId: string) {
    return cdpHandlersByConversationId.get(conversationId) ?? null;
}

/**
 * Gets or creates the CdpHandler for the given conversation.
 *
 * @param {string} conversationId
 * @param {HTMLIFrameElement} iframe - Sandbox iframe
 * @param {Object} deps - optional deps for the handler
 * @returns {CdpHandler}
 */
export function getOrCreateCdpHandler(conversationId: string, iframe: HTMLIFrameElement, deps) {
    let handler = cdpHandlersByConversationId.get(conversationId);
    if (!handler) {
        handler = new CdpHandler(iframe, deps);
        cdpHandlersByConversationId.set(conversationId, handler);
    }
    return handler;
}

/**
 * Cleans up and removes the CdpHandler for the given conversation. Call when a conversation is deleted.
 * @param {string} conversationId
 */
export function clearCdpHandlerForConversation(conversationId: string) {
    const handler = cdpHandlersByConversationId.get(conversationId);
    if (handler) {
        handler.cleanup();
        cdpHandlersByConversationId.delete(conversationId);
    }
}

function createSandboxIframe() {
    const iframe = document.createElement('iframe');
    iframe.src =
        typeof chrome !== 'undefined' && chrome.runtime?.getURL
            ? chrome.runtime.getURL('views/sandbox.html')
            : '/views/sandbox.html';
    iframe.style.display = 'none';
    iframe.title = 'Eval Sandbox';
    return iframe;
}

function waitForIframeLoad(iframe: HTMLIFrameElement) {
    return new Promise((resolve, reject) => {
        if (!iframe) {
            reject(new Error('Iframe not created'));
            return;
        }
        iframe.onload = () => resolve();
        iframe.onerror = () => reject(new Error('Iframe load error'));
    });
}

/**
 * Lightweight sandbox test utility: creates the sandbox iframe, waits for SANDBOX_READY,
 * executes code with EVAL_REQUEST, returns the raw EVAL_RESULT payload, and removes the iframe.
 *
 * Useful for quickly validating sandbox output/log capture behavior without conversation wiring.
 *
 * @param {{
 *   code: string,
 *   timeoutMs?: number,
 *   readyTimeoutMs?: number,
 *   keepIframe?: boolean,
 * }} options
 * @returns {Promise<{ output: string, hasError: boolean, images: string[], aborted: boolean }>}
 */
export async function runSandboxEvalSmokeTest(options) {
    const { code, timeoutMs = 20_000, readyTimeoutMs = 5_000, keepIframe = false } = options ?? {};

    if (typeof code !== 'string' || !code.trim()) {
        throw new Error('runSandboxEvalSmokeTest requires a non-empty `code` string');
    }
    const handler = await ensureCdpHandlerInitialized('xxxxx', null);
    const res = await handler.execInSandbox(code, timeoutMs);
    console.log('### runSandboxEvalSmokeTest result', { res });
    return res;
}

if (typeof window !== 'undefined') {
    window.runSandboxEvalSmokeTest = runSandboxEvalSmokeTest;
}

/**
 * Ensures a CdpHandler exists for the given conversation: if not, creates sandbox iframe, appends to parent,
 * creates CdpHandler for this conversation, and waits for sandbox ready. No-op if handler already exists or if
 * no parent element was set via setSandboxParentElement().
 *
 * @param {string} conversationId
 * @param {Object} deps - optional deps for the handler
 * @returns {Promise<CdpHandler | null>}
 */
export async function ensureCdpHandlerInitialized(conversationId: string, deps) {
    if (getCdpHandlerForConversation(conversationId)) {
        return cdpHandlersByConversationId.get(conversationId);
    }
    const iframe = createSandboxIframe();
    document.body.appendChild(iframe);
    await waitForIframeLoad(iframe);
    const handler = getOrCreateCdpHandler(conversationId, iframe, deps);
    await handler.waitForSandboxReady();
    return handler;
}

export class CdpHandler {
    static GLOW_ELEMENT_ID = 'redo-active-glow';

    iframe: HTMLIFrameElement | null;
    deps: any;

    attachedTabId = null;
    webpEncodingSupported = null;

    pending = new Map();

    tabTargetInfo = {
        targetId: 'tabTargetId',
        type: 'tab',
        title: 'tab',
        url: 'about:blank',
        attached: false,
        canAccessOpener: false,
    };

    pageTargetInfo = {
        targetId: 'pageTargetId',
        type: 'page',
        title: 'page',
        url: 'about:blank',
        attached: false,
        canAccessOpener: false,
    };

    boundHandleSandboxMessage;
    boundHandleCdpEvent;
    boundHandleCdpDetach;

    glowScriptId = null;
    glowPingTimer = null;

    constructor(iframe: HTMLIFrameElement, deps) {
        this.iframe = iframe;
        this.deps = deps;

        this.boundHandleSandboxMessage = this.handleSandboxMessage.bind(this);
        this.boundHandleCdpEvent = this.handleCdpEvent.bind(this);
        this.boundHandleCdpDetach = this.handleCdpDetach.bind(this);

        window.addEventListener('message', this.boundHandleSandboxMessage);
        chrome.debugger.onEvent.addListener(this.boundHandleCdpEvent);
        chrome.debugger.onDetach.addListener(this.boundHandleCdpDetach);
    }

    getAttachedTabId() {
        return this.attachedTabId;
    }

    getSandboxWindow() {
        return this.iframe?.contentWindow ?? null;
    }

    postToSandbox(message) {
        this.getSandboxWindow()?.postMessage(message, '*');
    }

    cleanup() {
        window.removeEventListener('message', this.boundHandleSandboxMessage);
        chrome.debugger.onEvent.removeListener(this.boundHandleCdpEvent);
        chrome.debugger.onDetach.removeListener(this.boundHandleCdpDetach);

        for (const [id, pending] of this.pending) {
            clearTimeout(pending.timer);
            pending.reject(new Error('CdpHandler destroyed'));
            this.pending.delete(id);
        }

        if (this.attachedTabId) {
            const tabId = this.attachedTabId;
            this.attachedTabId = null;
            this.stopGlowHeartbeat();

            this.removeGlowEffect(tabId).finally(() => {
                chrome.debugger.detach({ tabId }).catch(() => {});
            });
        }

        if (this.iframe && this.iframe.parentNode) {
            this.iframe.parentNode.removeChild(this.iframe);
        }
        this.iframe = null;
        this.deps = null;
    }

    detachDebugger() {
        LOGGER.log('detachDebugger called, attachedTabId:', this.attachedTabId);

        if (!this.attachedTabId) return;

        const tabId = this.attachedTabId;
        this.attachedTabId = null;
        this.stopGlowHeartbeat();

            LOGGER.log('Sending CDP_CLOSE to sandbox for tab:', tabId);
            this.postToSandbox({ type: 'CDP_CLOSE', tabId, reason: 'Debugger detached by cleanup' });

        this.removeGlowEffect(tabId)
            .finally(() => chrome.debugger.detach({ tabId }))
            .then(() => LOGGER.log('Debugger detached successfully from tab:', tabId))
            .catch(error => LOGGER.log('Debugger detach error:', error));
    }

    execInSandbox(code: string, timeoutMs?: number) {
        return new Promise((resolve, reject) => {
            const id = crypto.randomUUID();
            LOGGER.log('execInSandbox called, id:', id, 'timeout:', timeoutMs);

            const timeout = timeoutMs ?? 30000;
            const timer = setTimeout(() => {
                if (!this.pending.has(id)) return;
                LOGGER.log('execInSandbox timeout, id:', id);
                // The sandbox only supports one in-flight eval at a time, so a global abort is safe here.
                this.postToSandbox({ type: 'ABORT' });
                this.pending.delete(id);
                reject(new Error('Execution timeout'));
            }, timeout + 1000);

            this.pending.set(id, {
                resolve: value => {
                    LOGGER.log('execInSandbox resolved, id:', id);
                    clearTimeout(timer);
                    resolve(value);
                },
                reject: error => {
                    clearTimeout(timer);
                    reject(error);
                },
                timer,
            });

            LOGGER.log(
                '[CdpHandler] Posting EVAL_REQUEST to sandbox, iframe:',
                !!this.iframe,
                'contentWindow:',
                !!this.getSandboxWindow()
            );

            this.postToSandbox({ type: 'EVAL_REQUEST', id, code, timeout });
        });
    }

    abortExecution() {
        LOGGER.log('abortExecution called, pending requests:', this.pending.size);
        this.postToSandbox({ type: 'ABORT' });

        for (const [id, pending] of this.pending) {
            LOGGER.log('Aborting eval request:', id);
            clearTimeout(pending.timer);
            pending.reject(new DOMException('Execution aborted by user', 'AbortError'));
        }

        this.pending.clear();
    }

    waitForSandboxReady() {
        return new Promise((resolve, reject) => {
            LOGGER.log('waitForSandboxReady called');

            const timer = window.setTimeout(() => {
                window.removeEventListener('message', handler);
                reject(new Error('Sandbox ready timeout'));
            }, 10_000);

            const handler = event => {
                LOGGER.log(
                    '[CdpHandler] Received message:',
                    event.data?.type,
                    'from:',
                    event.source === this.getSandboxWindow() ? 'sandbox' : 'other'
                );

                if (event.data?.type !== 'SANDBOX_READY') return;

                LOGGER.log('SANDBOX_READY received, resolving');
                window.clearTimeout(timer);
                window.removeEventListener('message', handler);
                resolve();
            };

            window.addEventListener('message', handler);

            LOGGER.log(
                '[CdpHandler] Sending SANDBOX_PING, iframe:',
                !!this.iframe,
                'contentWindow:',
                !!this.getSandboxWindow()
            );

            this.postToSandbox({ type: 'SANDBOX_PING' });
        });
    }

    getGlowInjectionScript() {
        const glowId = CdpHandler.GLOW_ELEMENT_ID;

        return `
      (function() {
        if (window.self !== window.top) return;
        if (document.getElementById('${glowId}')) return;

        function removeGlow() {
          const overlay = document.getElementById('${glowId}');
          const style = document.getElementById('${glowId}-style');
          if (overlay) overlay.remove();
          if (style) style.remove();

          const state = window.__redoGlowState;
          if (state?.monitor) clearInterval(state.monitor);
          if (window.__redoGlowState) delete window.__redoGlowState;
          if (window.__redoGlowPing) delete window.__redoGlowPing;
        }

        function inject() {
          if (document.getElementById('${glowId}')) return;

          const state = (window.__redoGlowState ||= {
            lastPing: Date.now(),
            monitor: null,
          });
          state.lastPing = Date.now();

          const style = document.createElement('style');
          style.id = '${glowId}-style';
          style.textContent = \`
            @keyframes redo-glow {
              0%, 100% { opacity: 0.6; }
              50% { opacity: 1; }
            }
          \`;

          const overlay = document.createElement('div');
          overlay.id = '${glowId}';
          overlay.style.cssText = \`
            position: fixed !important;
            inset: 0 !important;
            pointer-events: none !important;
            z-index: 2147483647 !important;
            border: none !important;
            box-shadow:
              inset 0 0 60px 20px rgba(99, 102, 241, 0.4),
              inset 0 0 100px 40px rgba(99, 102, 241, 0.2),
              inset 0 0 140px 60px rgba(99, 102, 241, 0.1) !important;
            animation: redo-glow 3s ease-in-out infinite !important;
          \`;

          document.documentElement.appendChild(style);
          document.documentElement.appendChild(overlay);

          if (!state.monitor) {
            state.monitor = setInterval(() => {
              if (Date.now() - state.lastPing > 10000) removeGlow();
            }, 2000);
          }

          window.__redoGlowPing = () => {
            if (window.__redoGlowState) window.__redoGlowState.lastPing = Date.now();
          };
        }

        if (document.documentElement) inject();
        else document.addEventListener('DOMContentLoaded', inject);
      })();
    `;
    }

    async injectGlowEffect(tabId) {
        const script = this.getGlowInjectionScript();

        try {
            await chrome.debugger.sendCommand({ tabId }, 'Page.enable');
            const added = await chrome.debugger.sendCommand(
                { tabId },
                'Page.addScriptToEvaluateOnNewDocument',
                { source: script }
            );

            this.glowScriptId = added.identifier;
            LOGGER.log('Glow script registered with id:', this.glowScriptId);

            await chrome.debugger.sendCommand({ tabId }, 'Runtime.evaluate', {
                expression: script,
            });
            LOGGER.log('Glow effect injected for tab:', tabId);

            this.startGlowHeartbeat(tabId);
        } catch (error) {
            LOGGER.log('Failed to inject glow effect:', error);
        }
    }

    async removeGlowEffect(tabId) {
        try {
            this.stopGlowHeartbeat();

            if (this.glowScriptId) {
                await chrome.debugger.sendCommand(
                    { tabId },
                    'Page.removeScriptToEvaluateOnNewDocument',
                    { identifier: this.glowScriptId }
                );
                this.glowScriptId = null;
            }

            const glowId = CdpHandler.GLOW_ELEMENT_ID;
            const removeScript = `
        (function() {
          const overlay = document.getElementById('${glowId}');
          const style = document.getElementById('${glowId}-style');
          if (overlay) overlay.remove();
          if (style) style.remove();
          if (window.__redoGlowState?.monitor) clearInterval(window.__redoGlowState.monitor);
          if (window.__redoGlowState) delete window.__redoGlowState;
          if (window.__redoGlowPing) delete window.__redoGlowPing;
        })();
      `;

            await chrome.debugger.sendCommand({ tabId }, 'Runtime.evaluate', {
                expression: removeScript,
            });
            LOGGER.log('Glow effect removed for tab:', tabId);
        } catch (error) {
            LOGGER.log('Failed to remove glow effect:', error);
        }
    }

    startGlowHeartbeat(tabId) {
        this.stopGlowHeartbeat();

        const ping = async () => {
            if (this.attachedTabId !== tabId) {
                this.stopGlowHeartbeat();
                return;
            }

            try {
                await chrome.debugger.sendCommand({ tabId }, 'Runtime.evaluate', {
                    expression: 'window.__redoGlowPing && window.__redoGlowPing()',
                });
            } catch (error) {
                LOGGER.log('Glow heartbeat stopped:', error);
                this.stopGlowHeartbeat();
            }
        };

        ping();
        this.glowPingTimer = setInterval(ping, 3000);
    }

    stopGlowHeartbeat() {
        if (!this.glowPingTimer) return;
        clearInterval(this.glowPingTimer);
        this.glowPingTimer = null;
    }

    async handleSandboxMessage(event) {
        const message = event.data;
        const supportedTypes = [
            'CDP_REQUEST',
            'CDP_ATTACH',
            'CDP_DETACH',
            'LIST_TABS_REQUEST',
            'CREATE_TAB_REQUEST',
            'CLOSE_TAB_REQUEST',
            'ACTIVATE_TAB_REQUEST',
            'EVAL_RESULT',
            'SANDBOX_READY',
            'FS_READ_REQUEST',
            'FS_WRITE_REQUEST',
            'FS_LIST_REQUEST',
            'FS_DELETE_REQUEST',
            'FS_MKDIR_REQUEST',
            'FS_EXISTS_REQUEST',
            'FS_STAT_REQUEST',
            'BASH_REQUEST',
            'WORKSPACE_REQUEST',
        ];

        if (!message?.type || !supportedTypes.includes(message.type)) return;

        LOGGER.log('handleSandboxMessage:', message.type);

        if (message.type === 'CDP_REQUEST') {
            const tabId = message.tabId ?? this.attachedTabId;
            const response = await this.handleCdpCommand(message.payload, tabId);
            this.postToSandbox({ type: 'CDP_RESPONSE', tabId, payload: response });
            return;
        }

        if (message.type === 'CDP_ATTACH') {
            try {
                const attached = await this.handleCdpAttach(message.tabId);
                this.postToSandbox({
                    type: 'CDP_ATTACH_RESPONSE',
                    id: message.id,
                    success: true,
                    tabId: attached.tabId,
                });
            } catch (error) {
                this.postToSandbox({
                    type: 'CDP_ATTACH_RESPONSE',
                    id: message.id,
                    success: false,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
            return;
        }

        if (message.type === 'CDP_DETACH') {
            const tabId = message.tabId ?? this.attachedTabId;
            if (!tabId) return;

            await chrome.debugger.detach({ tabId }).catch(() => {});
            if (this.attachedTabId === tabId) this.attachedTabId = null;
            return;
        }

        if (message.type === 'LIST_TABS_REQUEST') {
            await this.handleListTabsRequest(message.id);
            return;
        }

        if (message.type === 'CREATE_TAB_REQUEST') {
            await this.handleCreateTabRequest(message.id, message.url);
            return;
        }

        if (message.type === 'CLOSE_TAB_REQUEST') {
            await this.handleCloseTabRequest(message.id, message.tabId);
            return;
        }

        if (message.type === 'ACTIVATE_TAB_REQUEST') {
            await this.handleActivateTabRequest(message.id, message.tabId);
            return;
        }

        if (message.type === 'EVAL_RESULT') {
            await this.handleEvalResult(message);
            return;
        }

        const FS_TYPES = [
            'FS_READ_REQUEST',
            'FS_WRITE_REQUEST',
            'FS_LIST_REQUEST',
            'FS_DELETE_REQUEST',
            'FS_MKDIR_REQUEST',
            'FS_EXISTS_REQUEST',
            'FS_STAT_REQUEST',
        ];
        if (FS_TYPES.includes(message.type) || message.type === 'BASH_REQUEST') {
            await this.handleFsOrBashRequest(message);
            return;
        }

        if (message.type === 'WORKSPACE_REQUEST') {
            await this.handleWorkspaceRequest(message);
            return;
        }
    }

    handleCdpEvent(source, method, params) {
        if (source.tabId !== this.attachedTabId) return;

        this.postToSandbox({
            type: 'CDP_EVENT',
            tabId: source.tabId,
            payload: {
                sessionId: source.sessionId ?? 'pageTargetSessionId',
                method,
                params,
            },
        });
    }

    handleCdpDetach(source) {
        LOGGER.log(
            '[CdpHandler] handleCdpDetach called, source.tabId:',
            source.tabId,
            'attachedTabId:',
            this.attachedTabId
        );

        if (source.tabId !== this.attachedTabId) {
            LOGGER.log('handleCdpDetach: tabId mismatch, not sending CDP_CLOSE');
            return;
        }

        this.stopGlowHeartbeat();
        const tabId = this.attachedTabId;
        this.attachedTabId = null;

        LOGGER.log('Sending CDP_CLOSE from handleCdpDetach for tab:', tabId);
        this.postToSandbox({ type: 'CDP_CLOSE', tabId, reason: 'Debugger detached' });
    }

    async handleCdpAttach(tabId) {
        LOGGER.log('handleCdpAttach called, tabId:', tabId);

        const targetTabId =
            tabId ?? (await chrome.tabs.query({ active: true, currentWindow: true }))[0]?.id;

        if (!targetTabId) {
            LOGGER.log('handleCdpAttach: No active tab');
            throw new Error('No active tab');
        }

        LOGGER.log(
            '[CdpHandler] handleCdpAttach targetTabId:',
            targetTabId,
            'attachedTabId:',
            this.attachedTabId
        );

        if (this.attachedTabId !== targetTabId) {
            if (this.attachedTabId) {
                LOGGER.log('Detaching from previous tab:', this.attachedTabId);
                await this.removeGlowEffect(this.attachedTabId);
                await chrome.debugger.detach({ tabId: this.attachedTabId }).catch(() => {});
            }

            LOGGER.log('Attaching to tab:', targetTabId);
            await chrome.debugger.attach({ tabId: targetTabId }, '1.3');
            LOGGER.log('Attached successfully');

            this.attachedTabId = targetTabId;
            await this.injectGlowEffect(targetTabId);
        }

        return { tabId: targetTabId };
    }

    dispatchCdpResponse(tabId, payload) {
        this.postToSandbox({ type: 'CDP_RESPONSE', tabId, payload });
    }

    dispatchCdpEvent(tabId, payload) {
        this.postToSandbox({ type: 'CDP_EVENT', tabId, payload });
    }

    async handleCdpCommand(command, tabId) {
        LOGGER.log(
            '[CdpHandler] handleCdpCommand:',
            command?.method,
            'sessionId:',
            command?.sessionId,
            'tabId:',
            tabId
        );

        switch (command?.method) {
            case 'Browser.getVersion':
                return {
                    id: command.id,
                    sessionId: command.sessionId,
                    result: {
                        protocolVersion: '1.3',
                        product: 'chrome',
                        revision: 'unknown',
                        userAgent: navigator.userAgent,
                        jsVersion: 'unknown',
                    },
                };

            case 'Target.getBrowserContexts':
                return {
                    id: command.id,
                    sessionId: command.sessionId,
                    result: { browserContextIds: [] },
                };

            case 'Target.setDiscoverTargets':
                setTimeout(() => {
                    this.dispatchCdpEvent(tabId, {
                        method: 'Target.targetCreated',
                        params: { targetInfo: this.tabTargetInfo },
                    });
                    this.dispatchCdpEvent(tabId, {
                        method: 'Target.targetCreated',
                        params: { targetInfo: this.pageTargetInfo },
                    });
                }, 0);
                return { id: command.id, sessionId: command.sessionId, result: {} };

            case 'Target.setAutoAttach': {
                if (command.sessionId === 'tabTargetSessionId') {
                    setTimeout(() => {
                        this.dispatchCdpEvent(tabId, {
                            method: 'Target.attachedToTarget',
                            sessionId: 'tabTargetSessionId',
                            params: {
                                targetInfo: this.pageTargetInfo,
                                sessionId: 'pageTargetSessionId',
                            },
                        });
                    }, 0);
                    return { id: command.id, sessionId: command.sessionId, result: {} };
                }

                if (!command.sessionId) {
                    setTimeout(() => {
                        this.dispatchCdpEvent(tabId, {
                            method: 'Target.attachedToTarget',
                            params: {
                                targetInfo: this.tabTargetInfo,
                                sessionId: 'tabTargetSessionId',
                            },
                        });
                    }, 0);
                    return { id: command.id, sessionId: command.sessionId, result: {} };
                }
                break;
            }
        }

        if (!this.attachedTabId) {
            try {
                await this.handleCdpAttach(tabId ?? undefined);
            } catch (error) {
                return {
                    id: command.id,
                    sessionId: command.sessionId,
                    error: { message: error instanceof Error ? error.message : String(error) },
                };
            }
        }

        const sessionId =
            command.sessionId === 'pageTargetSessionId' ? undefined : command.sessionId;
        const target = { tabId: this.attachedTabId, sessionId };

        try {
            const result = await chrome.debugger.sendCommand(
                target,
                command.method,
                command.params
            );
            return {
                id: command.id,
                sessionId: command.sessionId ?? 'pageTargetSessionId',
                result,
            };
        } catch (error) {
            const err = error;
            return {
                id: command.id,
                sessionId: command.sessionId ?? 'pageTargetSessionId',
                error: {
                    code: err?.code,
                    data: err?.data,
                    message: err?.message ?? 'CDP error had no message',
                },
            };
        }
    }

    async handleListTabsRequest(id) {
        try {
            const tabs = (await chrome.tabs.query({ currentWindow: true })).map(tab => ({
                id: tab.id,
                title: tab.title,
                url: tab.url,
                active: tab.active,
            }));

            this.postToSandbox({ type: 'LIST_TABS_RESPONSE', id, success: true, tabs });
        } catch (error) {
            this.postToSandbox({
                type: 'LIST_TABS_RESPONSE',
                id,
                success: false,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    async handleCreateTabRequest(id, url) {
        try {
            const created = await chrome.tabs.create({ url: url || 'about:blank', active: false });

            this.postToSandbox({
                type: 'CREATE_TAB_RESPONSE',
                id,
                success: true,
                tab: {
                    id: created.id,
                    title: created.title || '',
                    url: created.url || url || 'about:blank',
                    active: created.active ?? false,
                },
            });
        } catch (error) {
            this.postToSandbox({
                type: 'CREATE_TAB_RESPONSE',
                id,
                success: false,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    async handleCloseTabRequest(id, tabId) {
        try {
            if (this.attachedTabId === tabId) {
                await chrome.debugger.detach({ tabId }).catch(() => {});
                this.attachedTabId = null;
                this.postToSandbox({ type: 'CDP_CLOSE', tabId, reason: 'Tab closed by closeTab()' });
            }

            await chrome.tabs.remove(tabId);
            this.postToSandbox({ type: 'CLOSE_TAB_RESPONSE', id, success: true });
        } catch (error) {
            this.postToSandbox({
                type: 'CLOSE_TAB_RESPONSE',
                id,
                success: false,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    async handleActivateTabRequest(id, tabId) {
        try {
            await chrome.tabs.update(tabId, { active: true });
            this.postToSandbox({ type: 'ACTIVATE_TAB_RESPONSE', id, success: true });
        } catch (error) {
            this.postToSandbox({
                type: 'ACTIVATE_TAB_RESPONSE',
                id,
                success: false,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    async handleEvalResult(message) {
        LOGGER.log('### [CdpHandler] handleEvalResult', {message});
        const pending = this.pending.get(message.id);
        if (!pending) return;

        this.pending.delete(message.id);

        const images = message.images ?? [];
        const encoded = await this.encodeImagesAsWebp(images);

        pending.resolve({
            output: message.output,
            hasError: message.hasError,
            images: encoded,
            aborted: message.aborted,
        });
    }

    async handleFsOrBashRequest(message) {
        LOGGER.log('### [CdpHandler] handleFsOrBashRequest', message.type);
        const responseType = message.type.replace('_REQUEST', '_RESPONSE');
        const respond = (payload) => {
            this.postToSandbox({ ...payload, type: responseType, id: message.id });
        };

        try {
            const bash = this.deps?.getBashInstance?.();
            if (!bash || typeof bash.exec !== 'function') {
                respond({ success: false, error: 'Filesystem unavailable' });
                return;
            }

            const quoteShell = (value) => {
                const text = String(value ?? '');
                return `'${text.replace(/'/g, `'\\''`)}'`;
            };

            const run = async (command) => {
                const res = await bash.exec(command);
                if (res?.exitCode !== 0) {
                    const stderr = res?.stderr ? String(res.stderr).trim() : '';
                    const stdout = res?.stdout ? String(res.stdout).trim() : '';
                    throw new Error(stderr || stdout || `Command failed with exit code ${res?.exitCode}`);
                }
                return res;
            };

            switch (message.type) {
                case 'FS_READ_REQUEST': {
                    const res = await run(`cat -- ${quoteShell(message.path)}`);
                    respond({ success: true, content: res.stdout ?? '' });
                    return;
                }
                case 'FS_WRITE_REQUEST': {
                    const { path, content } = message;
                    const parentDir = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
                    if (parentDir) await run(`mkdir -p -- ${quoteShell(parentDir)}`);
                    const delimiter = `__FS_WRITE_${Date.now()}_${Math.random().toString(16).slice(2)}__`;
                    await run(`cat > ${quoteShell(path)} <<'${delimiter}'\n${content}\n${delimiter}`);
                    respond({ success: true });
                    return;
                }
                case 'FS_LIST_REQUEST': {
                    const res = await bash.exec(`ls -1a -- ${quoteShell(message.path)} 2>/dev/null`);
                    const entries = (res.stdout ?? '')
                        .split('\n')
                        .map(e => e.trim())
                        .filter(e => e && e !== '.' && e !== '..');
                    respond({ success: true, entries });
                    return;
                }
                case 'FS_DELETE_REQUEST': {
                    await run(`rm -rf -- ${quoteShell(message.path)}`);
                    respond({ success: true });
                    return;
                }
                case 'FS_MKDIR_REQUEST': {
                    await run(`mkdir -p -- ${quoteShell(message.path)}`);
                    respond({ success: true });
                    return;
                }
                case 'FS_EXISTS_REQUEST': {
                    const res = await bash.exec(
                        `test -e ${quoteShell(message.path)} && echo yes || echo no`
                    );
                    respond({ success: true, exists: (res.stdout ?? '').trim() === 'yes' });
                    return;
                }
                case 'FS_STAT_REQUEST': {
                    const res = await bash.exec(
                        `if [ -d ${quoteShell(message.path)} ]; then echo directory; elif [ -f ${quoteShell(message.path)} ]; then echo file; else echo none; fi`
                    );
                    const type = (res.stdout ?? '').trim();
                    if (type === 'none') {
                        respond({ success: false, error: `Path not found: ${message.path}` });
                        return;
                    }
                    respond({ success: true, stat: { type } });
                    return;
                }
                case 'BASH_REQUEST': {
                    const opts = message.cwd ? { cwd: message.cwd } : undefined;
                    const res = await bash.exec(message.command, opts);
                    respond({
                        success: true,
                        stdout: res?.stdout ?? '',
                        stderr: res?.stderr ?? '',
                        exitCode: res?.exitCode ?? 0,
                    });
                    return;
                }
                default: {
                    respond({ success: false, error: `Unsupported FS/bash operation: ${message.type}` });
                }
            }
        } catch (error) {
            respond({
                success: false,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    async handleWorkspaceRequest(message) {
        LOGGER.log('### [CdpHandler] handleWorkspaceRequest', message.operation);
        const respond = ({ success, result, error }) => {
            this.postToSandbox({
                type: 'WORKSPACE_RESPONSE',
                id: message.id,
                success: !!success,
                ...(success ? { result } : { error }),
            });
        };

        try {
            if (!message?.id) {
                throw new Error('Missing workspace request id');
            }

            if (message.type !== 'WORKSPACE_REQUEST') {
                throw new Error(`Unsupported request type: ${message.type}`);
            }

            const operation = message.operation;
            const input = message.input ?? {};
            const bash = this.deps?.getBashInstance?.();
            if (!bash || typeof bash.exec !== 'function') {
                throw new Error('Workspace is unavailable');
            }

            const quoteShell = value => {
                const text = String(value ?? '');
                return `'${text.replace(/'/g, `'\\''`)}'`;
            };

            const run = async command => {
                const res = await bash.exec(command);
                if (res?.exitCode !== 0) {
                    const stderr = res?.stderr ? String(res.stderr).trim() : '';
                    const stdout = res?.stdout ? String(res.stdout).trim() : '';
                    throw new Error(
                        stderr || stdout || `Command failed with exit code ${res?.exitCode}`
                    );
                }
                return res;
            };

            if (
                typeof operation === 'string' &&
                operation.startsWith('sheets.') &&
                operation !== 'sheets.requestAccess' &&
                !this.deps?.googleSheetEnabled
            ) {
                throw new Error('Google Sheets is not enabled. Please enable it in Settings → AI → Tools.');
            }

            switch (operation) {
                case 'status': {
                    const cwd = typeof bash.getCwd === 'function' ? bash.getCwd() : '/workspace';
                    respond({
                        success: true,
                        result: {
                            cwd,
                            available: true,
                        },
                    });
                    return;
                }
                case 'mkdir': {
                    const path = input?.path;
                    if (typeof path !== 'string' || !path.trim()) {
                        throw new Error('mkdir requires a non-empty string path');
                    }
                    await run(`mkdir -p -- ${quoteShell(path)}`);
                    respond({
                        success: true,
                        result: { path, created: true },
                    });
                    return;
                }
                case 'writeFile': {
                    const path = input?.path;
                    const content = input?.content;
                    if (typeof path !== 'string' || !path.trim()) {
                        throw new Error('writeFile requires a non-empty string path');
                    }
                    if (typeof content !== 'string') {
                        throw new Error('writeFile requires string content');
                    }

                    const parentDir = path.includes('/')
                        ? path.slice(0, path.lastIndexOf('/'))
                        : '';
                    if (parentDir) {
                        await run(`mkdir -p -- ${quoteShell(parentDir)}`);
                    }

                    const delimiter = `__WORKSPACE_WRITE_FILE_${Date.now()}_${Math.random()
                        .toString(16)
                        .slice(2)}__`;
                    const command = `cat > ${quoteShell(path)} <<'${delimiter}'\n${content}\n${delimiter}`;
                    await run(command);
                    respond({
                        success: true,
                        result: { path, bytes: content.length },
                    });
                    return;
                }
                case 'readFile': {
                    const path = input?.path;
                    if (typeof path !== 'string' || !path.trim()) {
                        throw new Error('readFile requires a non-empty string path');
                    }
                    const res = await bash.exec(`cat -- ${quoteShell(path)}`);
                    if (res?.exitCode !== 0) {
                        throw new Error(
                            (res?.stderr ? String(res.stderr).trim() : '') ||
                            `cat failed with exit code ${res?.exitCode}`
                        );
                    }
                    respond({ success: true, result: { content: res.stdout ?? '' } });
                    return;
                }
                case 'listFiles': {
                    const path = input?.path ?? '.';
                    const res = await bash.exec(`ls -1a -- ${quoteShell(path)} 2>/dev/null`);
                    const entries = (res.stdout ?? '')
                        .split('\n')
                        .map(e => e.trim())
                        .filter(e => e && e !== '.' && e !== '..');
                    respond({ success: true, result: { entries } });
                    return;
                }
                case 'deleteFile': {
                    const path = input?.path;
                    if (typeof path !== 'string' || !path.trim()) {
                        throw new Error('deleteFile requires a non-empty string path');
                    }
                    await run(`rm -rf -- ${quoteShell(path)}`);
                    respond({ success: true, result: { path, deleted: true } });
                    return;
                }
                case 'sheets.requestAccess': {
                    console.log('### [CdpHandler] sheets.requestAccess 1', this.deps?.googleSheetEnabled);
                    if (!this.deps?.googleSheetEnabled) {
                        respond({ success: true, result: { authorized: false } });
                        return;
                    }
                    try {
                        console.log('### [CdpHandler] sheets.requestAccess 2');
                        const token = await this._getGoogleAccessToken(false);
                        console.log('### [CdpHandler] sheets.requestAccess 3', token);
                        respond({ success: true, result: { authorized: !!token } });
                    } catch (error) {
                        console.log('### [CdpHandler] sheets.requestAccess 4', error);
                        console.log('### [CdpHandler] sheets.requestAccess 3');
                        respond({ success: true, result: { authorized: false } });
                    }
                    return;
                }
                case 'sheets.getSpreadsheet': {
                    const { spreadsheetId } = input;
                    if (!spreadsheetId) throw new Error('sheets.getSpreadsheet requires spreadsheetId');
                    const result = await this._googleSheetsRequest(
                        'GET',
                        `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}`
                    );
                    respond({ success: true, result });
                    return;
                }
                case 'sheets.listSheets': {
                    const { spreadsheetId } = input;
                    if (!spreadsheetId) throw new Error('sheets.listSheets requires spreadsheetId');
                    const data = await this._googleSheetsRequest(
                        'GET',
                        `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=sheets.properties`
                    );
                    const sheets = (data.sheets || []).map((s: any) => s.properties?.title).filter(Boolean);
                    respond({ success: true, result: { sheets } });
                    return;
                }
                case 'sheets.readRange': {
                    const { spreadsheetId, range } = input;
                    if (!spreadsheetId || !range) throw new Error('sheets.readRange requires spreadsheetId and range');
                    const result = await this._googleSheetsRequest(
                        'GET',
                        `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`
                    );
                    respond({ success: true, result });
                    return;
                }
                case 'sheets.batchRead': {
                    const { spreadsheetId, ranges } = input;
                    if (!spreadsheetId || !Array.isArray(ranges)) throw new Error('sheets.batchRead requires spreadsheetId and ranges array');
                    const params = ranges.map((r: string) => `ranges=${encodeURIComponent(r)}`).join('&');
                    const result = await this._googleSheetsRequest(
                        'GET',
                        `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values:batchGet?${params}`
                    );
                    respond({ success: true, result });
                    return;
                }
                case 'sheets.writeRange': {
                    const { spreadsheetId, range, values, valueInputOption = 'USER_ENTERED' } = input;
                    if (!spreadsheetId || !range || !values) throw new Error('sheets.writeRange requires spreadsheetId, range, and values');
                    const result = await this._googleSheetsRequest(
                        'PUT',
                        `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}?valueInputOption=${valueInputOption}`,
                        { range, values }
                    );
                    respond({ success: true, result });
                    return;
                }
                case 'sheets.batchWrite': {
                    const { spreadsheetId, data: writeData, valueInputOption = 'USER_ENTERED' } = input;
                    if (!spreadsheetId || !Array.isArray(writeData)) throw new Error('sheets.batchWrite requires spreadsheetId and data array');
                    const result = await this._googleSheetsRequest(
                        'POST',
                        `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values:batchUpdate`,
                        { valueInputOption, data: writeData }
                    );
                    respond({ success: true, result });
                    return;
                }
                case 'sheets.appendRows': {
                    const { spreadsheetId, range, values, valueInputOption = 'USER_ENTERED' } = input;
                    if (!spreadsheetId || !range || !values) throw new Error('sheets.appendRows requires spreadsheetId, range, and values');
                    const result = await this._googleSheetsRequest(
                        'POST',
                        `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}:append?valueInputOption=${valueInputOption}&insertDataOption=INSERT_ROWS`,
                        { values }
                    );
                    respond({ success: true, result });
                    return;
                }
                case 'sheets.clearRange': {
                    const { spreadsheetId, range } = input;
                    if (!spreadsheetId || !range) throw new Error('sheets.clearRange requires spreadsheetId and range');
                    const result = await this._googleSheetsRequest(
                        'POST',
                        `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}:clear`,
                        {}
                    );
                    respond({ success: true, result });
                    return;
                }
                case 'sheets.batchClear': {
                    const { spreadsheetId, ranges } = input;
                    if (!spreadsheetId || !Array.isArray(ranges)) throw new Error('sheets.batchClear requires spreadsheetId and ranges array');
                    const result = await this._googleSheetsRequest(
                        'POST',
                        `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values:batchClear`,
                        { ranges }
                    );
                    respond({ success: true, result });
                    return;
                }
                case 'sheets.createSpreadsheet': {
                    const { title, sheets: sheetDefs } = input;
                    const body: any = { properties: { title: title || 'Untitled' } };
                    if (Array.isArray(sheetDefs) && sheetDefs.length > 0) {
                        body.sheets = sheetDefs.map((name: string) => ({ properties: { title: name } }));
                    }
                    const result = await this._googleSheetsRequest('POST', 'https://sheets.googleapis.com/v4/spreadsheets', body);
                    respond({ success: true, result });
                    return;
                }
                case 'sheets.batchUpdate': {
                    const { spreadsheetId, requests } = input;
                    if (!spreadsheetId || !Array.isArray(requests)) throw new Error('sheets.batchUpdate requires spreadsheetId and requests array');
                    const result = await this._googleSheetsRequest(
                        'POST',
                        `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}:batchUpdate`,
                        { requests }
                    );
                    respond({ success: true, result });
                    return;
                }
                case 'sheets.setFormat': {
                    const { spreadsheetId, requests: formatRequests } = input;
                    if (!spreadsheetId || !Array.isArray(formatRequests)) throw new Error('sheets.setFormat requires spreadsheetId and requests array');
                    const result = await this._googleSheetsRequest(
                        'POST',
                        `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}:batchUpdate`,
                        { requests: formatRequests }
                    );
                    respond({ success: true, result });
                    return;
                }
                case 'brightdata.search': {
                    const { query, zone = 'serp_api1', country } = input;
                    if (!query || typeof query !== 'string') {
                        throw new Error('brightdata.search requires a non-empty string query');
                    }
                    const apiKey = this.deps?.brightDataApiKey;
                    if (!apiKey) {
                        throw new Error('Bright Data API key is not configured. Please add it in Settings > AI > Tools.');
                    }
                    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&hl=en${country ? `&gl=${country}` : ''}`;
                    const body: Record<string, unknown> = {
                        zone: typeof zone === 'string' ? zone : 'serp_api1',
                        url: searchUrl,
                        format: 'json',
                    };
                    if (country && typeof country === 'string') {
                        body.country = country;
                    }
                    const response = await fetch('https://api.brightdata.com/request', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${apiKey}`,
                        },
                        body: JSON.stringify(body),
                    });
                    if (!response.ok) {
                        const text = await response.text().catch(() => response.statusText);
                        throw new Error(`Bright Data API error ${response.status}: ${text}`);
                    }
                    const result = await response.json();
                    respond({ success: true, result });
                    return;
                }
                default:
                    throw new Error(`Unsupported workspace operation: ${String(operation)}`);
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            respond({ success: false, error: errorMessage });
        }
    }

    async _getGoogleAccessToken(interactive = false): Promise<string> {
        if (typeof chrome === 'undefined' || typeof chrome?.identity?.getAuthToken !== 'function') {
            throw new Error('Google sign-in is only available in the Chrome extension.');
        }
        return new Promise((resolve, reject) => {
            chrome.identity.getAuthToken({ interactive, scopes: GOOGLE_DRIVE_SCOPES }, token => {
                if (chrome.runtime.lastError || !token) {
                    reject(new Error(
                        chrome.runtime.lastError?.message ||
                        'Not authorized. Please connect to Google in Settings.'
                    ));
                } else {
                    resolve(token as string);
                }
            });
        });
    }

    async _googleSheetsRequest(method: string, url: string, body?: object): Promise<any> {
        const token = await this._getGoogleAccessToken(false);
        const init: RequestInit = {
            method,
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        };
        if (body !== undefined && method !== 'GET') {
            init.body = JSON.stringify(body);
        }
        const response = await fetch(url, init);
        if (response.status === 401) {
            // Token is expired or revoked — invalidate and surface a clear error
            await new Promise<void>(resolve => chrome.identity.removeCachedAuthToken({ token }, resolve));
            throw new Error('Google token expired. Please reconnect to Google in Settings.');
        }
        if (!response.ok) {
            const text = await response.text().catch(() => response.statusText);
            throw new Error(`Google Sheets API error ${response.status}: ${text}`);
        }
        return response.json();
    }

    async encodeImagesAsWebp(images) {
        if (images.length === 0) return [];
        if (this.webpEncodingSupported === false) return this.asPngImages(images);

        if (typeof document === 'undefined' || typeof Image === 'undefined') {
            this.webpEncodingSupported = false;
            return this.asPngImages(images);
        }

        const out = [];

        for (const pngBase64 of images) {
            const webpBase64 = await this.convertBase64PngToWebp(pngBase64);
            if (!webpBase64) {
                this.webpEncodingSupported = false;
                return this.asPngImages(images);
            }

            const pngBytes = this.base64ByteLength(pngBase64);
            const webpBytes = this.base64ByteLength(webpBase64);
            const pct = pngBytes > 0 ? ((webpBytes - pngBytes) / pngBytes) * 100 : 0;

            LOGGER.log(
                `[CdpHandler] logImage compress: png ${pngBytes} bytes -> webp ${webpBytes} bytes (${pct.toFixed(1)}%)`
            );

            out.push({ data: webpBase64, mediaType: 'image/webp' });
        }

        this.webpEncodingSupported = true;
        return out;
    }

    asPngImages(images) {
        return images.map(data => ({ data, mediaType: 'image/png' }));
    }

    async convertBase64PngToWebp(base64Png) {
        if (!base64Png) return null;

        try {
            const dataUrl = `data:image/png;base64,${base64Png}`;
            const img = new Image();
            img.decoding = 'async';

            const decoded = new Promise((resolve, reject) => {
                img.onload = () => resolve();
                img.onerror = () => reject(new Error('Failed to decode image'));
            });

            img.src = dataUrl;
            await decoded;

            const width = img.naturalWidth || img.width;
            const height = img.naturalHeight || img.height;
            if (!width || !height) return null;

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            if (!ctx) return null;

            ctx.drawImage(img, 0, 0);

            const webpDataUrl = canvas.toDataURL('image/webp', 0);
            const prefix = 'data:image/webp;base64,';
            return webpDataUrl.startsWith(prefix) ? webpDataUrl.slice(prefix.length) : null;
        } catch (error) {
            LOGGER.warn('Failed to encode image as webp:', error);
            return null;
        }
    }

    base64ByteLength(base64) {
        const match = base64.match(/=+$/);
        const padding = match ? match[0].length : 0;
        return Math.max(0, Math.floor((base64.length * 3) / 4 - padding));
    }
}
