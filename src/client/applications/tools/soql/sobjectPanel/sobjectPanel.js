import { wire, api } from 'lwc';
import ToolkitElement from 'core/toolkitElement';

import { store,connectStore,SELECTORS,DESCRIBE,UI } from 'core/store';

import Toast from 'lightning/toast';

const PAGE_LIST_SIZE    = 70;

export default class SobjectsPanel extends ToolkitElement {
    
    keyword = '';
    sobjects;
    isLoading = false;

    _rawSObjects;
    // Scrolling
    pageNumber = 1;

    @wire(connectStore, { store })
    storeChange({ describe,application }) {
        const isCurrentApp = this.verifyIsActive(application.currentApplication);
        if(!isCurrentApp) return;

        if(describe){
            this.isLoading = describe.isFetching;
            if (describe.isFetching == false && describe.error == null) {
                this._rawSObjects = Object.values(describe.nameMap).map(sobject => {
                    return {
                        ...sobject,
                        itemLabel: `${sobject.name} / ${sobject.label}`
                    };
                });
                //this.sobjects = this._rawSObjects;
                this.filterSObjects(this.keyword);
                //this.pageNumber = 1; // reset
            } else if (describe.error) {
                console.error(describe.error);
                Toast.show({
                    message: this.i18n.SOBJECTS_PANEL_FAILED_FETCH_SOBJECTS,
                    errors: describe.error
                });
            }
        }
        
    }

    

    filterSObjects(keyword) {
        if (keyword) {
            const escapedKeyword = keyword;//escapeRegExp(keyword);
            const keywordPattern = new RegExp(escapedKeyword, 'i');
            this.sobjects = this._rawSObjects.filter(sobject => {
                return keywordPattern.test(`${sobject.name} ${sobject.label}`);
            });
        } else {
            this.sobjects = this._rawSObjects;
        }
        this.pageNumber = 1; // reset
    }

    


    /** Events **/

    selectSObject(event) {
        const sObjectName = event.target.dataset.name;
        store.dispatch(UI.reduxSlice.actions.selectSObject({sObjectName}));
    }

    setKeyword(event) {
        this.keyword = event.target.value;
        this.filterSObjects(this.keyword);
    }

    handleClear() {
        this.keyword = '';
        this.filterSObjects(this.keyword);
    }

    handleScroll(event) {
        //console.log('handleScroll');
        const target = event.target;
        const scrollDiff = Math.abs(target.clientHeight - (target.scrollHeight - target.scrollTop));
        const isScrolledToBottom = scrollDiff < 5; //5px of buffer
        if (isScrolledToBottom) {
            // Fetch more data when user scrolls to the bottom
            this.pageNumber++;
        }
    }

    /** Getters */

    get isNoSObjects() {
        return !this.isLoading && (!this.sobjects || !this.sobjects.length);
    }

    get isDisplayClearButton() {
        return this.keyword !== '';
    }

    get virtualList(){
        // Best UX Improvement !!!!
        return this.sobjects.slice(0,this.pageNumber * PAGE_LIST_SIZE);
    }
}
