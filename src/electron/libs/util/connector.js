
const methods = require('./methods.js');

class UTIL_CONNECTOR{
    namespace = 'util';
    constructor(){}

    enableEventListeners = (ipcMainManager) => {
        Object.keys(methods).forEach(key =>  ipcMainManager.handle(`${this.namespace}-${key}`,methods[key]));
    }
}

exports.connector = UTIL_CONNECTOR;