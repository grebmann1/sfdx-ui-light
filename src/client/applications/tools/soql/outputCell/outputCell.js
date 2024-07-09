
import { api } from 'lwc';
import ToolkitElement from 'core/toolkitElement';
import { isUndefinedOrNull } from 'shared/utils';
import { store as appStore,store_application  }  from 'shared/store';
import { store,connectStore,SELECTORS,DESCRIBE,SOBJECT,UI } from 'core/store';

export default class OutputCell extends ToolkitElement {
    @api value;

    get isChildRelationship() {
        return this.value && this.value.rawData && this.value.rawData.totalSize;
    }

    get url() {
        if (!/^[0-9A-Za-z]{18}$/.test(this.value.data)) return null;
        return this.value.data;
    }

    get isDataDisplayed(){
        return isUndefinedOrNull(this.url);
    }

    /** Events */

    handleClick() {
        store.dispatch(UI.reduxSlice.actions.selectChildRelationship({childRelationship:this.value.rawData}));
    }

    handleRedirection = (e) =>{
        e.preventDefault();
        e.stopPropagation();
        appStore.dispatch(store_application.navigate(this.value.data))
    }
}
