import { api, track } from 'lwc';
import Toast from 'lightning/toast';
import { isEmpty, classSet, ROLES,safeParseJson } from 'shared/utils';
import ToolkitElement from 'core/toolkitElement';
import { Constants } from 'agent/utils';

export default class Message extends ToolkitElement {
    @api item;
    @api isCurrentMessage = false;
    @track showToolResponse = false;
    @track showToolParameters = false;

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

    handleRetry = () => {
        const retryEvent = new CustomEvent('retry', { detail: { item: this.item } });
        this.dispatchEvent(retryEvent);
    };

    @api
    updateItem(message) {
        this.item = message;
    }

    /** Getters **/

    @api
    get isUser() {
        return this.item?.role === ROLES.USER;
    }

    get isNotUser(){
        return !this.isUser;
    }

    get isAssistant() {
        return this.item?.role === ROLES.ASSISTANT;
    }

    get isTool() {
        return ['function_call_result','function_call','function_call_pending'].includes(this.item?.type);
    }

    get isToolCall() {
        return ['function_call','function_call_pending'].includes(this.item?.type);
    }

    get isReasoning() {
        return ['reasoning'].includes(this.item?.type);
    }

    get isToolResult() {
        return this.item?.type === 'function_call_result';
    }

    get hasError() {
        return this.item?.hasError;
    }

    get isRetryDisplayed() {
        return this.item?.isLastMessage && this.isUser && this.hasError;
    }

    get errorMessage() {
        return this.item?.errorMessage ? this.item.errorMessage : Constants.ERROR_MESSAGE_DEFAULT;
    }

    get content() {
        return Array.isArray(this.item.content) ? this.item.content[0].text : this.item.content;
    }

    get contentList() {
        // Always return an array of content items, or an empty array
        if (Array.isArray(this.item?.content)) {
            return this.item.content.map((contentItem, idx) => ({
                ...contentItem,
                isInputText: contentItem.type === Constants.CONTENT_TYPE.INPUT_TEXT,
                isOutputText: contentItem.type === Constants.CONTENT_TYPE.OUTPUT_TEXT,
                isInputImage: contentItem.type === Constants.CONTENT_TYPE.INPUT_IMAGE,
                isInputFile: contentItem.type === Constants.CONTENT_TYPE.INPUT_FILE,
                key: contentItem.id || `${contentItem.type}-${idx}`
            }));
        } else if (this.item?.content) {
            // If it's a string, treat as a single input_text
            return [{
                type: Constants.CONTENT_TYPE.INPUT_TEXT,
                text: this.item.content,
                isInputText: true, 
                isOutputText: false, 
                isInputImage: false, 
                isInputFile: false, 
                key: 'input_text-0' 
            }];
        }
        return [];
    }

    isInputText(contentItem) {
        return contentItem.type === Constants.CONTENT_TYPE.INPUT_TEXT;
    }
    isOutputText(contentItem) {
        return contentItem.type === Constants.CONTENT_TYPE.OUTPUT_TEXT;
    }
    isInputImage(contentItem) {
        return contentItem.type === Constants.CONTENT_TYPE.INPUT_IMAGE;
    }
    isInputFile(contentItem) {
        return contentItem.type === Constants.CONTENT_TYPE.INPUT_FILE;
    }

    get originMessage() {
        return this.isUser ? 'You' : 'Assistant';
    }

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
        return this.item?.type === 'function_call' && this.isCurrentMessage;
    }

    get tool_isFinished() {
        return !this.tool_isRunning;
    }

    get tool_message_title() {
        return this.tool_isRunning ? Constants.TOOL_RUNNING_TITLE : Constants.TOOL_FINISHED_TITLE;
    }

    get toolResponseButtonTitle() {
        return this.showToolResponse ? Constants.TOOL_RESPONSE_HIDE : Constants.TOOL_RESPONSE_SHOW
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

    get itemClass() {
        return classSet('slds-chat-listitem ')
            .add({
                'slds-chat-listitem_outbound': this.isUser,
                'slds-chat-listitem_inbound': !this.isUser,
            })
            .toString();
    }

    get itemMessageClass() {
        return classSet('slds-chat-message__text slds-flex-column')
            .add({
                'slds-chat-message-error': this.hasError,
                'slds-chat-message__text_outbound': this.isUser,
                'slds-chat-message__text_inbound': !this.isUser,
            })
            .toString();
    }
}
