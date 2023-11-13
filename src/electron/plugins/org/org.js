
const {
    getAllOrgs,
    openOrgUrl,
    createNewOrgAlias,
    seeDetails
} = require('./methods.js');

class ORG_CONNECTOR{
    namespace = 'org';
    constructor(){}

    enableEventListeners = (ipcMainManager) => {
        ipcMainManager.handle(`${this.namespace}-getAllOrgs`,getAllOrgs);
        ipcMainManager.handle(`${this.namespace}-openOrgUrl`,openOrgUrl);
        ipcMainManager.handle(`${this.namespace}-createNewOrgAlias`,createNewOrgAlias);
        ipcMainManager.handle(`${this.namespace}-seeDetails`,seeDetails);
    }
}

exports.connector = ORG_CONNECTOR;