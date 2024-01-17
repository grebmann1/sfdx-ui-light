const sfdx = require('sfdx-node');
const { app,shell,dialog } = require('electron');
const { encodeError } = require('../../utils/errors.js');
const Store = require('../../utils/store.js');
const commandExistsSync = require('command-exists').sync;


checkCommands = async () => {
    try{
        return {
            result: {
                sfdx:commandExistsSync('sfdx'),
                java:commandExistsSync('java')
            }
        }
    }catch(e){
        return {error: encodeError(e)}
    }
}

getAppPath = async () => {
    return app.getAppPath();
}
getPath = async (_) => {
    try {
        let selectedPaths = dialog.showOpenDialogSync(null, {
            title: "Select File",
            buttonLabel : "Select",
            properties:['openDirectory','createDirectory','openFile']
        });

        let selectedPath = selectedPaths === undefined ? null:selectedPaths[0];

        return {result:selectedPath};
    } catch (e) {
        return {error: encodeError(e)}
    }
}

getConfig = async (_,{configName,key}) => {
    try {
        let store = new Store({configName});
        return {result:store.get(key)};
    } catch (e) {
        return {error: encodeError(e)}
    }
}

setConfig = async (_,{configName,key,value}) => {
    try {
        let store = new Store({configName});
            store.set(key,value);
        return {result:null};
    } catch (e) {
        return {error: encodeError(e)}
    }
}


module.exports = {
    checkCommands,
    getPath,
    getAppPath,
    getConfig,
    setConfig
}