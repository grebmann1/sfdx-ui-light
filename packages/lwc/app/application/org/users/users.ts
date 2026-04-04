import { api } from 'lwc';
import ToolkitElement from 'core/toolkitElement';
import { store as legacyStore, store_application } from 'shared/store';
export default class Users extends ToolkitElement {
    @api isInjected = false;

    total_users;
    total_active;
    total_inactive;

    total_active_30days;

    connectedCallback() {
        this.init();
    }

    /** Events */

    goToUrl = e => {
        const redirectUrl = e.currentTarget.dataset.url;
        legacyStore.dispatch(store_application.navigate(redirectUrl));
    };

    /** methods */

    init = async () => {
        await this.load_userInformations();
    };

    load_userInformations = async () => {
        let responses = await Promise.all([
            this.connector.conn.query(
                'SELECT Count(Id) total,IsActive FROM User GROUP BY IsActive'
            ),
            this.connector.conn.query(
                'SELECT Count(Id) total FROM User WHERE CreatedDate = LAST_N_DAYS:30 AND IsActive = true'
            ),
        ]);

        this.total_users = responses[0].records.reduce((total, x) => x.total + total, 0);
        this.total_active = responses[0].records.find(x => x.IsActive)?.total || 0;
        this.total_inactive = responses[0].records.find(x => !x.IsActive)?.total || 0;
        this.total_active_30days = responses[1].records[0]?.total || 0;
    };

    get activityRate() {
        if (!this.total_users) {
            return 0;
        }

        return Math.round((this.total_active / this.total_users) * 100);
    }

    get activityRateLabel() {
        return `${this.activityRate}% active`;
    }

    get growthLabel() {
        return `+${this.total_active_30days || 0} recent`;
    }

    get summaryHeadline() {
        if (!this.total_users) {
            return 'No users found';
        }

        return `${this.total_users} users, ${this.activityRate}% active`;
    }

    get summaryDescription() {
        return `${this.total_active || 0} active users, ${this.total_inactive || 0} inactive accounts, and ${this.total_active_30days || 0} active users created in the last 30 days.`;
    }
}
