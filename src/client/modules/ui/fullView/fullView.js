import { LightningElement} from "lwc";
import LightningAlert from 'lightning/alert';
import { isUndefinedOrNull,isElectronApp } from "shared/utils";

export default class fullView extends LightningElement {

    sessionId;
    serverUrl;
    redirectUrl;
    alias;

    // For direct connection
    connector;

    connectedCallback(){
        if(isElectronApp()){
            this.alias = this.getAlias();
        }else{
            this.sessionId = this.getSessionId();
            this.serverUrl = this.getServerUrl();
            this.redirectUrl = this.getRedirectUrl();
        }
    }


    getSessionId = () => {
        return new URLSearchParams(window.location.search).get('sessionId');
    }

    getServerUrl = () => {
        return new URLSearchParams(window.location.search).get('serverUrl');
    }

    getRedirectUrl = () => {
        return new URLSearchParams(window.location.search).get('redirectUrl');
    }

    getAlias = () => {
        return new URLSearchParams(window.location.search).get('alias');
    }

}
