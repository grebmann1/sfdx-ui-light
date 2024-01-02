const { app,nativeImage,protocol}   = require('electron');
const path                          = require('path');
const {getOrCreateMainWindow}   = require('./utils/window.js');
const { ipcMainManager }        = require('./utils/ipc.js');
const ORG_CONNECTOR             = require('./plugins/org/connector.js');
const CODE_CONNECTOR            = require('./plugins/code/connector.js');
const UTIL_CONNECTOR            = require('./plugins/util/connector.js');
/** Auto Updater **/
const isDev = !app.isPackaged;

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
new ORG_CONNECTOR.connector().enableEventListeners(ipcMainManager);
new CODE_CONNECTOR.connector().enableEventListeners(ipcMainManager);
new UTIL_CONNECTOR.connector().enableEventListeners(ipcMainManager);

if(isDev) {
    require('electron-reload')(__dirname, {
      electron: path.join(__dirname,'..','..','node_modules', '.bin', 'electron')
    })
}else{
    
}




app.whenReady().then(async () => {
    /** Custom image */
    const image = nativeImage.createFromPath(
        app.getAppPath() + "/public/sfdx_gui.png"
    );
    app.dock.setIcon(image);

    /** Main Window **/
    console.log('process.en.NODE_ENV',process.env.NODE_ENV);
    let mainWindow = getOrCreateMainWindow();
    if (process.env.NODE_ENV === 'development') {
        mainWindow.loadURL('http://localhost:3000/app');
    } else {
        mainWindow.loadURL('https://sf-toolkit.com/app');
    }
});

app.on('window-all-closed', () => {
    console.log('window-all-closed');
    app.quit();
})
