const sfdx = require('sfdx-node');
const { app,shell,dialog } = require('electron');
const { execSync } = require('child_process');
const path  = require('path');
const fs    = require('fs');

const { encodeError } = require('../../utils/errors.js');

const fileName      = 'pmd-dist-7.0.0-rc4-bin.zip';
const fileUrl       = 'https://github.com/pmd/pmd/releases/download/pmd_releases%2F7.0.0-rc4/';
const folderName    = 'pmd-dist-7.0.0-rc4-bin';
const binPath       = 'pmd-bin-7.0.0-rc4/bin/pmd';


const upsert_toolkitPath = (projectPath) => {
    /** SF Tookit path */
    let sfToolkitPath = path.join(projectPath,'.sf-toolkit');
    if (!fs.existsSync(sfToolkitPath)){
        fs.mkdirSync(sfToolkitPath, { recursive: true });
    }
    
    return sfToolkitPath;
}

isPmdInstalled  = async (_,{projectPath}) => {
    try {
        let pmdPath = path.join(projectPath,'.sf-toolkit',binPath);
        return {result:fs.existsSync(pmdPath)?binPath:null};
    } catch (e) {
        return {error: encodeError(e)}
    }
}

installLatestPmd = async (_,{projectPath}) => {
    
    
    try {
        // Create hidden toolkit folder
        let sfToolkitPath = upsert_toolkitPath(projectPath);
        
        // Download PMD file if not there
        if(!fs.existsSync(path.join(sfToolkitPath,binPath))){
            execSync(`curl -OL ${fileUrl}/${fileName}`,{cwd: sfToolkitPath}).toString();
            execSync(`unzip ${fileName}`,{cwd: sfToolkitPath}).toString();
            execSync(`rm ${fileName}`,{cwd: sfToolkitPath}).toString();
        }

        // Clone Rule Set (Force overwrite)
        fs.mkdirSync(path.join(sfToolkitPath,'pmd/rulesets/apex'), { recursive: true });
        fs.writeFileSync(path.join(sfToolkitPath,'pmd/rulesets/apex/quickstart.xml'), fs.readFileSync(path.join(app.getAppPath(),'public/templates/pmd/rulesets/apex/quickstart.xml')));
        

        return {result:binPath};
    } catch (e) {
        return {error: encodeError(e)}
    }
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

        // if empty, return null
        if(projectPaths === undefined) return {result:null};

        const projectPath     = projectPaths[0];
        const sfdxProjectPath = path.join(projectPath,'sfdx-project.json');
        /** Check if contain sfdx-project.json **/
        if (!fs.existsSync(sfdxProjectPath)){
            // Create force-app
            fs.mkdirSync(path.join(projectPath,'force-app'), { recursive: true });
            // Create copy sfdx-project.json
            fs.writeFileSync(sfdxProjectPath, fs.readFileSync(path.join(app.getAppPath(),'public/templates/sfdx-project.json')));
        }

        // Create hidden toolkit folder
        upsert_toolkitPath(projectPath);

        

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
    openVSCodeProject,
    installLatestPmd,
    isPmdInstalled
}