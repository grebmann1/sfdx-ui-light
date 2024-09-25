import { api } from 'lwc';
import LightningOverlay from 'lightning/overlay';
import { parent, instanceName, secure } from 'lightning/overlayUtils';
import LightningModalBase from 'lightning/modalBase';
import { normalizeBoolean } from 'lightning/utilsPrivate';

/**
 * Extend this component to create a modal window overlayed on the current app window.
 */
export default class Modal extends LightningOverlay {
    static [parent] = LightningModalBase;
    static [instanceName] = 'lightning-modal';

    // private tracked state
    _disableClose = false;

    // public api
    /**
     * How much of the viewport width the modal uses. Supported values are small, medium, large, or full.
     * @type {string}
     * @default medium
     */
    @api size = 'medium';

    /**
     * Sets the modal's title and assistive device label.
     * @type {string}
     * @required true
     * @default false
     */
    @api label = '';

    /**
     * Sets the modal's accessible description.
     * @type {boolean}
     * @default false
     */
    @api description = '';

    /**
     * Prevents closing the modal by normal means like the ESC key, the close button, or `.close()`.
     * @type {boolean}
     * @default false
     */
    @api
    get disableClose() {
        return this._disableClose;
    }

    set disableClose(value) {
        const currentDisableClose = this._disableClose;
        this._disableClose = normalizeBoolean(value);
        // if there is a change, dispatch private event for modalBase
        if (currentDisableClose !== this._disableClose) {
            this.dispatchEvent(
                new CustomEvent('privatedisableclosebutton', {
                    detail: {
                        disableClose: this._disableClose,
                        [secure]: true,
                    },
                    bubbles: true,
                })
            );
        }
    }

    @api
    close(result) {
        // Prevent close() private event until disableClose removed
        if (!this.disableClose) {
            const promise = new Promise((resolve) => {
                this.dispatchEvent(
                    new CustomEvent('privateclose', {
                        detail: {
                            resolve,
                            [secure]: true,
                        },
                        bubbles: true,
                    })
                );
            });
            super.close(result, promise);
        } else {
            // Intentionally console error when devs have not disabled elements
            // when disableClose has been set true
            let errorMsg =
                'LightningModal - Any interactions (buttons, processes, etc) that call modal.close() should be ';
            errorMsg += '(a) disabled, while disableClose api set true, and ';
            errorMsg += '(b) re-enabled, when disableClose set false';
            console.error(errorMsg);
        }
    }
}
