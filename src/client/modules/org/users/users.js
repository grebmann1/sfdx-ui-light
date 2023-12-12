import { LightningElement,api} from "lwc";
import { isEmpty } from 'shared/utils';


export default class Users extends LightningElement {

    @api connector;

    total_users;
    total_active;
    total_inactive;

    total_users_30days;


    async connectedCallback(){
        this.userInformations = await this.load_userInformations();
    }

    load_userInformations = async () => {
        let responses = await Promise.all([
            this.connector.conn.query("SELECT Count(Id) total,IsActive FROM User GROUP BY IsActive"),
            this.connector.conn.query("SELECT Count(Id) total FROM User WHERE CreatedDate = LAST_N_DAYS:30"),
        ]);

        this.total_users    = responses[0].records.reduce((total,x) => x.total+total,0);
        this.total_active   = responses[0].records.find(x => x.IsActive).total;
        this.total_inactive = responses[0].records.find(x => !x.IsActive).total;
        this.total_users_30days = `+ ${responses[1].records[0].total}`;

    }


}