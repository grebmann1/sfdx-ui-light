import { LightningElement, api, createElement } from 'lwc';

import promptWidget from 'editor/promptWidget';

export default class Test extends LightningElement {
    isDragging = false;
    offsetX = 0;
    offsetY = 0;
    clientX = 0;
    clientY = 0;

    connectedCallback() {
        this.template.addEventListener('mousedown', this.startDragging.bind(this));
        document.addEventListener('mousemove', this.drag.bind(this));
        document.addEventListener('mouseup', this.stopDragging.bind(this));
    }

    disconnectedCallback() {
        document.removeEventListener('mousemove', this.drag.bind(this));
        document.removeEventListener('mouseup', this.stopDragging.bind(this));
    }

    renderedCallback() {
        if (this.hasRendered) return;
        this.hasRendered = true;
        this.injectIframe();
    }

    /** Methods */
    injectIframe() {
        let iframeElement = this.template.querySelector('.iframe');
        const iframeDoc = iframeElement.contentDocument;

        // Inject the LWC into the iframe's body
        const elm = createElement('editor-prompt-widget', { is: promptWidget });
        Object.assign(elm, {
            isMovable: true,
        });
        iframeDoc.body.appendChild(elm);

        // Style the iframe body
        iframeDoc.body.style.margin = '0';
        iframeDoc.body.style.overflow = 'hidden';
    }

    @api
    display() {
        const element = this.template.querySelector('.movable');
        element.style.display = 'block';
        element.style.position = 'absolute';
        element.style.left = `${this.clientX}px`;
        element.style.top = `${this.clientY}px`;
    }

    /** Handlers */

    startDragging(event) {
        this.isDragging = true;
        const element = this.template.querySelector('.movable');
        const rect = element.getBoundingClientRect();

        // Calculate offset of click relative to element
        this.offsetX = event.clientX - rect.left;
        this.offsetY = event.clientY - rect.top;
    }

    drag(event) {
        this.clientX = event.clientX;
        this.clientY = event.clientY;
        if (!this.isDragging) return;

        const element = this.template.querySelector('.movable');

        // Update position
        element.style.position = 'absolute';
        element.style.left = `${event.clientX - this.offsetX}px`;
        element.style.top = `${event.clientY - this.offsetY}px`;
    }

    stopDragging() {
        this.isDragging = false;
    }
}
