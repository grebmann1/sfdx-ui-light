import { api, track } from 'lwc';
import ToolkitElement from 'core/toolkitElement';
import {
    isEmpty,
    isElectronApp,
    classSet,
    isUndefinedOrNull,
    isNotUndefinedOrNull,
    runActionAfterTimeOut,
    formatFiles,
    sortObjectsByField,
    removeDuplicates,
} from 'shared/utils';

const defaultConfig = {
    isOpen: false,
};

export default class Card extends ToolkitElement {
    @api item;
    @api isOpen = false;

    @track config;

    connectedCallback() {
        this.initSettings();
    }

    /** Methods **/
    initSettings = () => {
        const _configText = localStorage.getItem(this.configName);
        this.config = defaultConfig;
        try {
            if (isNotUndefinedOrNull(_configText)) {
                this.config = JSON.parse(_configText);
            }
        } catch (e) {
            console.error('Issue in card config !');
        }
        // Process
        if (this.config.isOpen) {
            this.isOpen = true;
        }
    };

    saveConfig = () => {
        localStorage.setItem(this.configName, JSON.stringify(this.config));
    };

    /** events **/

    handleCardHeaderClick = e => {
        e.stopPropagation();
        e.preventDefault();
        this.isOpen = !this.isOpen;
        this.config.isOpen = this.isOpen; // copy to config;
        this.saveConfig();
    };

    dummyCardMenuClick = e => {
        e.stopPropagation();
        e.preventDefault();
    };

    /** getters */

    get cardContainerClass() {
        return classSet('card-container')
            .add({
                'card-container-orgfarm': this.isOrgFarmGroup,
            })
            .toString();
    }

    get isOrgFarmGroup() {
        const title = (this.title || '').toString().toLowerCase();
        return title.includes('orgfarm');
    }

    get isOpenFormatted() {
        return this.isOpen && this.items.length > 0;
    }

    get cardItemsClass() {
        return classSet('card-items')
            .add({
                'slds-is-open': this.isOpenFormatted,
                'slds-hide': !this.isOpenFormatted,
            })
            .toString();
    }

    get buttonIcon() {
        return this.isOpenFormatted ? 'utility:chevrondown' : 'utility:chevronright';
    }

    get configName() {
        return `card-${this.title}`;
    }

    get title() {
        return this.item?.title || 'Default';
    }

    get items() {
        return this.item?.items || [];
    }

    get itemMessage() {
        return `${this.items.length} orgs`;
    }
}
