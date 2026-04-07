import { api, LightningElement } from 'lwc';

type ReasoningTier = 'none' | 'low' | 'medium' | 'high';

type ReasoningPreset = {
    value: ReasoningTier;
    short: string;
    bars: number;
};

const Event = Object.freeze({
    Change: 'change',
});

const HIDE_TOOLTIP_DELAY_MS = 100;

const PRESETS: ReadonlyArray<ReasoningPreset> = Object.freeze([
    { value: 'none', short: 'Off', bars: 0 },
    { value: 'low', short: 'Low', bars: 1 },
    { value: 'medium', short: 'Med', bars: 2 },
    { value: 'high', short: 'High', bars: 3 },
]);

export default class Reasoning extends LightningElement {
    @api disabled = false;

    _value: ReasoningTier = 'none';
    _tooltipPinned = false;
    _isHovered = false;
    _hideTimerId: ReturnType<typeof window.setTimeout> | null = null;

    _handleWindowMouseDown = (event: MouseEvent) => {
        if (!this.shouldShowTooltip) {
            return;
        }

        const target = event.target;
        if (!(target instanceof Node)) {
            return;
        }

        if (!this.template.host.contains(target)) {
            this.hideTooltip();
        }
    };

    connectedCallback() {
        window.addEventListener('mousedown', this._handleWindowMouseDown);
    }

    disconnectedCallback() {
        window.removeEventListener('mousedown', this._handleWindowMouseDown);
        this.clearHideTimer();
    }

    @api
    get value(): ReasoningTier {
        return this._value;
    }

    set value(value: string) {
        this._value = this.normalizeReasoning(value);
    }

    normalizeReasoning(value: string): ReasoningTier {
        if (typeof value !== 'string') {
            return 'none';
        }

        const normalized = value.trim().toLowerCase();
        if (!normalized || normalized === 'none' || normalized === 'off') {
            return 'none';
        }
        if (normalized === 'minimal' || normalized === 'low') {
            return 'low';
        }
        if (normalized === 'medium') {
            return 'medium';
        }
        return 'high';
    }

    get currentPreset(): ReasoningPreset {
        return PRESETS.find(item => item.value === this._value) ?? PRESETS[0];
    }

    get isActive(): boolean {
        return this._value !== 'none';
    }

    get shouldShowTooltip(): boolean {
        return this._tooltipPinned || this._isHovered;
    }

    get ariaLabel(): string {
        return `Thinking: ${this.currentPreset.short}`;
    }

    get buttonClass(): string {
        return `reasoning-button ${this.isActive ? 'reasoning-button_active' : 'reasoning-button_inactive'}`;
    }

    get tooltipClass(): string {
        return `reasoning-tooltip ${this.shouldShowTooltip ? 'reasoning-tooltip_visible' : ''}`;
    }

    get tooltipAriaHidden(): string {
        return this.shouldShowTooltip ? 'false' : 'true';
    }

    get iconStrokeWidth(): string {
        return this._value === 'none' ? '1.75' : '2.25';
    }

    get firstBarClass(): string {
        return this.getBarClass(1);
    }

    get secondBarClass(): string {
        return this.getBarClass(2);
    }

    get thirdBarClass(): string {
        return this.getBarClass(3);
    }

    getBarClass(index: number): string {
        return `reasoning-bar reasoning-bar_${index} ${this.currentPreset.bars >= index ? 'reasoning-bar_filled' : ''}`;
    }

    handleMouseEnter() {
        this._isHovered = true;
    }

    handleMouseLeave() {
        this._isHovered = false;
    }

    handleButtonClick() {
        if (this.disabled) {
            return;
        }

        const index = PRESETS.findIndex(item => item.value === this._value);
        const nextPreset = PRESETS[(index + 1 + PRESETS.length) % PRESETS.length];
        this._value = nextPreset.value;

        this.dispatchEvent(
            new CustomEvent(Event.Change, {
                detail: { value: nextPreset.value },
                bubbles: true,
                composed: true,
            })
        );

        this.showTooltipBriefly();
    }

    handleTooltipClick() {
        this.hideTooltip();
    }

    showTooltipBriefly() {
        this._tooltipPinned = true;
        this.clearHideTimer();
        this._hideTimerId = window.setTimeout(() => {
            this._tooltipPinned = false;
            this._hideTimerId = null;
        }, HIDE_TOOLTIP_DELAY_MS);
    }

    hideTooltip() {
        this._tooltipPinned = false;
        this.clearHideTimer();
    }

    clearHideTimer() {
        if (this._hideTimerId !== null) {
            window.clearTimeout(this._hideTimerId);
            this._hideTimerId = null;
        }
    }
}
