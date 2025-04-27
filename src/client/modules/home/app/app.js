import { api } from 'lwc';
import { isEmpty, isElectronApp } from 'shared/utils';
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
