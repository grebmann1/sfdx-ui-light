import ToolkitElement from 'core/toolkitElement';
import { cacheManager } from 'shared/cacheManager';

const HOME_WELCOME_DISMISSED_KEY = 'home-welcome-dismissed';

export default class Welcome extends ToolkitElement {
    showBanner = true;

    async connectedCallback() {
        try {
            const isDismissed = await cacheManager.loadGeneralData(
                HOME_WELCOME_DISMISSED_KEY,
                false
            );
            this.showBanner = isDismissed !== true;
        } catch {
            // Non-blocking fallback: keep banner visible if cache read fails.
            this.showBanner = true;
        }
    }

    /** Methods */

    /** Getters */

    /** Events */
    handleClose = async () => {
        this.showBanner = false;
        try {
            await cacheManager.saveGeneralData(HOME_WELCOME_DISMISSED_KEY, true);
        } catch {
            // Non-blocking: UI remains dismissed for current session even if cache write fails.
        }
    };
}
