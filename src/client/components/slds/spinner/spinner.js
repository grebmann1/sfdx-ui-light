import { LightningElement, api } from 'lwc';
import {isNotUndefinedOrNull,normalizeString as normalize} from "shared/utils";

export default class Spinner extends LightningElement {
    @api alternativeText;
    @api size = 'medium';
    @api variant;

    @api message;
    @api additionalMessage;
    @api messages;
    @api position;
    messageCSS;

    _interval



    connectedCallback() {
        this.classList.add('slds-spinner_container');
        this.template.addEventListener('mousewheel', this.stopScrolling);
        this.template.addEventListener('touchmove', this.stopScrolling);

        if(isNotUndefinedOrNull(this.messages) && this.messages.length > 0){
            this.displayNextMessage(0);
        }

    }

    renderedCallback() {
        this.messageCSS = 'spinner-text ' + this.normalizedPosition + ' ' + this.size;
    }

    disconnectedCallback() {
        clearInterval(this._interval);
    }

    displayNextMessage = () => {

        let position = 0;
        this.message = this.messages[position];
        this._interval = setInterval(() =>{
            let el = this.template.querySelector('.spinner-text');
            if(el.offsetWidth > 0 && el.offsetHeight > 0){
                position = position >= this.messages.length - 1? 0 : position+1;
            }else{
                position = 0;
            }
            this.message = this.messages[position];
        },5000);
    }

    get normalizedVariant() {
        return normalize(this.variant, {
            fallbackValue: 'base',
            validValues: ['base', 'brand', 'inverse']
        });
    }

    get normalizedPosition() {
        return normalize(this.position, {
            fallbackValue: 'bottom',
            validValues: ['bottom', 'left', 'top','right']
        });
    }

    get normalizedSize() {
        return normalize(this.size, {
            fallbackValue: 'medium',
            validValues: ['small', 'medium', 'large']
        });
    }

    get validAlternativeText() {
        const hasAlternativeText = !!this.alternativeText;

        if (!hasAlternativeText) {
            // eslint-disable-next-line no-console
            console.warn(
                `<c-spinner> The alternativeText attribute should not be empty. Please add a description of what is causing the wait.`
            );
        }

        return hasAlternativeText;
    }

    stopScrolling(event) {
        event.preventDefault();
    }
}