/**
 * Created by malickis on 08.11.2022.
 */

import { LightningElement, api, track } from 'lwc';
import { normalizeBoolean } from 'shared/utils';

export default class sldsTab extends LightningElement {
    @track _loadContent = false;

    
    @api isAddTabEnabled = false;

    connectedCallback() {
        this._connected = true;

        this.dispatchEvent(
            new CustomEvent('privatetabregister', {
                cancelable: true,
                bubbles: true,
                composed: true,
                detail: {
                    setDeRegistrationCallback: (deRegistrationCallback) => {
                        this._deRegistrationCallback = deRegistrationCallback;
                    }
                }
            })
        );
    }

    

    @api
    loadContent() {
        this._loadContent = true;
        
        this.dispatchEvent(new CustomEvent('active'));
    }

    disconnectedCallback() {
        this._connected = false;

        if (this._deRegistrationCallback) {
            this._deRegistrationCallback();
        }
    }

    @api get isDraft() {
        return this._isDraft;
    }

    set isDraft(newValue) {
        this._isDraft = newValue;
        this._dispatchDataChangeEventIfConnected();
    }

    @api get isCloseable() {
        return this._isCloseable;
    }

    set isCloseable(newValue) {
        this._isCloseable = newValue;
        this._dispatchDataChangeEventIfConnected();
    }

    @api get value() {
        return this._value;
    }

    set value(newValue) {
        this._value = String(newValue);
        this._dispatchDataChangeEventIfConnected();
    }

    @api get label() {
        return this._label;
    }

    set label(value) {
        this._label = value;
        this._dispatchDataChangeEventIfConnected();
    }

    @api get title() {
        return this._title;
    }

    set title(value) {
        this._title = value;
        this._dispatchDataChangeEventIfConnected();
    }

    @api get counter() {
        return this._counter;
    }

    set counter(value) {
        this._counter = value;
        this._dispatchDataChangeEventIfConnected();
    }

    @api get badgeColor() {
        return 'background-color:' + this._badgeBackgroundColor + ';color:' + this._badgeTextColor + '';
    }

    set badgeTextColor(value) {
        this._badgeTextColor = value;
        this._dispatchDataChangeEventIfConnected();
    }

    @api get badgeTextColor() {
        return this._badgeTextColor;
    }

    set badgeBackgroundColor(value) {
        this._badgeBackgroundColor = value;
        this._dispatchDataChangeEventIfConnected();
    }

    @api get badgeBackgroundColor() {
        return this._badgeBackgroundColor;
    }

    set badgePosition(value) {
        this._badgePosition = value;
        this._dispatchDataChangeEventIfConnected();
    }

    @api get badgePosition() {
        return this._badgePosition;
    }

    @api get badgePositionClass() {
        return this._badgePosition == 'corner' ? 'slds-badge-position-corner' : 'slds-badge';
    }

    @api get iconName() {
        return this._iconName;
    }

    set iconName(value) {
        this._iconName = value;
        this._dispatchDataChangeEventIfConnected();
    }

    @api get iconAssistiveText() {
        return this._iconAlernativeText;
    }

    set iconAssistiveText(value) {
        this._iconAlernativeText = value;
        this._dispatchDataChangeEventIfConnected();
    }

    @api get endIconName() {
        return this._endIconName;
    }

    set endIconName(value) {
        this._endIconName = value;
        this._dispatchDataChangeEventIfConnected();
    }

    @api get endIconAlternativeText() {
        return this._endIconAlternativeText;
    }

    set endIconAlternativeText(value) {
        this._endIconAlternativeText = value;
        this._dispatchDataChangeEventIfConnected();
    }

    @api get showErrorIndicator() {
        return this._showErrorIndicator;
    }

    set showErrorIndicator(value) {
        this._showErrorIndicator = normalizeBoolean(value);
        this._dispatchDataChangeEventIfConnected();
    }

    _dispatchDataChangeEventIfConnected() {
        if (this._connected) {
            this.dispatchEvent(
                new CustomEvent('privatetabdatachange', {
                    cancelable: true,
                    bubbles: true,
                    composed: true
                })
            );
        }
    }

    handleCounterUpdate(event) {
        this.counter = event.detail.value;
    }
}