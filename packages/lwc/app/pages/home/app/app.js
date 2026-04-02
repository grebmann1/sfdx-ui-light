import ToolkitElement from 'core/toolkitElement';
export default class App extends ToolkitElement {
    connectedCallback() {}

    /** Events */

    /** Methods */

    /** Getters */

    get pageClass() {
        return super.pageClass + ' slds-overflow-hidden';
    }
}
