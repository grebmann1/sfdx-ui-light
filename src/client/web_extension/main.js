import '@lwc/synthetic-shadow';
import { createElement } from 'lwc';
import extensionRoot from 'extension/root';

const loadLocalForage = async () => {
    return new Promise((resolve,reject) => {
        localforage.ready().then(function() {
            console.log('-- Chrome Storage --');
            resolve();
        }).catch(function (e) {
            console.log('-- Standard Storage --');
            resolve();
        });
    })
}


const init = async () => {
    /** Load Local Forage  **/
    localforage.defineDriver(webExtensionStorageDriver.sync);
    localforage.setDriver('webExtensionSyncStorage')
    await loadLocalForage();

    /** Define Settings **/
    window.connections = {}; // use for faster connection, during live processing
    window.jsforceSettings = {
        clientId:  '3MVG9_kZcLde7U5oNdaqndT3T9qa54eaA.ycC6APuOkYzRP286pPeOvwOqAQ2ue7l5ejNAxPYj4xTbWn3zS6Y',
        redirectUri: `http://localhost:3000/chrome/callback`,
        proxyUrl: `http://localhost:3000/proxy/`,
    };
    window.defaultStore = localforage.createInstance({name: "defaultStore"});
    window.jsforce = jsforce;
    console.log('window.jsforceSettings',window.jsforceSettings);

    /** Load LWC Elements **/
    const elm = createElement('extension-root', { is: extensionRoot });
    document.body.appendChild(elm);
}


/** Init **/

init();







