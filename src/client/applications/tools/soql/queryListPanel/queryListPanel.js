import { wire, api } from 'lwc';
import FeatureElement from 'element/featureElement';
import {
    connectStore,
    store,
    loadRecentQueries,
    updateSoql
} from 'soql/store';

export default class QueryListPanel extends FeatureElement {
    recentQueries;
    
    @wire(connectStore, { store })
    storeChange({ ui }) {
        if (ui.recentQueries) {
            this.recentQueries = ui.recentQueries.map((query, index) => {
                return { key: `${index}`, soql: query };
            });
        }
    }

    connectedCallback() {
        store.dispatch(loadRecentQueries(this.connector.header.alias));
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
