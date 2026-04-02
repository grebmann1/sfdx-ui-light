import { api, track, LightningElement } from 'lwc';
import { Constants } from 'agent/utils';

const TICK_MS = 1000;
const MAX_LIVE_SECONDS = 120;

export default class ReasoningBlock extends LightningElement {
    @api content = '';
    @api startedAt: number | string | null | undefined;
    @api endedAt: number | string | null | undefined;
    @api isPulsing = false;
    @api state: string | undefined; // 'streaming' | 'done' (AI SDK UI reasoning part)

    @track expanded = false;
    @track _liveElapsedSeconds = 0;

    _tickIntervalId: ReturnType<typeof setInterval> | null = null;
    _internalStartedAt: number | null = null;
    _internalEndedAt: number | null = null;

    get messageDurationSeconds() {
        const start =
            this.startedAt != null
                ? Number(this.startedAt)
                : this._internalStartedAt != null
                  ? Number(this._internalStartedAt)
                  : null;
        const end =
            this.endedAt != null
                ? Number(this.endedAt)
                : this._internalEndedAt != null
                  ? Number(this._internalEndedAt)
                  : null;
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

    get _titleFromContent() {
        const text = typeof this.content === 'string' ? this.content : '';
        const match = text.match(/\*\*([^*]+)\*\*/);
        const title = match ? match[1].trim() : '';
        return title.length > 0 ? title : null;
    }

    get headerLabel() {
        const title = this._titleFromContent;
        if (title) return title;

        const text = typeof this.content === 'string' ? this.content.trim() : '';
        const isDone = typeof this.state === 'string' && this.state === 'done';
        if (isDone && !text) {
            return Constants.REASONING_LABEL_THOUGHT_BRIEFLY;
        }

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

    get isBriefThought() {
        return this.headerLabel === Constants.REASONING_LABEL_THOUGHT_BRIEFLY;
    }

    get notBriefThought() {
        return !this.isBriefThought;
    }

    get blockClass() {
        return 'reasoning-block';
    }

    get isRunning() {
        if (this.endedAt != null || this._internalEndedAt != null) return false;
        if (typeof this.state === 'string' && this.state === 'done') return false;
        return true;
    }

    get statusIconName() {
        return 'utility:einstein';
    }

    get statusIconClass() {
        return this.isRunning
            ? 'reasoning-status-icon reasoning-status-icon-spin'
            : 'reasoning-status-icon reasoning-status-icon-done';
    }

    get statusClass() {
        return this.isRunning ? 'reasoning-status reasoning-block-pulse' : 'reasoning-status';
    }

    connectedCallback() {
        this._ensureInternalTimestamps();
        this._startLiveCountIfNeeded();
    }

    renderedCallback() {
        this._ensureInternalTimestamps();
        this._startLiveCountIfNeeded();
    }

    disconnectedCallback() {
        this._stopLiveCount();
    }

    _startLiveCountIfNeeded() {
        if (this._tickIntervalId != null) return;
        const start =
            this.startedAt != null
                ? Number(this.startedAt)
                : this._internalStartedAt != null
                  ? Number(this._internalStartedAt)
                  : null;
        const end =
            this.endedAt != null
                ? Number(this.endedAt)
                : this._internalEndedAt != null
                  ? Number(this._internalEndedAt)
                  : null;
        if (start == null || end != null) return;
        this._tickIntervalId = setInterval(() => {
            if (!this.isRunning) {
                this._stopLiveCount();
                return;
            }
            const startMs =
                this.startedAt != null ? Number(this.startedAt) : Number(this._internalStartedAt);
            if (!Number.isFinite(startMs)) return;
            const elapsed = Math.floor((Date.now() - startMs) / 1000);
            this._liveElapsedSeconds = Math.min(elapsed, MAX_LIVE_SECONDS);
            if (elapsed >= MAX_LIVE_SECONDS) {
                this._stopLiveCount();
            }
        }, TICK_MS);
    }

    _ensureInternalTimestamps() {
        if (this._internalStartedAt == null && this.startedAt == null) {
            this._internalStartedAt = Date.now();
        }
        const shouldEnd =
            (typeof this.state === 'string' && this.state === 'done') || this.endedAt != null;
        if (shouldEnd && this._internalEndedAt == null && this.endedAt == null) {
            this._internalEndedAt = Date.now();
        }
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
        if (this.isBriefThought) return;
        this.expanded = !this.expanded;
    }

    handleChange() {
        // No-op: markdown viewer may fire change; display is read-only.
    }
}
