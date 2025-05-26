import { api, track, wire } from 'lwc';
import { decodeError, isNotUndefinedOrNull, classSet } from 'shared/utils';
import ToolkitElement from 'core/toolkitElement';
import { connectStore, store, EVENT } from 'core/store';

export default class EventViewer extends ToolkitElement {
    isLoading = false;

    currentModel;
    viewerTab = 'Default';

    @track _item;
    @api
    get item() {
        return this._item;
    }
    set item(value) {
        this._item = value;
        if (this._hasRendered && this.refs.editor) {
            this.refs.editor.currentModel.setValue(this.content);
        }
    }

    connectedCallback() {}

    renderedCallback() {
        this._hasRendered = true;

        if (this._hasRendered && this.template.querySelector('slds-tabset')) {
            this.template.querySelector('slds-tabset').activeTabValue = this.viewerTab;
        }
    }

    @wire(connectStore, { store })
    storeChange({ platformEvent }) {
        if (platformEvent) {
            this.viewerTab = platformEvent.viewerTab;
        }
    }

    /** Events **/

    handleSelectTab(event) {
        store.dispatch(
            EVENT.reduxSlice.actions.updateViewerTab({
                value: event.target.value,
                alias: this.alias,
            })
        );
    }

    handleMonacoLoaded = () => {
        //this.isLoading = false;
        this.currentModel = this.refs.editor.createModel({
            body: this.content,
            language: 'json',
        });
        this.refs.editor.displayModel(this.currentModel);
    };

    /** Methods  **/

    /** Getters */

    get content() {
        const data = this._item?.content || this._item;
        return JSON.stringify(data, null, 4);
    }

    get defaultContainerClass() {
        return classSet('slds-full-height slds-scrollable_y')
            .add({ 'slds-hide': !(this.viewerTab === 'Default') })
            .toString();
    }

    get customContainerClass() {
        return classSet('slds-full-height slds-scrollable_y')
            .add({ 'slds-hide': !(this.viewerTab === 'Custom') })
            .toString();
    }

    get jsonContainerClass() {
        return classSet('slds-full-height slds-scrollable_y')
            .add({ 'slds-hide': !(this.viewerTab === 'JSON') })
            .toString();
    }
}
