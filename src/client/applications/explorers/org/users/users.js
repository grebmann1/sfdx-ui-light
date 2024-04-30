import { api } from "lwc";
import FeatureElement from 'element/featureElement';
import { store,store_application } from 'shared/store';


export default class Users extends FeatureElement {
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
        store.dispatch(store_application.navigate(redirectUrl));
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


}