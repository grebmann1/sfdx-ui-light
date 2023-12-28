import { LightningElement} from "lwc";
import LightningAlert from 'lightning/alert';
import { isUndefinedOrNull } from "shared/utils";
import { getHostAndSession,directConnection } from 'connection/utils';

export default class extensionPopupView extends LightningElement {

    sessionId;
    serverUrl;
    isLoaded = false;

    async connectedCallback(){
        let cookie = await getHostAndSession();
        this.sessionId = cookie.session;
        this.serverUrl = cookie.domain;

        /** Set as global **/
        window.sessionId = this.sessionId;
        window.serverUrl = this.serverUrl;
        window.connector = await new window.jsforce.Connection({
            serverUrl : 'https://' + this.serverUrl,
            sessionId : this.sessionId
        })
        console.log('window.connector',window.connector);

        if(isUndefinedOrNull(this.sessionId) || isUndefinedOrNull(this.serverUrl)){
            this.sendError();
        }else{
            this.isLoaded = true;
        }
    }


    getSessionId = () => {
        return new URLSearchParams(window.location.search).get('sessionId');
    }

    getServerUrl = () => {
        return new URLSearchParams(window.location.search).get('serverUrl');
    }

    sendError = () => {
        LightningAlert.open({
            message: 'Invalid Session',
            theme: 'error', // a red theme intended for error states
            label: 'Error!', // this is the header text
        });
    }
}
