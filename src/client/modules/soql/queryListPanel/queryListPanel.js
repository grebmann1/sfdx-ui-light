import { LightningElement, wire, api } from 'lwc';
import { I18nMixin } from 'element/i18n';
import {
    connectStore,
    store,
    loadRecentQueries,
    updateSoql
} from 'shared/store';

export default class QueryListPanel extends I18nMixin(LightningElement) {
    recentQueries;
    @api connector;

    @wire(connectStore, { store })
    storeChange({ ui }) {
        if (ui.recentQueries) {
            this.recentQueries = ui.recentQueries.map((query, index) => {
                return { key: `${index}`, soql: query };
            });
        }
    }

    connectedCallback() {
        store.dispatch(loadRecentQueries());
    }

    selectQuery(event) {
        const { key } = event.target.dataset;
        const selectedQuery = this.recentQueries.find(
            query => query.key === key
        );
        if (selectedQuery) {
            store.dispatch(updateSoql({connector:this.connector.conn,soql:selectedQuery.soql}));
        }
    }
}
