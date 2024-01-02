const {ipcRenderer,contextBridge } = require('electron');
contextBridge.exposeInMainWorld('electron', {
    ipcRenderer:ipcRenderer
})