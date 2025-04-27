import { LightningElement, track, api } from 'lwc';
import { isNotUndefinedOrNull, isUndefinedOrNull, runActionAfterTimeOut } from 'shared/utils';
import hljs from 'highlight.js';

export default class Preview extends LightningElement {
    @api file;

    connectedCallback() {}

    renderedCallback() {
        // Get all the links on the page
        var items = this.template.querySelectorAll('.page-code');
        // Loop through each link and compare its href with the current URL
        for (var i = 0; i < items.length; i++) {
            hljs.highlightElement(items[i]);
        }
    }
    /** Events */

    /** Methods  */

    /** Processing Methods */

    /** Getters */

    get sortedItems() {
        return this.file.items.sort(
            (a, b) => a.location.region.startLine - b.location.region.startLine
        );
    }
}
