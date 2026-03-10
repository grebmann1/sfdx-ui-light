import { LightningElement, api, track } from 'lwc';

import { Constants } from 'agent/utils';

export default class ReasoningIndicator extends LightningElement {
    _reasoningState = null;
    _timerId = null;
    @track _tick = 0;

    @api
    get reasoningState() {
        return this._reasoningState;
    }
    set reasoningState(val) {
        const prev = this._reasoningState;
        this._reasoningState = val;
        if (prev?.phase === 'thinking' && val?.phase !== 'thinking') {
            this._clearTimer();
        } else if (val?.phase === 'thinking') {
            this._startTimer();
        }
    }

    disconnectedCallback() {
        this._clearTimer();
    }

    _startTimer() {
        this._clearTimer();
        this._tick = 0;
        this._timerId = setInterval(() => {
            if (this._reasoningState?.phase !== 'thinking') {
                this._clearTimer();
                return;
            }
            this._tick += 1;
        }, 1000);
    }

    _clearTimer() {
        if (this._timerId) {
            clearInterval(this._timerId);
            this._timerId = null;
        }
    }

    get showThinking() {
        return this._reasoningState?.phase === 'thinking';
    }

    get showDone() {
        return this._reasoningState?.phase === 'done';
    }

    get displayedElapsedSeconds() {
        if (this._reasoningState?.phase !== 'thinking') return 0;
        const startedAt = this._reasoningState.startedAt;
        if (startedAt == null) return 0;
        void this._tick;
        return Math.floor((Date.now() - startedAt) / 1000);
    }

    get durationSeconds() {
        if (this._reasoningState?.phase !== 'done') return 0;
        return this._reasoningState.durationSeconds ?? 0;
    }

    get thinkingLabel() {
        return Constants.REASONING_LABEL_THINKING;
    }

    get thoughtForLabel() {
        return Constants.REASONING_LABEL_THOUGHT_FOR;
    }
}
