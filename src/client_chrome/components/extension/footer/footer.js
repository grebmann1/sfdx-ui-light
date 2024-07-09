import { LightningElement,wire} from "lwc";
import Toast from 'lightning/toast';
import { isUndefinedOrNull } from "shared/utils";
import {
    chromeOpenInWindow
} from 'extension/utils';

/** Store **/
import { connectStore,store,store_application } from 'shared/store';

export default class Footer extends LightningElement {

   connector;

    @wire(connectStore, { store })
    applicationChange({application}) {
        // connector
        if(application.connector){
            this.connector = null;
            this.connector = application.connector;
        }
    }

    /** Events **/

    handleCopy = () => {
        navigator.clipboard.writeText(this.usernameFormatted);
        Toast.show({
            label: 'Username exported to your clipboard',
            variant:'success',
        });
    }

    handleUsernameClick = (e) => {
        e.preventDefault();
        const targetUrl = encodeURIComponent(`/${this.connector.configuration?.userInfo?.user_id}?noredirect=1&isUserEntityOverride=1`);
        chromeOpenInWindow(
            `${this.connector.configuration?.userInfo?.urls?.custom_domain}/lightning/setup/ManageUsers/page?address=${targetUrl}`,
            this.usernameFormatted,
            false
        )
    }


    /** Getters **/

    get usernameFormatted(){
        return isUndefinedOrNull(this.connector.configuration.username)?'':`${this.connector.configuration.username}`;
    }

    get versionFormatted(){
        return isUndefinedOrNull(this.connector.configuration.version)?'':`${this.connector.configuration.version.label} (${this.connector.configuration.version.version})`;
    }
}