import { LightningElement, api, track } from 'lwc';
import { normalizeString, generateUniqueId } from 'shared/utils';

const tabClassPrefixByVariant = {
    scoped: 'slds-tabs_scoped',
    vertical: 'slds-vertical-tabs',
    standard: 'slds-tabs_default',
};

export default class SldsTabset extends LightningElement {
    @api title;

    @api isAddTabEnabled = false;
    @api isRemoveTabEventDisabled = false;
    @api isRemoveTabDisabled = false;

    @track _variant = 'standard';

    @track _tabHeaders = [];
    connectedCallback() {
        this._tabByValue = {};
        this._connected = true;
    }

    disconnectedCallback() {
        this._connected = false;
    }

    @api get variant() {
        return this._variant;
    }

    set variant(value) {
        this._variant = normalizeString(value, {
            fallbackValue: 'standard',
            validValues: ['scoped', 'vertical', 'standard'],
        });
    }

    @api get activeTabValue() {
        return this._activeTabValue;
    }

    set activeTabValue(tabValue) {
        const newTabValue = tabValue && String(tabValue);
        if (!newTabValue || this._activeTabValue === newTabValue) {
            return;
        }

        if (this._connected) {
            const tab = this._tabByValue[tabValue];
            if (tab) {
                this._selectTab(tabValue);
            }
        } else {
            this._activeTabValue = newTabValue;
        }
    }

    handleTabRegister(event) {
        event.stopPropagation();

        const tab = event.target;

        tab.role = 'tabpanel';
        const generatedUniqueId = generateUniqueId('tab');
        if (!tab.id) {
            tab.id = generatedUniqueId;
        }

        if (!tab.value) {
            tab.value = generatedUniqueId;
        }
        const tabValue = tab.value;

        tab.dataTabValue = tabValue;
        tab.ariaLabelledBy = tabValue + '__item';

        tab.classList.add(`${tabClassPrefixByVariant[this.variant]}__content`);

        tab.classList.add('slds-hide');
        tab.classList.remove('slds-show');

        const tabs = this.querySelectorAll(`[role='tabpanel']`);
        let tabIndex;
        for (tabIndex = 0; tabIndex < tabs.length; tabIndex++) {
            if (tabs[tabIndex].dataTabValue === tabValue) {
                break;
            }
        }

        event.detail.setDeRegistrationCallback(() => {
            if (!this._connected) {
                return;
            }
            //console.log('Deregistration callback');
            const index = this._tabHeaders.findIndex(existingTab => existingTab.value === tabValue);

            if (index >= 0) {
                this._tabHeaders.splice(index, 1);

                this._updateTabBarHeaders(this._tabHeaders);

                this._tabByValue[tabValue] = undefined;
                if (
                    this._activeTabValue === tab.value &&
                    this._tabHeaders.length > 0 &&
                    !this.isRemoveTabEventDisabled // To avoid selection controlled by the tab
                ) {
                    this._showTabContentForTabValue(this._tabHeaders[0].value);
                }
            }
        });

        this._tabHeaders.splice(tabIndex, 0, {
            value: tabValue,
            label: tab.label,
            domId: tab.id,
            title: tab.title,
            iconName: tab.iconName,
            isCloseable: tab.isCloseable,
            isDraft: tab.isDraft,
            counter: tab.counter,
            badgeColor: tab.badgeColor,
            badgePositionClass: tab.badgePositionClass,
            iconAlternativeText: tab.iconAssistiveText,
            endIconName: tab.endIconName,
            endIconAlternativeText: tab.endIconAlternativeText,
            showErrorIndicator: tab.showErrorIndicator,
            isAddTabEnabled: tab.isAddTabEnabled,
        });

        this._updateTabBarHeaders(this._tabHeaders);

        this._tabByValue[tabValue] = tab;

        if (!this._activeTabValue) {
            this._activeTabValue = tab.value;
        }

        if (this._activeTabValue === tab.value) {
            this._selectTab(tabValue);
        }
    }

    _selectTab(value) {
        this._selectTabHeaderByTabValue(value);
        this._showTabContentForTabValue(value);
    }

    _showTabContentForTabValue(value) {
        const tab = this._tabByValue[value];
        if (!tab) {
            return;
        }

        if (this._activeTabValue) {
            const currentTab = this._tabByValue[this._activeTabValue];
            if (currentTab) {
                currentTab.classList.add('slds-hide');
                currentTab.classList.remove('slds-show');
            }
        }
        this._activeTabValue = tab.value;
        tab.classList.add('slds-show');
        tab.classList.remove('slds-hide');
        tab.loadContent();
    }

    _selectTabHeaderByTabValue(value) {
        if (!this._connected) {
            return;
        }

        const tabBar = this.template.querySelector('slds-tab-bar');
        tabBar.selectTabByValue(value);
    }

    handleTabSelected(event) {
        const selectedTabValue = event.detail.value;
        const tab = this._tabByValue[selectedTabValue];
        if (this._activeTabValue !== tab.value) {
            this._showTabContentForTabValue(selectedTabValue);
        }
    }

    handleTabDataChange(event) {
        const changedTab = event.target;
        const newTabValue = changedTab.value;
        const currentTabValue = changedTab.dataTabValue;
        const matchingTabHeader = this._tabHeaders.find(
            tabHeader => tabHeader.value === currentTabValue
        );

        if (matchingTabHeader) {
            matchingTabHeader.label = changedTab.label;
            matchingTabHeader.value = newTabValue;
            matchingTabHeader.title = changedTab.title;
            matchingTabHeader.iconName = changedTab.iconName;
            matchingTabHeader.counter = changedTab.counter;
            matchingTabHeader.badgeColor = changedTab.badgeColor;
            matchingTabHeader.badgePositionClass = changedTab.badgePositionClass;
            matchingTabHeader.isCloseable = changedTab.isCloseable;
            matchingTabHeader.isDraft = changedTab.isDraft;
            matchingTabHeader.iconAlternativeText = changedTab.iconAssistiveText;
            matchingTabHeader.endIconName = changedTab.endIconName;
            matchingTabHeader.endIconAlternativeText = changedTab.endIconAlternativeText;
            matchingTabHeader.showErrorIndicator = changedTab.showErrorIndicator;
            matchingTabHeader.isAddTabEnabled = changedTab.isAddTabEnabled;
        }

        this._updateTabBarHeaders(this._tabHeaders);

        if (currentTabValue !== newTabValue) {
            const tab = this._tabByValue[currentTabValue];
            if (tab) {
                tab.dataTabValue = newTabValue;
                this._tabByValue[newTabValue] = this._tabByValue[currentTabValue];

                this._tabByValue[currentTabValue] = undefined;
            }
            if (this._activeTabValue === currentTabValue) {
                this._activeTabValue = newTabValue;
            }
        }
    }

    _updateTabBarHeaders(headers) {
        this.template.querySelector('slds-tab-bar').tabHeaders = headers.slice();
    }

    get computedClass() {
        return tabClassPrefixByVariant[this.variant];
    }

    @api
    focus() {
        this.template.querySelector('slds-tab-bar').focus();
    }

    get isAddTabDisplayed() {
        return this.isAddTabEnabled;
    }
}
