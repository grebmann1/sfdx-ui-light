

/*
var port = chrome.runtime.connect();
window.addEventListener("message", (event) => {
  // We only accept messages from ourselves
  if (event.source !== window) {
    return;
  }

  if (event.data.type && (event.data.type === "FROM_PAGE")) {
    console.log("Content script received: " + event.data.text);
    port.postMessage(event.data.text);
  }
}, false);
*/

//window._isInjected = true;
//window._injectedConnections = [{alias:'test-gui',sfdxAuthUrl:'hello@hello'}];
console.log('Injected');
const myJsonObject = {
    key1: "value1",
    key2: "value2",
    key3: {
        subKey1: "subValue1",
        subKey2: "subValue2"
    }
};

const jsonString = JSON.stringify(myJsonObject, null, 2); // Beautify the JSON string

// Create a new element to display the JSON string
const divElement = document.createElement('div');
    divElement.textContent = jsonString;
    divElement.className = 'injected-connections';
    divElement.style = 'display:none;'

// Append the element to the body or another existing element of your choice
document.body.appendChild(divElement);