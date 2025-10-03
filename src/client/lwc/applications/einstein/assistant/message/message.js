import {  api, track } from 'lwc';
import Toast from 'lightning/toast';
import { classSet, lowerCaseKey, ROLES, ASSISTANT as ASSISTANT_UTILS } from 'shared/utils';
import ToolkitElement from 'core/toolkitElement';
import { store, SELECTORS, EINSTEIN } from 'core/store';

export default class Message extends ToolkitElement {
    @api item;
    @api dialogId;

    connectedCallback() {}

    /** Methods **/

    formatTextFromEinstein = text => {
        // Mainly related to data issues coming from Apex
        return text.replaceAll('&#124;', '|');
    };

    /** Events **/

    handleChange = e => {
        e.stopPropagation();
        const value = e.detail.value;
        const { einstein } = store.getState();
        const einsteinState = SELECTORS.einstein.selectById(
            { einstein },
            lowerCaseKey(this.dialogId)
        );
        let data = [...einsteinState.data];
        const index = data.findIndex(x => x.id === this.item.id);
        if (index > -1) {
            data[index] = {
                ...data[index],
                content: value,
            };
            store.dispatch(
                EINSTEIN.reduxSlice.actions.updateMessage({
                    dialogId: this.dialogId,
                    alias: ASSISTANT_UTILS.GLOBAL_EINSTEIN,
                    data,
                })
            );
        }
    };

    handleEdit = () => {
        //this.dispatchEvent(new CustomEvent("edit", { detail:this.item,bubbles: true,composed: true }));
        const container = this.refs.container;
        if (container) {
            container.showEditor();
        }
    };

    handleRetry = () => {
        this.dispatchEvent(
            new CustomEvent('retry', { detail: this.item, bubbles: true, composed: true })
        );
    };

    handleDownload = async () => {
        navigator.clipboard.writeText(this.item.content);
        Toast.show({
            label: `Message exported to your clipboard`,
            variant: 'success',
        });
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

    get hasError() {
        return this.item?.hasError;
    }

    get isRetryDisplayed() {
        return this.item?.isLastMessage && this.isUser && this.hasError;
    }

    get originMessage() {
        return this.isUser ? 'You' : 'Assistant';
    }

    get body() {
        return this.formatTextFromEinstein(this.item?.content || '');
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
