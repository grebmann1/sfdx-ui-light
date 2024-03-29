import { LightningElement} from "lwc";
import LightningAlert from 'lightning/alert';
import { isUndefinedOrNull,isElectronApp } from "shared/utils";

export default class directView extends LightningElement {

    sessionId;
    serverUrl;
    alias;

    connectedCallback(){
        if(isElectronApp()){
            this.alias = this.getAlias();
        }else{
            this.sessionId = this.getSessionId();
            this.serverUrl = this.getServerUrl();
            if(isUndefinedOrNull(this.sessionId) || isUndefinedOrNull(this.serverUrl)){
                this.sendError();
            }
        }
    }
    


    getSessionId = () => {
        return new URLSearchParams(window.location.search).get('sessionId');
    }

    getServerUrl = () => {
        return new URLSearchParams(window.location.search).get('serverUrl');
    }

    getAlias = () => {
        return new URLSearchParams(window.location.search).get('alias');
    }

    sendError = () => {
        LightningAlert.open({
            message: 'Invalid Session',
            theme: 'error', // a red theme intended for error states
            label: 'Error!', // this is the header text
        });
    }
}
