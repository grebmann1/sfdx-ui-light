
import { api } from 'lwc';
import FeatureElement from 'element/featureElement';
import { isUndefinedOrNull } from 'shared/utils';
import { store,selectChildRelationship} from 'soql/store';
import { store as appStore,store_application  }  from 'shared/store';

export default class OutputCell extends FeatureElement {
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
        store.dispatch(selectChildRelationship(this.value.rawData));
    }

    handleRedirection = (e) =>{
        e.preventDefault();
        e.stopPropagation();
        appStore.dispatch(store_application.navigate(this.value.data))
    }
}
