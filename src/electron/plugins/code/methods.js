const sfdx = require('sfdx-node');
const { app,shell,dialog } = require('electron');
const { execSync } = require('child_process');
const path  = require('path');
const fs    = require('fs');

const { encodeError } = require('../../utils/errors.js');

upsert_toolkitPath = (projectPath) => {
    /** SF Tookit path */
    let sfToolkitPath = path.join(projectPath,'.sf-toolkit');
    if (fs.existsSync(sfToolkitPath)){
        // We delete the folder for clean data
        fs.rmdirSync(sfToolkitPath, { recursive: true, force: true });
    }
    fs.mkdirSync(sfToolkitPath, { recursive: true });
}

createVSCodeProject = async (_,{defaultPath}) => {
    
    try {
        let options = {
            title: "Select Folder",
            buttonLabel : "Select",
            properties:['openDirectory','createDirectory']
        };

        if(defaultPath){
            options['defaultPath'] = defaultPath;
        }
        let projectPaths = dialog.showOpenDialogSync(null,options);

        if(projectPaths === undefined) return {result:null};

        let projectPath = projectPaths[0];
    

        /** Check if contain sfdx-project.json **/
        let sfdxProjectPath = path.join(projectPath,'sfdx-project.json');
        if (!fs.existsSync(sfdxProjectPath)){
            // Create force-app
            fs.mkdirSync(path.join(sfdxProjectPath,'force-app'), { recursive: true });
            // Create copy sfdx-project.json
            fs.writeFileSync(sfdxProjectPath, fs.readFileSync(path.join(app.getAppPath(),'public/templates/sfdx-project.json')));
        }

        //upsert_toolkitPath(projectPath);

        

        return {result:{projectPath}};
    } catch (e) {
        return {error: encodeError(e)}
    }
}



openVSCodeProject = async (_,{path}) => {
    execSync(`code .`,{cwd: path}).toString();
}


module.exports = {
    createVSCodeProject,
    openVSCodeProject
}