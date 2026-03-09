import { LightningElement, api } from 'lwc';
import { isUndefinedOrNull } from 'shared/utils';
import hotkeys from 'hotkeys-js';

export default class ShortcutSelector extends LightningElement {
    @api label = 'Shortcut Selector';

    @api disabled = false;

    _value = [];
    @api
    get value() {
        const key = Array.isArray(this._value) ? this._value[0] : this._value;
        return key === 'backspace'
            ? null
            : Array.isArray(this._value)
              ? this._value.join('+')
              : this._value || null;
    }
    set value(val) {
        this._value = isUndefinedOrNull(val) || typeof val !== 'string' ? [] : val.split('+');
    }

    handleInputFocus = () => {
        this.bindShortcut();
    };

    handleInputFocusOut = () => {
        this.unbindShortcut();
    };

    shortcutHandler = (e, handler) => {
        e.preventDefault();
        const keyString = hotkeys.getPressedKeyString();
        this._value = !keyString || keyString === 'backspace' ? [] : keyString.split('+');
        this.dispatchEvent(
            new CustomEvent('change', {
                detail: {
                    value: this.value,
                },
                bubbles: true,
                composed: true,
            })
        );
    };

    bindShortcut = () => {
        hotkeys('*', this.shortcutHandler);
    };

    unbindShortcut = () => {
        hotkeys.unbind('*', this.shortcutHandler);
    };

    get isDisabled() {
        return this.disabled;
    }
}
