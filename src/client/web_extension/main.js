import '@lwc/synthetic-shadow';
import { createElement } from 'lwc';
import extensionPopupView from 'ui/extensionPopupView';

const elm = createElement('extension-popup-view', { is: extensionPopupView });
document.body.appendChild(elm);


window.jsforce = jsforce;