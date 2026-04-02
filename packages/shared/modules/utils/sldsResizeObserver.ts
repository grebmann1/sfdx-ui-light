import { timeout, animationFrame } from './dom';

const DELAY_TIMEOUT = 200;
export class LightningResizeObserver {
    private _resizeObserverAvailable: boolean;
    private _running = false;
    private _delayedResizeCallback: () => void;
    private _resizeObserver?: ResizeObserver;
    private _requestAnimationId?: number;
    private _hasWindowResizeHandler = false;

    constructor(resizeCallback: () => void) {
        this._resizeObserverAvailable = typeof ResizeObserver === 'function';

        const delayedCallback = (callback: () => void) => {
            if (this._running) {
                return;
            }
            this._running = true;

            timeout(DELAY_TIMEOUT)
                .then(() => animationFrame())
                .then(() => {
                    callback();
                    this._running = false;
                });
        };
        this._delayedResizeCallback = delayedCallback.bind(this, resizeCallback);

        if (this._resizeObserverAvailable) {
            this._resizeObserver = new ResizeObserver(this._delayedResizeCallback);
        }
    }

    observe(lightningElement: Element): void {
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        this._requestAnimationId = requestAnimationFrame(() => {
            if (this._resizeObserverAvailable) {
                this._resizeObserver?.observe(lightningElement);
            } else if (!this._hasWindowResizeHandler) {
                window.addEventListener('resize', this._delayedResizeCallback);
                this._hasWindowResizeHandler = true;
            }
        });
    }

    disconnect(): void {
        if (this._resizeObserver) {
            this._resizeObserver.disconnect();
        }
        if (this._requestAnimationId) {
            cancelAnimationFrame(this._requestAnimationId);
        }
        window.removeEventListener('resize', this._delayedResizeCallback);
        this._hasWindowResizeHandler = false;
    }
}
