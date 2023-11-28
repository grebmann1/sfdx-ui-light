
const {ipcMain}          = require("electron");
const {EventEmitter}     = require("events");
const {getOrCreateMainWindow} = require('./window.js');

class IpcMainManager extends EventEmitter {
    constructor() {
        super();
        this.readyWebContents = new WeakSet();
        this.messageQueue = new WeakMap();
    }

    send(channel, args, target) {
        const _target = target || getOrCreateMainWindow().webContents;
        const _args = args || [];
    
        if (!this.readyWebContents.has(_target)) {
            const existing = this.messageQueue.get(_target) || [];
            this.messageQueue.set(_target, [...existing, [channel, args]]);
            return;
        }
    
        _target.send(channel, ..._args);
    }
  
    handle(channel, listener) {
        // there can be only one, so remove previous one first
        ipcMain.removeHandler(channel);
        ipcMain.handle(channel, listener);
    }
  
    handleOnce(channel, listener) {
        ipcMain.handleOnce(channel, listener);
    }
  
}

exports.ipcMainManager = new IpcMainManager();