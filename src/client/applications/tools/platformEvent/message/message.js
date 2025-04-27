import { api, track, wire } from 'lwc';
import { decodeError, isNotUndefinedOrNull, classSet } from 'shared/utils';
import ToolkitElement from 'core/toolkitElement';
import moment from 'moment';

export default class Message extends ToolkitElement {
    isLoading = false;

    @api item;
    @api selectedItemId;

    _formattedReceivedDate;
    _interval;

    connectedCallback() {
        this.enableAutoDate();
    }

    disconnectedCallback() {
        clearInterval(this._interval);
    }

    /** Events **/

    handleItemSelection = e => {
        this.dispatchEvent(
            new CustomEvent('select', {
                detail: { value: this.item },
                bubbles: true,
                composed: true,
            })
        );
    };

    /** Methods  **/

    formatDate = () => {
        this._formattedReceivedDate = moment(this.item.receivedDate).fromNow();
    };

    enableAutoDate = () => {
        this.formatDate();
        this._interval = setInterval(() => {
            this.formatDate();
        }, 5000);
    };

    /** Getters */

    get itemClass() {
        return classSet(
            'slds-p-left_xx-small slds-p-vertical_xx-small slds-border_bottom item slds-grid'
        )
            .add({
                'slds-is-active': this.item.id == this.selectedItemId,
                'slds-is-new': !this.item.isRead,
            })
            .toString();
    }

    get id() {
        return this.item?.id || 'Dummy Id';
    }

    get formattedReceivedDate() {
        return this._formattedReceivedDate;
    }

    get replayId() {
        return this.item?.content?.data?.event?.replayId || '';
    }

    get eventUuid() {
        return this.item?.content?.data?.event?.EventUuid || '';
    }
}
