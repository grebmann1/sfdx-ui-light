
const {
    metadataList,
    metadataRead,
    describeSobject
} = require('./methods.js');



class JSFORCE_CONNECTOR{
    namespace = 'jsforce';
    constructor(){}

    enableEventListeners = (ipcMainManager) => {
        ipcMainManager.handle(`${this.namespace}-metadataList`,metadataList);
        ipcMainManager.handle(`${this.namespace}-metadataRead`,metadataRead);
        ipcMainManager.handle(`${this.namespace}-describeSobject`,describeSobject);
    }
}

exports.connector = JSFORCE_CONNECTOR;