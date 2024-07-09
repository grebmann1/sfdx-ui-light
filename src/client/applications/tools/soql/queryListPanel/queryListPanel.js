import { wire, api } from 'lwc';
import ToolkitElement from 'core/toolkitElement';

import { store,connectStore,SELECTORS,DESCRIBE,SOBJECT,QUERY,UI } from 'core/store';

export default class QueryListPanel extends ToolkitElement {
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
        //console.log('Ui',UI);
        store.dispatch(UI.reduxSlice.actions.loadRecentQueries({alias:this.connector.configuration.alias}));
    }

    selectQuery(event) {
        const { key } = event.target.dataset;
        const selectedQuery = this.recentQueries.find(
            query => query.key === key
        );
        if (selectedQuery) {
            store.dispatch(UI.reduxSlice.actions.updateSoql({connector:this.connector.conn,soql:selectedQuery.soql}));
        }
    }
}
