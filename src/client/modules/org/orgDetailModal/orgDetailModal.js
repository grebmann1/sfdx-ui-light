import LightningModal from 'lightning/modal';
import { api } from "lwc";

export default class NewOrgModal extends LightningModal {
    
    @api company;
    @api orgId;
    @api name;
    @api alias;
    @api username;
    @api instanceUrl;
    @api sfdxAuthUrl;
    @api accessToken;


    handleCloseClick() {
        this.close('canceled');
    }

    closeModal() {
        this.close('success');
    }

    
    /** events **/

    handleCopySFDXAuthUrl = () => {
        navigator.clipboard.writeText(this.sfdxAuthUrl);
    }

    handleCopySFDXAccessToken = () => {
        navigator.clipboard.writeText(this.accessToken);
    }

    /** getters */


}