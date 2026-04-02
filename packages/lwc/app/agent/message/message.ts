import { api } from 'lwc';
import Toast from 'lightning/toast';
import { classSet, ROLES } from 'shared/utils';
import ToolkitElement from 'core/toolkitElement';
import LOGGER from 'shared/logger';

export default class Message extends ToolkitElement {
    @api item: any;
    @api isCurrentMessage = false;
    @api isReasoningStreaming = false;

    /** Methods **/

    /** Events **/

    handleDownload = async () => {
        const text = this.renderedTextForClipboard;
        navigator.clipboard.writeText(text);
        Toast.show({
            label: 'Message exported to your clipboard',
            variant: 'success',
        });
    };

    handleRetry = () => {
        const retryEvent = new CustomEvent('retry', { detail: { item: this.item } });
        this.dispatchEvent(retryEvent);
    };

    handleChange = () => {
        // No-op: markdown viewer may fire change; we display read-only and do not persist edits.
    };

    @api
    updateItem(message: any) {
        this.item = message;
    }

    renderedCallback() {
        // Keep lightweight; this component re-renders frequently during streaming.
    }

    /** Getters — role & type **/

    @api
    get isUser() {
        return this.item?.role === ROLES.USER;
    }

    get isNotUser() {
        return !this.isUser;
    }

    get isAssistant() {
        return this.item?.role === ROLES.ASSISTANT;
    }

    /** Getters — content **/

    get parts() {
        return this._normalizeParts(this.item);
    }

    get renderedParts() {
        const messageId = this.item?.id || this.item?.role || 'message';
        const rendered = [];
        const toolEntries = new Map();
        this.parts.forEach((part, idx) => {
            if (!part || typeof part !== 'object') return;
            const key = `${messageId}-${idx}-${part.type || 'part'}`;
            if (part.type === 'text') {
                const text = typeof part.text === 'string' ? part.text : '';
                rendered.push({ key, isText: true, text });
                return;
            }
            if (part.type === 'reasoning') {
                const text = typeof part.text === 'string' ? part.text : '';
                const state = typeof part.state === 'string' ? part.state : null;
                rendered.push({ key, isReasoning: true, text, state });
                return;
            }
            if (part.type === 'file') {
                const url = typeof part.url === 'string' ? part.url : '';
                const mediaType = typeof part.mediaType === 'string' ? part.mediaType : '';
                const filename = typeof part.filename === 'string' ? part.filename : '';
                rendered.push({
                    key,
                    isFile: true,
                    url,
                    mediaType,
                    filename,
                    isImage: typeof mediaType === 'string' && mediaType.startsWith('image/'),
                });
                return;
            }
            const type = typeof part.type === 'string' ? part.type : '';
            if (type === 'dynamic-tool' || type.startsWith('tool-') || type === 'tool-call' || type === 'tool-result') {
                const toolId =
                    part.toolCallId ||
                    part.callId ||
                    part.call_id ||
                    part.id ||
                    `${messageId}-tool-${idx}`;
                let entry = toolEntries.get(toolId);
                if (!entry) {
                    entry = {
                        key: `${messageId}-tool-${toolEntries.size}`,
                        isTool: true,
                        toolCall: null,
                        toolResult: null,
                        toolPart: null,
                    };
                    toolEntries.set(toolId, entry);
                    rendered.push(entry);
                }
                if (type === 'tool-call') {
                    entry.toolCall = part;
                } else if (type === 'tool-result') {
                    entry.toolResult = part;
                } else {
                    entry.toolPart = part;
                }
            }
        });
        return rendered.filter(Boolean);
    }

    get renderedTextForClipboard() {
        if (typeof this.item?.content === 'string') {
            return this.item.content.trim();
        }
        return this.parts
            .filter(p => p?.type === 'text' && typeof p.text === 'string')
            .map(p => p.text)
            .filter(Boolean)
            .join('\n')
            .trim();
    }

    get hasRenderableParts() {
        return this.renderedParts.length > 0;
    }

    get showAssistantEmptyFallback() {
        return this.isAssistant && !this.hasRenderableParts;
    }

    get originMessage() {
        return this.isUser ? 'You' : 'Assistant';
    }

    _normalizeParts(message) {
        if (typeof message === 'string') {
            return message.trim().length > 0 ? [{ type: 'text', text: message }] : [];
        }
        if (!message || typeof message !== 'object') return [];
        if (Array.isArray(message.parts)) return message.parts;
        const content = message.content;
        if (typeof content === 'string') {
            return content.trim().length > 0 ? [{ type: 'text', text: content }] : [];
        }
        if (Array.isArray(content)) {
            return content.map(part => {
                if (!part || typeof part !== 'object') return null;
                if (part.type === 'text' && typeof part.text === 'string') {
                    return { type: 'text', text: part.text };
                }
                if (part.type === 'reasoning') {
                    const text = typeof part.text === 'string' ? part.text : '';
                    const state = typeof part.state === 'string' ? part.state : null;
                    return { type: 'reasoning', text, state };
                }
                if (part.type === 'image' || part.type === 'file') {
                    return {
                        type: 'file',
                        url: part.url || part.dataUrl || '',
                        mediaType: part.mediaType || part.mimeType || '',
                        filename: part.filename || '',
                    };
                }
                return part;
            }).filter(Boolean);
        }
        return [];
    }

    /** Getters — CSS classes **/

    get itemClass() {
        return classSet('slds-chat-listitem ')
            .add({
                'slds-chat-listitem_outbound': this.isUser,
                'slds-chat-listitem_inbound': !this.isUser,
                'message-listitem-outbound': this.isUser,
            })
            .toString();
    }

    get itemMessageClass() {
        return classSet('slds-chat-message__text slds-flex-column')
            .add({
                'slds-chat-message__text_outbound': this.isUser,
                'slds-chat-message__text_inbound': !this.isUser,
                'message-bubble-outbound': this.isUser,
                'message-bubble-inbound': !this.isUser,
            })
            .toString();
    }
}
