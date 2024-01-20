const { app,nativeImage,Menu }   = require('electron');
const path                          = require('path');
const { browserWindows,createMainWindow,createInstanceWindow }   = require('./utils/window.js');
const { ipcMainManager }        = require('./utils/ipc.js');

const ORG_CONNECTOR             = require('./libs/org/connector.js');
const CODE_CONNECTOR            = require('./libs/code/connector.js');
const UTIL_CONNECTOR            = require('./libs/util/connector.js');


/** Fix Path **/
require('fix-path')();

/** Menu **/
//require('./utils/menu.js');

/** Auto Updater **/
const isDev = !app.isPackaged;
console.log('---> isDev   <---',isDev);
console.log('---> version <---',app.getVersion());


/** Dev Mode  **/
if(isDev) {
    /*require('electron-reload')(__dirname, {
      electron: path.join(__dirname,'node_modules', '.bin', 'electron')
    })*/
}else{

    const { updateElectronApp } = require('update-electron-app');
    updateElectronApp(); // additional configuration options available
}
/** Store **/

/** IPC Manager **/
try{
    new ORG_CONNECTOR.connector().enableEventListeners(ipcMainManager);
    new CODE_CONNECTOR.connector().enableEventListeners(ipcMainManager);
    new UTIL_CONNECTOR.connector().enableEventListeners(ipcMainManager);

    ipcMainManager.handle('OPEN_INSTANCE', (event,{alias,username}) => {
        createInstanceWindow({
            parent:browserWindows[0],
            isDev,alias,username
        });
    });

}catch(e){
    console.error('Issue in IPC Manager',e);
}

const isMac = process.platform === 'darwin'




/** Execute **/
app.whenReady().then(async () => {
    //Add Image to dock
    app.dock.setIcon(nativeImage.createFromPath(app.getAppPath() + "/public/sfdx_gui.png"));

    // Main Window
    createMainWindow({isDev});
    
});

app.on('window-all-closed', () => {
    app.quit();
})



