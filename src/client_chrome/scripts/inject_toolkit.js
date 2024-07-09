'use strict';


const _injectHtml = (myJsonObject) => {
    const jsonString = JSON.stringify(myJsonObject, null, 2); // Beautify the JSON string

    // Create a new element to display the JSON string
    const divElement = document.createElement('div');
        divElement.textContent = jsonString;
        divElement.className = 'injected-connections';
        divElement.style = 'display:none;'

    // Append the element to the body or another existing element of your choice
    document.body.appendChild(divElement);
}



/** Methods **/
const injectConnections = async () => {
    _injectHtml(await chrome.storage.local.get("connections"))
}



(async () => {
    //console.log('### SF Toolkit Injection ###');

    injectConnections();
})();

