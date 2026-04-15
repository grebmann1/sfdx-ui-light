import { LightningElement, api } from 'lwc';

const DEFAULT_MESSAGE = 'Loading...';
const MESSAGE_INTERVAL_MS = 3000;

export default class LoadingOverlay extends LightningElement {
    @api message = DEFAULT_MESSAGE;
    @api messages;
    /** 'dark' (default) | 'light' */
    @api variant = 'dark';

    currentMessage = DEFAULT_MESSAGE;

    get overlayClass() {
        return this.variant === 'light' ? 'overlay overlay-light' : 'overlay';
    }

    _interval;

    connectedCallback() {
        this.currentMessage = this.message || DEFAULT_MESSAGE;
        if (Array.isArray(this.messages) && this.messages.length > 0) {
            this._startCycle();
        }
    }

    disconnectedCallback() {
        this._stopCycle();
    }

    _startCycle() {
        let position = 0;
        this.currentMessage = this.messages[position];
        this._interval = setInterval(() => {
            position = position >= this.messages.length - 1 ? 0 : position + 1;
            this.currentMessage = this.messages[position];
        }, MESSAGE_INTERVAL_MS);
    }

    _stopCycle() {
        if (this._interval) {
            clearInterval(this._interval);
            this._interval = null;
        }
    }
}
