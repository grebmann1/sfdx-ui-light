import { api } from "lwc";
import ToolkitElement from 'core/toolkitElement';
import { store as legacyStore,store_application } from 'shared/store';
import { isEmpty,isElectronApp,runSilent,isNotUndefinedOrNull,isUndefinedOrNull,refreshCurrentTab,classSet } from 'shared/utils';


export default class Users extends ToolkitElement {

    @api isInjected = false;

    total_users;
    total_active;
    total_inactive;

    total_active_30days;


    connectedCallback(){
       this.init();
    }

    /** Events */

    goToUrl = (e) => {
        const redirectUrl = e.currentTarget.dataset.url;
        legacyStore.dispatch(store_application.navigate(redirectUrl));
    }


    /** methods */

    init = async () => {
        this.userInformations = await this.load_userInformations();
    }

    load_userInformations = async () => {
        let responses = await Promise.all([
            this.connector.conn.query("SELECT Count(Id) total,IsActive FROM User GROUP BY IsActive"),
            this.connector.conn.query("SELECT Count(Id) total FROM User WHERE CreatedDate = LAST_N_DAYS:30 AND IsActive = true"),
        ]);

        this.total_users    = responses[0].records.reduce((total,x) => x.total+total,0);
        this.total_active   = responses[0].records.find(x => x.IsActive)?.total || 0;
        this.total_inactive = responses[0].records.find(x => !x.IsActive)?.total || 0;
        this.total_active_30days = `+ ${responses[1].records[0]?.total || 0} (30 days)`;

    }

    /** Getters **/
    get containerClass(){
        return classSet('slds-col slds-size_1-of-1 slds-m-top_x-small')
            .add({
                'slds-small-size_1-of-2 slds-medium-size_1-of-3':!this.isInjected,
            }).toString();
    }

}