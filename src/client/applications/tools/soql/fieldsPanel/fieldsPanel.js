import { wire, api } from 'lwc';
import Toast from 'lightning/toast';
import ToolkitElement from 'core/toolkitElement';
import { store,connectStore,SELECTORS,DESCRIBE,SOBJECT,UI } from 'core/store';
import { fullApiName,lowerCaseKey } from 'shared/utils';


export default class FieldsPanel extends ToolkitElement {
    @api namespace;

    tabs = [
        {
            id: 'tab-fields',
            label: this.i18n.FIELDS_PANEL_FIELDS,
            isActive: true
        },
        {
            id: 'tab-relationships',
            label: this.i18n.FIELDS_PANEL_CHILD_REL,
            isActive: false
        }
    ];
    sobjectMeta;
    keyword = '';
    isLoading = false;

    _selectedSObject;

    connectedCallback(){}

    

    @wire(connectStore, { store })
    storeChange({ describe, sobject, ui }) {
        if(!ui.leftPanelToggled) return;
        const { selectedSObject } = ui;
        if (!selectedSObject) return;

        const fullSObjectName = lowerCaseKey(fullApiName(selectedSObject,this.namespace));
        if ( describe.nameMap && !describe.nameMap[fullSObjectName]) {
            return;
        }
        if (fullSObjectName !== this._selectedSObject) {
            this._selectedSObject = fullSObjectName;
            store.dispatch(SOBJECT.describeSObject({
                connector:this.connector.conn,
                sObjectName:this._selectedSObject
            }));
        }
        const sobjectState = SELECTORS.sobject.selectById({sobject},lowerCaseKey(this._selectedSObject));
        if (!sobjectState) return;
        this.isLoading = sobjectState.isFetching;
        // Assign Metadata
        if (sobjectState.data) {
            this.sobjectMeta = sobjectState.data;
        } else if (sobjectState.error) {
            console.error(sobjectState.error);
            Toast.show({
                message: this.i18n.FIELDS_PANEL_FAILED_DESCRIBE_OBJ,
                errors: sobjectState.error
            });
        }
    }

    deselectSObject() {
        store.dispatch(UI.reduxSlice.actions.deselectSObject());
    }


    /** Events */


    selectTab(event) {
        const tabId = event.target.dataset.id;
        this.tabs = this.tabs.map(tab => {
            return { ...tab, isActive: tab.id === tabId };
        });
    }

    setKeyword(event) {
        this.keyword = event.target.value;
    }

    handleMenuSelect(event) {
        switch (event.detail.value) {
            case 'select_all':
                store.dispatch(UI.reduxSlice.actions.selectAllFields({sObjectMeta:this.sobjectMeta}));
                break;
            case 'clear_all':
                store.dispatch(UI.reduxSlice.actions.clearAllFields());
                break;
            case 'sort_asc':
                store.dispatch(UI.reduxSlice.actions.sortFields({sort:UI.SORT.ORDER.ASC}));
                break;
            case 'sort_desc':
                store.dispatch(UI.reduxSlice.actions.sortFields({sort:UI.SORT.ORDER.DESC}));
                break;
            default:
                break;
        }
    }

    handleClear() {
        this.keyword = '';
    }
    

    /** Getters */

    get isDisplayClearButton() {
        return this.keyword !== '';
    }

    get isFieldsActive() {
        return !!this.tabs.find(tab => tab.id === 'tab-fields' && tab.isActive);
    }

    get isRelationshipsActive() {
        return !!this.tabs.find(
            tab => tab.id === 'tab-relationships' && tab.isActive
        );
    }
}