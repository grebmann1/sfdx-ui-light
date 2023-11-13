const { app,nativeImage } = require('electron');
const path = require('path');
const {getOrCreateMainWindow} = require('./utils/window.js');
const { ipcMainManager }  = require('./utils/ipc.js');
const isDev = !app.isPackaged;

const ORG_CONNECTOR = require('./plugins/org/org.js');

const IpcEvents = [
  'core-alias'
]



onReady = () => {
    getOrCreateMainWindow({url:'http://localhost:3000/'});
    ipcMainManager.initListeners(IpcEvents);
    new ORG_CONNECTOR.connector().enableEventListeners(ipcMainManager);
    /* Temporary for coding test */
    //getOrCreateToolWindowForTest();
} 
  
main = () => {
  
    if(isDev) {
      require('electron-reload')(__dirname, {
        electron: path.join(__dirname,'..','..','node_modules', '.bin', 'electron')
      })
    }
    app.whenReady().then(onReady);

    app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') app.quit();
    })
  
  
    /** Custom image */
    const image = nativeImage.createFromPath(
      app.getAppPath() + "/public/sfdx_gui.png"
    );
    app.dock.setIcon(image);
}
  
/** Executing here !!!! */
  
main();