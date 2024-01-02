
const {
    createVSCodeProject,openVSCodeProject
} = require('./methods.js');

class CODE_CONNECTOR{
    namespace = 'code';

    constructor(){}
    enableEventListeners = (ipcMainManager) => {
        ipcMainManager.handle(`${this.namespace}-createVSCodeProject`,createVSCodeProject);
        ipcMainManager.handle(`${this.namespace}-openVSCodeProject`,openVSCodeProject);

    }
}

exports.connector = CODE_CONNECTOR;