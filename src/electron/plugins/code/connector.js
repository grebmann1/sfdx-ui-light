
const {
    createVSCodeProject,openVSCodeProject,installLatestPmd,isPmdInstalled
} = require('./methods.js');

class CODE_CONNECTOR{
    namespace = 'code';

    constructor(){}
    enableEventListeners = (ipcMainManager) => {
        ipcMainManager.handle(`${this.namespace}-createVSCodeProject`,createVSCodeProject);
        ipcMainManager.handle(`${this.namespace}-openVSCodeProject`,openVSCodeProject);
        ipcMainManager.handle(`${this.namespace}-installLatestPmd`,installLatestPmd);
        ipcMainManager.handle(`${this.namespace}-isPmdInstalled`,isPmdInstalled);
    }
}

exports.connector = CODE_CONNECTOR;