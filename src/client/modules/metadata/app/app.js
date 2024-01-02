import { LightningElement,api} from "lwc";
import { decodeError,isNotUndefinedOrNull } from 'shared/utils';


export default class App extends LightningElement {

    @api isLoading = false;
    @api projectPath;
    @api connector;

    

    


    connectedCallback(){
        //getConfig
        this.loadPathFromConfig();
    }


    /** Methods  **/

    loadPathFromConfig = async () => {
        if(isNotUndefinedOrNull(this.connector.header.alias)){
            const {error, result} = await window.electron.ipcRenderer.invoke('util-getConfig',{key:'projectPath',configName:this.connector.header.alias});
            if (error) {
                throw decodeError(error);
            }
            this.projectPath = result;
        }
    }

    savePathToConfig = async () => {
        let {error, result} = await window.electron.ipcRenderer.invoke('util-setConfig',{key:'projectPath',value:this.projectPath,configName:this.connector.header.alias});
        if (error) {
            throw decodeError(error);
        }
    }

    selectProject = async () => {
        /** Electron **/
        let {error, result} = await window.electron.ipcRenderer.invoke('code-createVSCodeProject',{defaultPath:this.projectPath});
        if (error) {
            throw decodeError(error);
        }

        console.log('test',error,result);
        this.projectPath = result?.projectPath || null;
        this.savePathToConfig();
        


    }

    retrieveCode = async () => {

    }

    openVSCode = async () => {
        window.electron.ipcRenderer.invoke('code-openVSCodeProject',{path:this.projectPath});
    }

    handleCopy = () => {
        navigator.clipboard.writeText(this.projectPath);
    }

    


    /** Getters */

    get isPathDisplayed(){
        return isNotUndefinedOrNull(this.projectPath);
    }

    get isVSCodeDisabled(){
        return this.isLoading || !isNotUndefinedOrNull(this.projectPath);
    }
}