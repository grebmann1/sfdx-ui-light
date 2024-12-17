//console.log('init from default.js')
import {monaco} from '/libs/monaco/monaco.bundle.js';
window.monaco = monaco;
window.extension_initLwc('default');
chrome.runtime.connect({name: 'side-panel-connection'});
