console.log('init from app.js');
import {monaco} from '/libs/monaco/monaco.bundle.js';
window.monaco = monaco;
window.extension_initApp();
//chrome.runtime.connect({name: 'side-panel-connection'});
