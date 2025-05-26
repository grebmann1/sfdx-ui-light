import LightningModal from 'lightning/modal';
import { api } from 'lwc';

export default class ModalLauncher extends LightningModal {
    @api isUserLoggedIn;

    handleCloseClick() {
        this.close();
    }

    closeModal() {
        this.close();
    }

    /** events **/
    handleSelectApplication = e => {
        let application = e.detail;
        if (application) {
            this.close(application);
        }
    };
}
