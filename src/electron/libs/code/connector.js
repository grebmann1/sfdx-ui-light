
const methods = require('./methods.js');

class CODE_CONNECTOR{
    namespace = 'code';
    
    constructor(){}
    enableEventListeners = (ipcMainManager) => {
        Object.keys(methods).forEach(key =>  ipcMainManager.handle(`${this.namespace}-${key}`,methods[key]));
    }
}

exports.connector = CODE_CONNECTOR;