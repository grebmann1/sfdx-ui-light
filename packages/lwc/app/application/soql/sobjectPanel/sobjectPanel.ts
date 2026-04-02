import { wire } from 'lwc';
import ToolkitElement from 'core/toolkitElement';

import { store, connectStore, DESCRIBE, UI } from 'core/store';
import { lowerCaseKey } from 'shared/utils';

export default class SobjectsPanel extends ToolkitElement {
    sobjects;
    isLoading = false;
    selectedId = '';

    _rawSObjects;

    @wire(connectStore, { store })
    storeChange({ describe, application, ui }) {
        const isCurrentApp = this.verifyIsActive(application?.currentApplication);
        if (!isCurrentApp) return;

        this.selectedId = ui?.selectedSObject ? lowerCaseKey(ui.selectedSObject) : '';

        if (describe) {
            this.isLoading = describe.isFetching;
            if (describe.isFetching === false && describe.error == null) {
                this._rawSObjects = Object.values(describe.nameMap || {}).map(sobject => ({
                    ...sobject,
                    itemLabel: `${sobject.name} / ${sobject.label}`,
                }));
                this.sobjects = this._rawSObjects;
            }
        }
    }

    /** Events */

    handleTreeSelect(event) {
        const item = event.detail?.item;
        if (item?.rawName) {
            store.dispatch(UI.reduxSlice.actions.selectSObject({ sObjectName: item.rawName }));
        }
    }

    handleRefresh() {
        store.dispatch(
            DESCRIBE.describeSObjects({
                connector: this.connector.conn,
            })
        );
    }

    /** Getters */

    get computedTree() {
        if (!this.sobjects || !this.sobjects.length) {
            return [];
        }
        return this.sobjects
            .filter(sobject => sobject.queryable)
            .map(sobject => ({
                id: lowerCaseKey(sobject.name),
                name: sobject.itemLabel,
                title: sobject.itemLabel,
                rawName: sobject.name,
                icon: 'utility:record_lookup',
            }));
    }

    get sobjectSearchFields() {
        return ['name', 'id'];
    }

    get minSearchLength() {
        return 1;
    }
}
