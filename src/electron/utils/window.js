const { BrowserWindow,shell } = require('electron');
const path = require('path');

let browserWindows = [];

exports.browserWindows;
exports.createMainWindow = createMainWindow = () => {

    console.log(`Creating main window`);

    let browserWindow = BrowserWindow || null;
        browserWindow = new BrowserWindow({
            width: 1400,
            height: 900,
            minHeight: 600,
            minWidth: 600,
            acceptFirstMouse: true,
            backgroundColor: '#1d2427',
            icon:path.join(__dirname, '..','..', 'public', 'sfdx_gui.icns'),
            show:false,
            webPreferences: {
                devTools:true,
                preload: path.join(__dirname,'..','preload.js'),
                allowRunningInsecureContent:true,
                webviewTag: false,
                nodeIntegration: true,
                contextIsolation: true,
            }
        });

    browserWindow.webContents.once('dom-ready', () => {
        if (browserWindow) {
        browserWindow.show();
        /** To handle later to have right click menu */
        //createContextMenu(browserWindow);
        }
    });
  
    browserWindow.on('focus', () => {
      if (browserWindow) {
        //ipcMainManager.send(IpcEvents.SET_SHOW_ME_TEMPLATE);
      }
    });
  
    browserWindow.on('closed', () => {
      browserWindows = browserWindows.filter((bw) => browserWindow !== bw);
      browserWindow = null;
    });
  
    browserWindow.webContents.on('new-window', (event, url) => {
      event.preventDefault();
      shell.openExternal(url);
    });
  
    browserWindow.webContents.on('will-navigate', (event, url) => {
      event.preventDefault();
      shell.openExternal(url);
    });
  
    
    browserWindows.push(browserWindow);

    browserWindow.webContents.openDevTools()
  
    return browserWindow;
}

exports.getOrCreateMainWindow = getOrCreateMainWindow = (url) => {
    return (
      BrowserWindow.getFocusedWindow() || browserWindows[0] || createMainWindow(url)
    );
}