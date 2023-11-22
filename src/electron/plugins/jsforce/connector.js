
const {
    metadataList,
    metadataRead,
    sobjectDescribe,
    query
} = require('./methods.js');



class JSFORCE_CONNECTOR{
    namespace = 'jsforce';
    constructor(){}

    enableEventListeners = (ipcMainManager) => {
        ipcMainManager.handle(`${this.namespace}-metadataList`,metadataList);
        ipcMainManager.handle(`${this.namespace}-metadataRead`,metadataRead);
        ipcMainManager.handle(`${this.namespace}-sobjectDescribe`,sobjectDescribe);
        ipcMainManager.handle(`${this.namespace}-query`,query);
    }
}

exports.connector = JSFORCE_CONNECTOR;