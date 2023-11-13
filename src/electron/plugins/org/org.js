
const {
    getAllOrgs,
    openOrgUrl,
    createNewOrgAlias,
    seeDetails,
    unsetAlias,
    setAlias
} = require('./methods.js');

class ORG_CONNECTOR{
    namespace = 'org';
    constructor(){}

    enableEventListeners = (ipcMainManager) => {
        ipcMainManager.handle(`${this.namespace}-getAllOrgs`,getAllOrgs);
        ipcMainManager.handle(`${this.namespace}-openOrgUrl`,openOrgUrl);
        ipcMainManager.handle(`${this.namespace}-createNewOrgAlias`,createNewOrgAlias);
        ipcMainManager.handle(`${this.namespace}-seeDetails`,seeDetails);
        ipcMainManager.handle(`${this.namespace}-unsetAlias`,unsetAlias);
        ipcMainManager.handle(`${this.namespace}-setAlias`,setAlias);
    }
}

exports.connector = ORG_CONNECTOR;