const { app,nativeImage,protocol }   = require('electron');
const path                          = require('path');
const { getOrCreateMainWindow }   = require('./utils/window.js');
const { ipcMainManager }        = require('./utils/ipc.js');
const ORG_CONNECTOR             = require('./libs/org/connector.js');
const CODE_CONNECTOR            = require('./libs/code/connector.js');
const UTIL_CONNECTOR            = require('./libs/util/connector.js');

/** Auto Updater **/
const isDev = !app.isPackaged;
console.log('isDev',isDev);
console.log('version',app.getVersion());



/** Dev Mode  **/
if(isDev) {
    require('electron-reload')(__dirname, {
      electron: path.join(__dirname,'..','..','node_modules', '.bin', 'electron')
    })
}else{

    const { updateElectronApp } = require('update-electron-app');
    updateElectronApp(); // additional configuration options available
}
/** Store **/

/** Init Listeners **/
new ORG_CONNECTOR.connector().enableEventListeners(ipcMainManager);
new CODE_CONNECTOR.connector().enableEventListeners(ipcMainManager);
new UTIL_CONNECTOR.connector().enableEventListeners(ipcMainManager);




/** Execute **/
app.whenReady().then(async () => {
    //Custom image
    const image = nativeImage.createFromPath(
        app.getAppPath() + "/public/sfdx_gui.png"
    );
    app.dock.setIcon(image);

    // Main Window
    let mainWindow = getOrCreateMainWindow({isDev});
    if (isDev) {
        mainWindow.loadURL('http://localhost:3000/app');
    } else {
        mainWindow.loadURL('https://sf-toolkit.com/app');
    }
});

app.on('window-all-closed', () => {
    app.quit();
})
