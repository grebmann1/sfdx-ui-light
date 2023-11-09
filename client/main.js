import '@lwc/synthetic-shadow';
import { createElement } from 'lwc';
import App from 'ui/app';

const elm = createElement('ui-app', { is: App });
document.body.appendChild(elm);