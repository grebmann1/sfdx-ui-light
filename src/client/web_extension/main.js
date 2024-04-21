import '@lwc/synthetic-shadow';
import { createElement } from 'lwc';
import extensionRoot from 'extension/root';


const loadLocalForage = async () => {
    return new Promise((resolve,reject) => {
        localforage.defineDriver(customChromeStorageDriver)
        .then(() => localforage.setDriver('customChromeStorageDriver'))
        .then(() => {
            //console.log('customChromeStorageDriver',customChromeStorageDriver);
            //console.log('localforage',localforage);
            //console.log('localforage.driver()',localforage.driver());
            window.defaultStore = localforage//localforage.createInstance({name: "defaultStore"});
            resolve();
        });
    })
}

const init = async () => {
    /** Load Local Forage  **/
    //console.log('customChromeStorageDriver',customChromeStorageDriver);
    
    await loadLocalForage();
    
    

    /** Define Settings **/
    window.mermaid = mermaid; 
    window.Prism = Prism;
    //window.connections = {}; // use for faster connection, during live processing
    window.jsforceSettings = {
        clientId:  '3MVG9_kZcLde7U5oNdaqndT3T9qa54eaA.ycC6APuOkYzRP286pPeOvwOqAQ2ue7l5ejNAxPYj4xTbWn3zS6Y',
        chromeId:   'dmlgjapbfifmeopbfikbdmlgdcgcdmfb',
        redirectUri:'https://sf-toolkit.com/chrome/callback',
        proxyUrl:   'https://sf-toolkit.com/proxy/',
        //redirectUri: `http://localhost:3000/chrome/callback`,
        //proxyUrl: `http://localhost:3000/proxy/`,
    };
    
    window.jsforce = jsforce;
    //console.log('window.jsforceSettings',window.jsforceSettings,localforage);

    
}


/** Init **/

window.extension_initLwc = async (variant) => {
    await init();
    const elm = createElement('extension-root', { is: extensionRoot });
    Object.assign(elm, {
        variant
    });
    document.body.appendChild(elm);
}

