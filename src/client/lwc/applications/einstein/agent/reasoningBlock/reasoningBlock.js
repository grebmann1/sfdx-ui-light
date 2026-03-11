import { api, track, LightningElement } from 'lwc';
import { Constants } from 'agent/utils';

const TICK_MS = 1000;
const MAX_LIVE_SECONDS = 120;

export default class ReasoningBlock extends LightningElement {
    @api content = '';
    @api startedAt;
    @api endedAt;

    @track expanded = false;
    @track _liveElapsedSeconds = 0;

    _tickIntervalId = null;

    get messageDurationSeconds() {
        const start = this.startedAt != null ? Number(this.startedAt) : null;
        const end = this.endedAt != null ? Number(this.endedAt) : null;
        if (start != null && end != null && end >= start) {
            return Math.round((end - start) / 1000);
        }
        return null;
    }

    get displaySeconds() {
        const fixed = this.messageDurationSeconds;
        if (fixed != null && fixed >= 0) return fixed;
        return Math.min(this._liveElapsedSeconds, MAX_LIVE_SECONDS);
    }

    get headerLabel() {
        const hasEnded = this.endedAt != null;
        const sec = this.displaySeconds;

        if (!hasEnded) {
            const s = sec != null && sec >= 0 ? sec : 0;
            return `${Constants.REASONING_LABEL_THINKING} ${s}s`;
        }
        if (sec != null && sec >= 1) {
            return `${Constants.REASONING_LABEL_THOUGHT_FOR} ${sec}s`;
        }
        return Constants.REASONING_LABEL_THOUGHT_BRIEFLY;
    }

    connectedCallback() {
        this._startLiveCountIfNeeded();
    }

    renderedCallback() {
        this._startLiveCountIfNeeded();
    }

    disconnectedCallback() {
        this._stopLiveCount();
    }

    _startLiveCountIfNeeded() {
        if (this._tickIntervalId != null) return;
        const start = this.startedAt != null ? Number(this.startedAt) : null;
        const end = this.endedAt != null ? Number(this.endedAt) : null;
        if (start == null || end != null) return;
        this._tickIntervalId = setInterval(() => {
            if (this.endedAt != null) {
                this._stopLiveCount();
                return;
            }
            const startMs = Number(this.startedAt);
            if (!Number.isFinite(startMs)) return;
            const elapsed = Math.floor((Date.now() - startMs) / 1000);
            this._liveElapsedSeconds = Math.min(elapsed, MAX_LIVE_SECONDS);
            if (elapsed >= MAX_LIVE_SECONDS) {
                this._stopLiveCount();
            }
        }, TICK_MS);
    }

    _stopLiveCount() {
        if (this._tickIntervalId != null) {
            clearInterval(this._tickIntervalId);
            this._tickIntervalId = null;
        }
    }

    get caretIcon() {
        return this.expanded ? 'utility:chevrondown' : 'utility:chevronright';
    }

    get ariaLabel() {
        return this.headerLabel || 'Toggle reasoning';
    }

    handleToggle() {
        this.expanded = !this.expanded;
    }

    handleChange() {
        // No-op: markdown viewer may fire change; display is read-only.
    }
}
