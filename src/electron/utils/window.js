const { BrowserWindow,shell } = require('electron');
const path = require('path');
const Store = require('./store.js');


const store = new Store({
    configName: 'app-settings',
    defaults: {
      windowBounds: { width: 800, height: 600 }
    }
});

var browserWindows = [];

exports.browserWindows = browserWindows;


createWindow = ({parent,alwaysOnTop}) => {


	let browserWindow = BrowserWindow || null;
		browserWindow = new BrowserWindow({
			width: store.width || 1400,
			height: store.height || 900,
			parent: parent || null,
			alwaysOnTop: alwaysOnTop || false,
			minHeight: 600,
			minWidth: 600,
			acceptFirstMouse: true,
			backgroundColor: '#1d2427',
			icon: path.join(__dirname, '..', '..', 'public', 'sfdx_gui.icns'),
			show: false,
			webPreferences: {
				devTools: true,
				preload: path.join(__dirname, '..', 'preload.js'),
				allowRunningInsecureContent: true,
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

		browserWindow.on('resize', () => {
			let { width, height } = browserWindow.getBounds();
			store.set('windowBounds', { width, height });
		});

		browserWindow.on('closed', () => {
			browserWindows = browserWindows.filter((bw) => browserWindow !== bw);
			browserWindow = null;
		});

		browserWindow.webContents.on('new-window', (event, url) => {
			console.log('new-window',event, url);
			event.preventDefault();
			shell.openExternal(url);
		});

		browserWindow.webContents.on('will-navigate', (event, url) => {
			console.log('will-navigate',event, url);
			event.preventDefault();
			shell.openExternal(url);
		});
	browserWindows.push(browserWindow);
	return browserWindow;
}

exports.createMainWindow = ({isDev,url}) => {
	let browserWindow = createWindow({url});
		if (isDev) {
			browserWindow.loadURL('http://localhost:3000/app');
		} else {
			browserWindow.loadURL('https://sf-toolkit.com/app');
		}
	return browserWindow;
}

exports.createInstanceWindow = ({parent,isDev,alias,username}) => {
	console.log(`Creating Instance window`);
	let browserWindow = createWindow({});

		if (isDev) {
			browserWindow.loadURL(`http://localhost:3000/extension?alias=${encodeURIComponent(alias)}`);
		} else {
			browserWindow.loadURL(`https://sf-toolkit.com/extension?alias=${encodeURIComponent(alias)}`);
		}

		browserWindow.webContents.once('dom-ready', () => {
			browserWindow.setTitle(`${alias}:${username}`);
		});
	return browserWindow;
}