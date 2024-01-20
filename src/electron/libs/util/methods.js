const sfdx = require('sfdx-node');
const { app,shell,dialog } = require('electron');
const { encodeError } = require('../../utils/errors.js');
const Store = require('../../utils/store.js');
const commandExistsSync = require('command-exists').sync;
const { execSync } = require('child_process');
const process = require('node:process');
const fixPath = require('fix-path');



checkCommands = async () => {
    try{
        //console.log('sfdx',commandExistsSync('sfdx'));
        //console.log('sfdx2',process.env.PATH);
        //fixPath();
        //console.log('sfdx3',process.env.PATH);
        //console.log('sfdx',commandExistsSync('sfdx'));
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