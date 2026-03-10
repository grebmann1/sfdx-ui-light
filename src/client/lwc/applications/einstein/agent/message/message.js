import { api, track } from 'lwc';
import Toast from 'lightning/toast';
import { isEmpty, classSet, ROLES, safeParseJson } from 'shared/utils';
import ToolkitElement from 'core/toolkitElement';
import { Constants } from 'agent/utils';
import LOGGER from 'shared/logger';

export default class Message extends ToolkitElement {
    @api item;
    @api isCurrentMessage = false;
    @track showToolResponse = false;
    @track showToolParameters = false;
    @track reasoningExpanded = false;

    /** Methods **/

    /** Events **/

    handleDownload = async () => {
        navigator.clipboard.writeText(this.item.content);
        Toast.show({
            label: Constants.TOAST_CLIPBOARD_LABEL,
            variant: 'success',
        });
    };

    handleToggleToolResponse = () => {
        this.showToolResponse = !this.showToolResponse;
    };

    handleToggleToolParameters = () => {
        this.showToolParameters = !this.showToolParameters;
    };

    handleToggleReasoning = () => {
        this.reasoningExpanded = !this.reasoningExpanded;
    };

    handleRetry = () => {
        const retryEvent = new CustomEvent('retry', { detail: { item: this.item } });
        this.dispatchEvent(retryEvent);
    };

    handleChange = () => {
        // No-op: markdown viewer may fire change; we display read-only and do not persist edits.
    };

    @api
    updateItem(message) {
        this.item = message;
    }

    renderedCallback() {
        if (this.item?.role === ROLES.ASSISTANT) {
            const contentPreview =
                typeof this.item?.content === 'string'
                    ? this.item.content?.slice(0, 80)
                    : JSON.stringify(this.item?.content)?.slice(0, 80);
            LOGGER.debug('[agent-message] assistant message render', {
                id: this.item?.id,
                type: this.item?.type,
                contentPreview,
                hasDisplayableContent: this.hasDisplayableContent,
                showAssistantEmptyFallback: this.showAssistantEmptyFallback,
                hasRenderedContentFromList: this.hasRenderedContentFromList,
                contentListLength: (this.contentList || []).length,
                contentList:this.contentList
            });
        }
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

    get isTool() {
        const t = this.item?.type;
        return (
            t === Constants.MESSAGE_TYPE.FUNCTION_CALL_RESULT ||
            t === Constants.MESSAGE_TYPE.FUNCTION_CALL ||
            t === Constants.MESSAGE_TYPE.FUNCTION_CALL_PENDING
        );
    }

    get isToolCall() {
        const t = this.item?.type;
        return (
            t === Constants.MESSAGE_TYPE.FUNCTION_CALL ||
            t === Constants.MESSAGE_TYPE.FUNCTION_CALL_PENDING
        );
    }

    get isReasoning() {
        return this.item?.type === Constants.MESSAGE_TYPE.REASONING;
    }

    get reasoningHeaderLabel() {
        if (!this.isReasoning) return '';
        const sec = this.item?.durationSeconds;
        if (sec != null && sec >= 0) {
            return `${Constants.REASONING_LABEL_THOUGHT_FOR} ${sec}s`;
        }
        return Constants.REASONING_LABEL_THOUGHT_BRIEFLY;
    }

    get reasoningContent() {
        if (!this.isReasoning) return '';
        const c = this.item?.content;
        if (typeof c === 'string') return c;
        if (Array.isArray(c)) {
            return c
                .map(part => (part && typeof part.text === 'string' ? part.text : ''))
                .filter(Boolean)
                .join('\n\n');
        }
        return '';
    }

    get reasoningCaretIcon() {
        return this.reasoningExpanded ? 'utility:chevrondown' : 'utility:chevronright';
    }

    get isToolResult() {
        return this.item?.type === Constants.MESSAGE_TYPE.FUNCTION_CALL_RESULT;
    }

    get hasError() {
        return this.item?.hasError;
    }

    /** Getters — content **/

    get isRetryDisplayed() {
        return this.item?.isLastMessage && this.isUser && this.hasError;
    }

    get errorMessage() {
        return this.item?.errorMessage ? this.item.errorMessage : Constants.ERROR_MESSAGE_DEFAULT;
    }

    get content() {
        if (Array.isArray(this.item?.content)) {
            const first = this.item.content[0];
            return first && typeof first.text === 'string' ? first.text : '';
        }
        return typeof this.item?.content === 'string' ? this.item.content : '';
    }

    get hasDisplayableContent() {
        const c = this.content;
        if (typeof c === 'string' && c.trim().length > 0) return true;
        const list = this.contentList || [];
        return list.some(
            item =>
                (item.isInputText || item.isOutputText) &&
                typeof item.text === 'string' &&
                item.text.trim().length > 0
        );
    }

    get showAssistantEmptyFallback() {
        return this.isAssistant && !this.hasDisplayableContent;
    }

    get hasRenderedContentFromList() {
        const list = this.contentList || [];
        return list.some(
            i =>
                (i.isInputText || i.isOutputText) &&
                typeof i.text === 'string' &&
                i.text.trim().length > 0
        );
    }

    get showAssistantContentFallback() {
        const c = typeof this.content === 'string' ? this.content : '';
        return this.isAssistant && c.trim().length > 0 && !this.hasRenderedContentFromList;
    }

    get contentList() {
        // Normalize to an array so we never call .map on a non-array (e.g. object from API/cache)
        const raw = this.item?.content;
        const arr = Array.isArray(raw)
            ? raw
            : raw != null && typeof raw === 'object' && typeof raw.text === 'string'
              ? [raw]
              : typeof raw === 'string'
                ? [raw]
                : [];
        return arr.map((contentItem, idx) => {
            const text = typeof contentItem === 'string' ? contentItem : contentItem?.text;
            let type =
                typeof contentItem === 'string'
                    ? Constants.CONTENT_TYPE.INPUT_TEXT
                    : (contentItem?.type ?? Constants.CONTENT_TYPE.INPUT_TEXT);
            if (typeof type === 'string') type = type.toLowerCase().trim();
            if (type === 'text') type = Constants.CONTENT_TYPE.INPUT_TEXT;
            return {
                ...(typeof contentItem === 'object' && contentItem != null ? contentItem : {}),
                type,
                text: text ?? '',
                isInputText: type === Constants.CONTENT_TYPE.INPUT_TEXT,
                isOutputText: type === Constants.CONTENT_TYPE.OUTPUT_TEXT,
                isInputImage: type === Constants.CONTENT_TYPE.INPUT_IMAGE,
                isInputFile: type === Constants.CONTENT_TYPE.INPUT_FILE,
                key: (typeof contentItem === 'object' && contentItem?.id) || `${type}-${idx}`,
            };
        });
    }

    get originMessage() {
        return this.isUser ? 'You' : 'Assistant';
    }

    /** Getters — tool **/

    get tool_name() {
        return this.item?.name || '';
    }

    get tool_response() {
        return this.item?.output?.text || '';
    }

    get tool_parameters() {
        return this.item?.arguments || '';
    }

    get tool_responseFormatted() {
        const res = isEmpty(this.tool_response) ? '{}' : this.tool_response;
        return JSON.stringify(safeParseJson(res), null, 2);
    }

    get tool_parametersFormatted() {
        const res = isEmpty(this.tool_parameters) ? '{}' : this.tool_parameters;
        return JSON.stringify(safeParseJson(res), null, 2);
    }

    get tool_isRunning() {
        return (
            this.item?.type === Constants.MESSAGE_TYPE.FUNCTION_CALL && this.isCurrentMessage
        );
    }

    get tool_isFinished() {
        return !this.tool_isRunning;
    }

    get tool_message_title() {
        return this.tool_isRunning ? Constants.TOOL_RUNNING_TITLE : Constants.TOOL_FINISHED_TITLE;
    }

    get toolResponseButtonTitle() {
        return this.showToolResponse ? Constants.TOOL_RESPONSE_HIDE : Constants.TOOL_RESPONSE_SHOW;
    }

    get toolParametersButtonTitle() {
        return this.showToolParameters ? Constants.TOOL_PARAMS_HIDE : Constants.TOOL_PARAMS_SHOW;
    }

    get toolResponseButtonIcon() {
        return this.showToolResponse ? 'utility:hide' : 'utility:preview';
    }

    get toolParametersButtonIcon() {
        return this.showToolParameters ? 'utility:hide' : 'utility:preview';
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
                'message-bubble-error': this.hasError,
            })
            .toString();
    }
}
