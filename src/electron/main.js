const { app,nativeImage,protocol}   = require('electron');
const path                  = require('path');
const {getOrCreateMainWindow}   = require('./utils/window.js');
const { ipcMainManager }        = require('./utils/ipc.js');
const Store                     = require('./utils/store.js');
const ORG_CONNECTOR             = require('./plugins/org/connector.js');
const JSFORCE_CONNECTOR         = require('./plugins/jsforce/connector.js');

/** Auto Updater **/

const isDev = !app.isPackaged;
const IpcEvents = [
  'org'
];

//const loadURL = serve({directory: 'site'});

/** Load Server **/
//let server = require('./express');
/*protocol.registerSchemesAsPrivileged([
    {
        scheme: 'http',
        privileges: {
            standard: true,
            secure: true,
            allowServiceWorkers: true,
            supportFetchAPI: true,
            corsEnabled: true,
        },
    },
]);*/

/** Store **/

/** Init Listeners */
ipcMainManager.initListeners(IpcEvents);
new ORG_CONNECTOR.connector().enableEventListeners(ipcMainManager);
new JSFORCE_CONNECTOR.connector().enableEventListeners(ipcMainManager);

if(isDev) {
    require('electron-reload')(__dirname, {
      electron: path.join(__dirname,'..','..','node_modules', '.bin', 'electron')
    })
}else{
    
}


const store = new Store({
    configName: 'app-settings',
    defaults: {
      windowBounds: { width: 800, height: 600 }
    }
});

app.whenReady().then(async () => {
    /** Custom image */
    const image = nativeImage.createFromPath(
        app.getAppPath() + "/public/sfdx_gui.png"
    );
    app.dock.setIcon(image);

    /** Main Window **/
    console.log('process.en.NODE_ENV',process.env.NODE_ENV);
    let mainWindow = getOrCreateMainWindow({store});
    if (process.env.NODE_ENV === 'development') {
        mainWindow.loadURL('http://localhost:3000/');
    } else {
        await loadURL(mainWindow);
    }
});

app.on('window-all-closed', () => {
    console.log('window-all-closed');
    app.quit();
})
