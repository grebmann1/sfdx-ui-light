const { app,nativeImage }   = require('electron');
const path                  = require('path');
const serve                 = require('electron-serve');


const {getOrCreateMainWindow}   = require('./utils/window.js');
const { ipcMainManager }        = require('./utils/ipc.js');
const ORG_CONNECTOR             = require('./plugins/org/org.js');


const isDev = !app.isPackaged;
const IpcEvents = [
  'org'
];

const loadURL = serve({directory: 'site'});



onReady = async () => {
    console.log('process.en.NODE_ENV',process.env.NODE_ENV);
    let mainWindow = getOrCreateMainWindow();
    if (process.env.NODE_ENV === 'development') {
        mainWindow.loadURL('http://localhost:3000/');
    } else {
        await loadURL(mainWindow);
    }
    
}

(async () => {
    /** Init Listeners */
    ipcMainManager.initListeners(IpcEvents);
    new ORG_CONNECTOR.connector().enableEventListeners(ipcMainManager);

	if(isDev) {
        require('electron-reload')(__dirname, {
          electron: path.join(__dirname,'..','..','node_modules', '.bin', 'electron')
        })
    }


    app.whenReady().then(onReady);
    app.on('window-all-closed', () => {
        console.log('window-all-closed');
        app.quit();
    })
    /** Custom image */
    const image = nativeImage.createFromPath(
        app.getAppPath() + "/public/sfdx_gui.png"
    );
    app.dock.setIcon(image);
})();