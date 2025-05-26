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

    

    /* Getters */

    get isRedirect() {
        return isNotUndefinedOrNull(this.redirectUrl);
    }

    /** events **/

    handleCopy = e => {
        navigator.clipboard.writeText(e.currentTarget.dataset.value);
    };

    handleCloseClick() {
        this.close('canceled');
    }

    closeModal() {
        this.close('success');
    }

}
