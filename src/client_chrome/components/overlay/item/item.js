import { api } from 'lwc';
import ToolkitElement from 'core/toolkitElement';

import {
    isEmpty,
    getObjectDocLink,
    getObjectFieldsSetupLink,
    getObjectListLink,
    getObjectSetupLink,
    redirectToUrlViaChrome,
} from 'shared/utils';
import { TYPE } from 'overlay/utils';

function escapeRegExp(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export default class Item extends ToolkitElement {
    @api item;
    @api name;
    @api filter;

    isDisplayed = false;

    connectedCallback() {
        window.setTimeout(() => (this.isDisplayed = true), 0);
    }

    /** Events **/

    get currentMeddataFormat() {
        switch (this.type) {
            case TYPE.APEX_CLASS:
                return 'ApexClass';
            case TYPE.APEX_TRIGGER:
                return 'ApexTrigger';
            case TYPE.AURA:
                return 'AuraDefinitionBundle';
            case TYPE.LWC:
                return 'LightningComponentBundle';
            default:
                return undefined;
        }
    }

    handleItemClick = e => {
        const isNewTab = e.metaKey || e.ctrlKey;
        if (this.type === TYPE.OBJECT) {
            this.emitRecentObject();
        }

        switch (this.type) {
            case TYPE.APEX_CLASS:
            case TYPE.APEX_TRIGGER:
            case TYPE.AURA:
            case TYPE.LWC:
                const params = new URLSearchParams({
                    sobject: this.currentMeddataFormat,
                    param1: this.item?.id,
                    label1: this.name,
                    applicationName: 'metadata',
                });
                redirectToUrlViaChrome({
                    sessionId: this.connector.conn.accessToken,
                    serverUrl: this.connector.conn.instanceUrl,
                    baseUrl: chrome.runtime.getURL('/views/app.html'),
                    redirectUrl: encodeURIComponent(params.toString()),
                    isNewTab,
                });
                break;
            default:
                // todo: Include option to open as new tab
                const link = this.generateLink();
                if (isNewTab) {
                    window.open(link, '_blank');
                } else {
                    window.location = link;
                }
        }
    };

    emitRecentObject() {
        if (this.type !== TYPE.OBJECT) return;
        this.dispatchEvent(
            new CustomEvent('recentobject', {
                detail: { name: this.name, label: this.label },
                bubbles: true,
                composed: true,
            })
        );
    }

    handleOpenObjectList = e => {
        e.stopPropagation();
        this.emitRecentObject();
        const link = getObjectListLink({
            host: '',
            sobjectName: this.name,
            keyPrefix: this.keyPrefix,
            isCustomSetting: this.isCustomSetting,
        });
        window.open(link, '_blank', 'noopener');
    };

    handleOpenObjectFields = e => {
        e.stopPropagation();
        this.emitRecentObject();
        const link = getObjectFieldsSetupLink({
            host: '',
            sobjectName: this.name,
            durableId: this.durableId,
            isCustomSetting: this.isCustomSetting,
        });
        window.open(link, '_blank', 'noopener');
    };

    handleOpenObjectDocs = e => {
        e.stopPropagation();
        this.emitRecentObject();
        const link = getObjectDocLink(this.name, false);
        window.open(link, '_blank', 'noopener');
    };

    handleOpenObjectSetup = e => {
        e.stopPropagation();
        this.emitRecentObject();
        const link = this.generateLink();
        window.open(link, '_blank', 'noopener');
    };

    generateLink = () => {
        switch (this.type) {
            case TYPE.OBJECT:
                return getObjectSetupLink({
                    host: '',
                    sobjectName: this.name,
                    durableId: this.item?.durableId,
                    isCustomSetting: this.item?.isCustomSetting,
                });
            case TYPE.LINK:
            case TYPE.DEV_LINK:
                return this.item?.link || '#';
            case TYPE.PROFILE:
                return `/lightning/setup/EnhancedProfiles/page?address=%2F${this.item?.id}`;
            case TYPE.PERMISSION_SET:
                return `/lightning/setup/PermSets/page?address=%2F${this.item?.id}`;
            case TYPE.PERMISSION_SET_GROUP:
                return `/lightning/setup/PermSetGroups/page?address=%2F${this.item?.id}`;
            case TYPE.USER:
                const targetUrl = encodeURIComponent(
                    `/${this.item?.id}?noredirect=1&isUserEntityOverride=1`
                );
                return `/lightning/setup/ManageUsers/page?address=${targetUrl}`;
            case TYPE.APEX_TRIGGER:
                return `/lightning/setup/ApexTriggers/page?address=%2F${this.item?.id}`;
            case TYPE.APEX_CLASS:
                return `/lightning/setup/ApexClasses/page?address=%2F${this.item?.id}`;
            case TYPE.AGENTFORCE:
                return `/lightning/setup/EinsteinCopilot/${this.item?.id}/edit`;
            case TYPE.FLOW:
                return `/builder_platform_interaction/flowBuilder.app?isFromAloha=true&flowDefId=${
                    this.item?.id
                }&flowId=${this.item?.activeVersionId || this.item?.latestVersionId}`;
            default:
                return '#';
        }
    };

    /** Getters */

    get icon() {
        switch (this.type) {
            case TYPE.OBJECT:
                return 'utility:standard_objects';
            case TYPE.PROFILE:
                return 'standard:user_role';
            case TYPE.PERMISSION_SET:
                return 'standard:user_role';
            case TYPE.USER:
                return 'standard:user';
            case TYPE.APEX_TRIGGER:
                return 'standard:apex';
            case TYPE.APEX_CLASS:
                return 'standard:apex';
            case TYPE.LWC:
            case TYPE.AURA:
                return 'standard:lightning_component';
            case TYPE.FLOW:
                return 'standard:flow';
            case TYPE.LINK:
            case TYPE.DEV_LINK:
                return 'standard:link';
            case TYPE.AGENTFORCE:
                return 'standard:story';
            default:
                return 'utility:account';
        }
    }

    get iconExtraClass() {
        switch (this.type) {
            case TYPE.OBJECT:
                return 'icon-extra-object';
            default:
                return '';
        }
    }

    get type() {
        return this.item?.type;
    }

    get isObject() {
        return this.type === TYPE.OBJECT;
    }

    get apiVersion() {
        return this.item?.apiVersion;
    }

    get durableId() {
        return this.item?.durableId;
    }

    get label() {
        return this.item?.label;
    }

    get keyPrefix() {
        return this.item?.keyPrefix;
    }

    get isCustomSetting() {
        return this.item?.isCustomSetting;
    }

    get isQueryable() {
        return !!this.item?.queryable;
    }

    get isCreateable() {
        return !!this.item?.createable;
    }

    get isUpdateable() {
        return !!this.item?.updateable;
    }

    get email() {
        return this.item?.email;
    }

    get profile() {
        return this.item?.profile;
    }

    get username() {
        return this.item?.username;
    }

    get isActive() {
        return this.item?.isActive
            ? '<span class="slds-text-color_success">Active</span>'
            : '<span class="slds-text-color_error">Inactive</span>';
    }

    get descriptionArray() {
        switch (this.type) {
            case TYPE.USER:
                return [this.type, this.email, this.profile, this.isActive].filter(x => x != null);
            case TYPE.FLOW:
                return [this.type, this.apiVersion].filter(x => x != null);
            case TYPE.LINK:
                return [this.item?.section].filter(x => x != null);
            default:
                return [this.type, this.label, this.keyPrefix].filter(x => x != null);
        }
    }

    get description() {
        return this.descriptionArray.join(' • ');
    }

    get formattedTitle() {
        //Username
        switch (this.type) {
            case TYPE.USER:
                return this.name + ' • ' + this.username;
            default:
                return this.name;
        }
    }

    get formattedRichTextTitle() {
        if (!isEmpty(this.filter)) {
            // new RegExp('(?<!`)\b'+this.filter+'\b(?!`)','gim');
            const escaped = escapeRegExp(this.filter);
            const regex = new RegExp(`(${escaped})`, 'gi');
            return this.formattedTitle.replace(regex, '<span class="highlight">$1</span>');
        }
        return this.name;
    }

    get objectTitleRichText() {
        const title = this.label || this.name;
        if (isEmpty(this.filter)) {
            return title;
        }
        const regex = new RegExp(`(${escapeRegExp(this.filter)})`, 'gi');
        return String(title).replace(regex, '<span class="highlight">$1</span>');
    }

    get objectApiNameRichText() {
        const apiName = this.name;
        if (isEmpty(this.filter)) {
            return apiName;
        }
        const regex = new RegExp(`(${escapeRegExp(this.filter)})`, 'gi');
        return String(apiName).replace(regex, '<span class="highlight">$1</span>');
    }
}
