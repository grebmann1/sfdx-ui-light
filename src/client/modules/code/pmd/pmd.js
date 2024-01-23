import { api } from "lwc";
import { decodeError,isNotUndefinedOrNull,isUndefinedOrNull } from 'shared/utils';
import FeatureElement from 'element/featureElement';

export default class Pmd extends FeatureElement {

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
        console.info('installLatestPMD',result);
        this.checkIfPmdInstalled();
    }

    runSfdxAnalyzer = async () => {
        const {error, result} = await window.electron.ipcRenderer.invoke('code-runSfdxAnalyzer',{alias:this.connector.header.alias});
        if (error) {
            throw decodeError(error);
        }
        console.info('runSfdxAnalyzer',result);
        //this.checkIfPmdInstalled();
        window.electron.listener_on('update-from-worker',(value) => {
            if(value.action === 'done'){
                this.metadata = value.data;
                window.electron.listener_off('update-from-worker')
            }else if(value.action === 'error'){
                throw decodeError(value.error);
            }
            this.isLoading = false;
        })
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