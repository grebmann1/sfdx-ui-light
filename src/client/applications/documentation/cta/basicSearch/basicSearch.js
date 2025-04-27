import { api, LightningElement } from 'lwc';
import { isEmpty, runActionAfterTimeOut } from 'shared/utils';

export default class BasicSearch extends LightningElement {
    handleFilter = e => {
        runActionAfterTimeOut(
            e.target.value,
            async newValue => {
                var result = [];
                if (!isEmpty(newValue)) {
                    result = await this.getFilteredItems(newValue);
                }
                this.dispatchEvent(
                    new CustomEvent('filter', {
                        detail: { value: result, keywords: newValue },
                        bubbles: true,
                        composed: true,
                    })
                );
            },
            { timeout: 500 }
        );
    };

    getFilteredItems = async value => {
        return await (await fetch(`/cta/search?keywords=${encodeURIComponent(value)}`)).json();
    };
}
