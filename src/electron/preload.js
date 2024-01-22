const {ipcRenderer,contextBridge } = require('electron');


contextBridge.exposeInMainWorld('electron', {
    ipcRenderer:ipcRenderer,
    listener_on: (channel,callback) => ipcRenderer.on(channel, (_event, value) => callback(value)),
    listener_off: (channel) => ipcRenderer.removeAllListeners(channel)
})