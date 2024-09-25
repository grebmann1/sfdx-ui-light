import LightningModal from 'lightning/modal';
import {api} from "lwc";
import {isNotUndefinedOrNull} from "shared/utils";
import {CACHE_CONFIG, chromeOpenInWindow, loadExtensionConfigFromCache} from 'extension/utils';

export default class UserExplorerNetworkModal extends LightningModal {

    @api networkMembers;
    @api standard;
    @api frontDoorUrl;
    @api username;

    get isStandardDisplayed() {
        return isNotUndefinedOrNull(this.standard);
    }

    get isNetworkMembersDisplayed() {
        return this.networkMembers.length > 0;
    }

    handleCloseClick() {
        this.close('canceled');
    }

    closeModal() {
        this.close('success');
    }

    /* Getters */

    /** events **/

    handleStandardLogin = (e) => {
        e.preventDefault();
        chromeOpenInWindow(
            `${this.frontDoorUrl}&retURL=${encodeURIComponent(this.standard)}`,
            this.username,
            true
        );
    };

    handleExperienceLogin = async (e) => {
        e.preventDefault();
        const targetUrl = e.currentTarget?.href;
        const configuration = await loadExtensionConfigFromCache([CACHE_CONFIG.EXPERIENCE_CLOUD_LOGINAS_INCOGNITO]);
        //console.log('configuration.EXPERIENCE_CLOUD_LOGINAS_INCOGNITO',configuration[CACHE_CONFIG.EXPERIENCE_CLOUD_LOGINAS_INCOGNITO]);
        chromeOpenInWindow(
            `${this.frontDoorUrl}&retURL=${encodeURIComponent(targetUrl)}`,
            this.username,
            configuration[CACHE_CONFIG.EXPERIENCE_CLOUD_LOGINAS_INCOGNITO],
            configuration[CACHE_CONFIG.EXPERIENCE_CLOUD_LOGINAS_INCOGNITO]
        );
    }


}