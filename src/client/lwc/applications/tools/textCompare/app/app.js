import { track, wire } from 'lwc';
import ToolkitElement from 'core/toolkitElement';
import Toast from 'lightning/toast';
import { store, connectStore, TEXTCOMPARE } from 'core/store';
import Analytics from 'shared/analytics';

export default class App extends ToolkitElement {
    @track leftText = '';
    @track rightText = '';
    @track ignoreWhitespace = false;

    connectedCallback() {
        Analytics.trackAppOpen('textCompare', { alias: this.alias });
        store.dispatch(
            TEXTCOMPARE.reduxSlice.actions.loadCacheSettings({
                alias: this.alias,
            })
        );
    }

    @wire(connectStore, { store })
    storeChange({ textCompare, application }) {
        const isCurrentApp = this.verifyIsActive(application.currentApplication);
        if (!isCurrentApp) return;
        if (textCompare) {
            this.leftText = textCompare.leftText ?? '';
            this.rightText = textCompare.rightText ?? '';
            this.ignoreWhitespace = !!textCompare.ignoreWhitespace;
        }
    }

    handleMonacoLoaded = () => {};

    handleDiffChange = (e) => {
        const detail = e.detail || {};
        const left = detail.left ?? '';
        const right = detail.right ?? '';
        store.dispatch(
            TEXTCOMPARE.reduxSlice.actions.setTexts({
                left,
                right,
                alias: this.alias,
            })
        );
    };

    handleCopyLeft = () => {
        const text = this.refs?.diffEditor?.getValues?.()?.left ?? this.leftText;
        if (text !== undefined) {
            navigator.clipboard.writeText(text);
            Toast.show({ label: 'Left text copied to clipboard', variant: 'success' });
        }
    };

    handleCopyRight = () => {
        const text = this.refs?.diffEditor?.getValues?.()?.right ?? this.rightText;
        if (text !== undefined) {
            navigator.clipboard.writeText(text);
            Toast.show({ label: 'Right text copied to clipboard', variant: 'success' });
        }
    };

    handleSwap = () => {
        store.dispatch(
            TEXTCOMPARE.reduxSlice.actions.swap({
                alias: this.alias,
            })
        );
        this.leftText = this._getStoreLeft();
        this.rightText = this._getStoreRight();
    };

    handleClear = () => {
        store.dispatch(
            TEXTCOMPARE.reduxSlice.actions.clear({
                alias: this.alias,
            })
        );
        this.leftText = '';
        this.rightText = '';
    };

    _getStoreLeft() {
        return store.getState()?.textCompare?.leftText ?? '';
    }

    _getStoreRight() {
        return store.getState()?.textCompare?.rightText ?? '';
    }

    handleIgnoreWhitespaceChange = (e) => {
        const checked = e.detail?.checked === true || e.target?.checked === true;
        this.ignoreWhitespace = checked;
        store.dispatch(
            TEXTCOMPARE.reduxSlice.actions.setOptions({
                ignoreWhitespace: checked,
                alias: this.alias,
            })
        );
    };

    get pageClass() {
        return super.pageClass + ' slds-p-around_small text-compare-root';
    }

    get showEmptyState() {
        return !this.leftText && !this.rightText;
    }
}
