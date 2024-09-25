const _injectHtml = (myJsonObject, className) => {
    const jsonString = JSON.stringify(myJsonObject, null, 2); // Beautify the JSON string

    // Create a new element to display the JSON string
    const divElement = document.createElement('div');
    divElement.textContent = jsonString;
    divElement.className = className;
    divElement.style = 'display:none;';

    // Append the element to the body or another existing element of your choice
    document.body.appendChild(divElement);
};


/** Methods **/


(async () => {
    //console.log('### SF Toolkit Injection ###');

    _injectHtml(await chrome.storage.local.get("connections"), 'injected-connections');
    _injectHtml(await chrome.storage.local.get("openai_key"), 'injected-openai-key')
})();

