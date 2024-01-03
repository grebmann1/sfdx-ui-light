import { LightningElement,api} from "lwc";
import { decodeError,isNotUndefinedOrNull,isUndefinedOrNull } from 'shared/utils';

export default class Pmd extends LightningElement {

    
    @api pmdPath;

    _projectPath;
    @api
    get projectPath(){
        return this._projectPath;
    }
    set projectPath(value){
        this._projectPath = value;
        if(isNotUndefinedOrNull(value)){
            this.checkIfPmdInstalled();
        }
    }

    connectedCallback(){
        
    }

    /** Methods  **/

    handleCopy = () => {
        navigator.clipboard.writeText(this.pmdPath);
    }

    checkIfPmdInstalled = async () => {
        console.log('checkIfPmdInstalled');
        const {error, result} = await window.electron.ipcRenderer.invoke('code-isPmdInstalled',{projectPath:this.projectPath});
        if (error) {
            throw decodeError(error);
        }
        this.pmdPath = isNotUndefinedOrNull(result)?`${result}/bin/pmd`:null;
    }

    installLatestPMD = async() => {
        const {error, result} = await window.electron.ipcRenderer.invoke('code-installLatestPmd',{projectPath:this.projectPath});
        if (error) {
            throw decodeError(error);
        }

    }


    /** Getters **/

    get installPMDLabel(){
        return this.isPmdInstalled?'PMD Already Installed':'Install PMD in your project';
    }

    get isPmdInstalled(){
        return isNotUndefinedOrNull(this.pmdPath);
    }


    get isButtonDisabled(){
        return isUndefinedOrNull(this.projectPath) || this.isPmdInstalled;
    }

    get pmdPathFormatted(){
        return isUndefinedOrNull(this.pmdPath)?'pmd':this.pmdPath;
    }
}