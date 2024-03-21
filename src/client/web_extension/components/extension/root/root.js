import { LightningElement,api } from "lwc";
import LightningAlert from 'lightning/alert';
import { isUndefinedOrNull } from "shared/utils";
import { directConnect,getHostAndSession } from 'connection/utils';

export default class root extends LightningElement {

    @api variant;
    sessionId;
    serverUrl;
    versions = [];
    version;
    hasLoaded = false;

    async connectedCallback(){
        let cookie = await getHostAndSession();
        if(cookie){
            this.init_existingSession(cookie);
        }else{
            this.init_default();
        }
    }

    init_default = () => {
        this.hasLoaded = true;
    }

    init_existingSession = async (cookie) => {
        this.sessionId = cookie.session;
        this.serverUrl = cookie.domain;

        /** Set as global **/
        window.sessionId = this.sessionId;
        window.serverUrl = this.serverUrl;
        window.connector = await directConnect(this.sessionId,'https://' + this.serverUrl);

        this.versions = (await window.connector.conn.request('/services/data/')).sort((a, b) => b.version.localeCompare(a.version));
        this.version = this.versions[0];

        // Initialize;
        window.connector.version = this.version.version;

        if(isUndefinedOrNull(this.sessionId) || isUndefinedOrNull(this.serverUrl)){
            this.sendError();
        }else{
            this.hasLoaded = true;
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
