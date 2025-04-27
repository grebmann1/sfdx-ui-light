import LightningModal from 'lightning/modal';
import { api } from 'lwc';
import {
    isUndefinedOrNull,
    isNotUndefinedOrNull,
    isElectronApp,
    isChromeExtension,
    decodeError,
    checkIfPresent,
} from 'shared/utils';

export default class ConnectionDetailModal extends LightningModal {
    @api company;
    @api orgId;
    @api name;
    @api alias;
    @api username;
    @api instanceUrl;
    @api sfdxAuthUrl;
    @api frontDoorUrl;
    @api accessToken;

    // redirectUrl
    @api redirectUrl;

    handleCloseClick() {
        this.close('canceled');
    }

    closeModal() {
        this.close('success');
    }

    /* Getters */

    get isRedirect() {
        return isNotUndefinedOrNull(this.redirectUrl);
    }

    /** events **/

    handleCopySFDXAuthUrl = () => {
        navigator.clipboard.writeText(this.sfdxAuthUrl);
    };

    handleCopySFDXAccessToken = () => {
        navigator.clipboard.writeText(this.accessToken);
    };

    handleCopyFrontDoorUrl = () => {
        navigator.clipboard.writeText(this.frontDoorUrl);
    };

    handleCopyRedirectUrl = () => {
        navigator.clipboard.writeText(this.redirectUrl);
    };

    /** getters */
}
