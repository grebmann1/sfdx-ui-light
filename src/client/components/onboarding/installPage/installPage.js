import { LightningElement } from 'lwc';

export default class installPage extends LightningElement {
    handleTutorialComplete() {
        // Redirect to the main app or perform any other action after tutorial completion
        window.location.href = '/app';
    }
} 