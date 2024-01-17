
const {
    getPath,getAppPath,getConfig,setConfig
} = require('./methods.js');

class UTIL_CONNECTOR{
    namespace = 'util';
    constructor(){}

    enableEventListeners = (ipcMainManager) => {
        ipcMainManager.handle(`${this.namespace}-getPath`,getPath);
        ipcMainManager.handle(`${this.namespace}-getAppPath`,getAppPath);
        ipcMainManager.handle(`${this.namespace}-getConfig`,getConfig);
        ipcMainManager.handle(`${this.namespace}-setConfig`,setConfig);
    }
}

exports.connector = UTIL_CONNECTOR;