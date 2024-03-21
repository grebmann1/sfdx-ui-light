console.log('init from side.js')
window.extension_initLwc('side');
chrome.runtime.connect({ name: 'side-panel-connection' });
