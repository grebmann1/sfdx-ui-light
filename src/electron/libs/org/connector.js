const methods = require('./methods.js');
class ORG_CONNECTOR{
    namespace = 'org';
    constructor(){}

    enableEventListeners = (ipcMainManager) => {
        Object.keys(methods).forEach(key =>  ipcMainManager.handle(`${this.namespace}-${key}`,methods[key]));
    }
}

exports.connector = ORG_CONNECTOR;