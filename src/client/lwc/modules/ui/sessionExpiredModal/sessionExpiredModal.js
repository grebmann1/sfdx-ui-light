import { api } from 'lwc';
import LightningModal from 'lightning/modal';

export const RESULT = {
    OK: 'ok',
    AUTO_RECONNECT: 'auto-reconnect',
};

export default class SessionExpiredModal extends LightningModal {
    @api message;

    handleClose = () => {
        this.close(RESULT.OK);
    };

    handleAutoReconnect = () => {
        this.close(RESULT.AUTO_RECONNECT);
    };
}


