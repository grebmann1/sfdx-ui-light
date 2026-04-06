import { api } from 'lwc';
import LightningModal from 'lightning/modal';

export const RESULT = {
    CLOSE: 'close',
    AUTO_RECONNECT: 'auto-reconnect',
};

export default class SessionRecoveryModal extends LightningModal {
    @api heading = 'Session Expired';
    @api message =
        'Your Salesforce session has expired. You can reconnect automatically when a reusable browser session is available.';
    @api details = '';
    @api closeLabel = 'Log out';
    @api reconnectLabel = 'Auto-Reconnect';
    @api isAutoReconnectEnabled = false;

    handleClose = () => {
        this.close(RESULT.CLOSE);
    };

    handleAutoReconnect = () => {
        this.close(RESULT.AUTO_RECONNECT);
    };
}
