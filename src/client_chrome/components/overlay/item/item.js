import { api } from "lwc";
import ToolkitElement from 'core/toolkitElement';
import Toast from 'lightning/toast';

import { isEmpty,isElectronApp,classSet,isNotUndefinedOrNull,runActionAfterTimeOut,guid } from 'shared/utils';
import { TYPE } from 'overlay/utils';
import {
    getCurrentObjectType,
    getCurrentTab,
    getObjectDocLink,
    getObjectFieldsSetupLink,
    getObjectListLink,
    getObjectSetupLink,
    getRecordTypesLink,
    redirectToUrlViaChrome
} from "extension/utils";

export default class Item extends ToolkitElement {
    @api item;
    @api name;
    @api filter;

    isDisplayed = false;

    connectedCallback(){
        window.setTimeout(() => this.isDisplayed = true,0);
    }

    /** Events **/

    get currentMeddataFormat(){
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

    handleItemClick = (e) => {
        switch (this.type) {
            case TYPE.APEX_CLASS:
            case TYPE.APEX_TRIGGER:
            case TYPE.AURA:
            case TYPE.LWC:
                const params = new URLSearchParams({
                    sobject: this.currentMeddataFormat,
                    param1: this.item?.id,
                    label1: this.name,
                    applicationName: 'metadata'
                });
                redirectToUrlViaChrome({
                    sessionId: this.connector.conn.accessToken,
                    serverUrl: this.connector.conn.instanceUrl,
                    baseUrl: chrome.runtime.getURL('/views/app.html'),
                    redirectUrl:encodeURIComponent(params.toString())
                })
            break;
            default:
                // todo: Include option to open as new tab
                const link = this.generateLink();
                window.location = link;
        }
    }

    generateLink = () => {
        switch (this.type){
            case TYPE.OBJECT:
                return getObjectSetupLink({
                    host: '',
                    sobjectName: this.name,
                    durableId: this.item?.durableId,
                    isCustomSetting: this.item?.isCustomSetting,
                    keyPrefix: this.metadata?.keyPrefix
                });
            case TYPE.LINK:
                return this.item?.link || '#';
            case TYPE.PROFILE:
                return `/lightning/setup/EnhancedProfiles/page?address=%2F${this.item?.id}`;
            case TYPE.PERMISSION_SET:
                return `/lightning/setup/PermSets/page?address=%2F${this.item?.id}`;
            case TYPE.PERMISSION_SET_GROUP:
                return `/lightning/setup/PermSetGroups/page?address=%2F${this.item?.id}`;
            case TYPE.USER:
                const targetUrl = encodeURIComponent(`/${this.item?.id}?noredirect=1&isUserEntityOverride=1`);
                return `/lightning/setup/ManageUsers/page?address=${targetUrl}`;
            case TYPE.APEX_TRIGGER:
                return `/lightning/setup/ApexTriggers/page?address=%2F${this.item?.id}`;
            case TYPE.APEX_CLASS:
                return `/lightning/setup/ApexClasses/page?address=%2F${this.item?.id}`;
            case TYPE.FLOW:
                return `/builder_platform_interaction/flowBuilder.app?isFromAloha=true&flowDefId=${this.item?.id}&flowId=${this.item?.activeVersionId || this.item?.latestVersionId}`;
            default:
                return '#';
        }
    }


    /** Getters */


    get icon(){
        switch (this.type){
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
                return 'standard:link';
            default:
                return 'utility:account';
        }
    }

    get iconExtraClass(){
        switch (this.type){
            case TYPE.OBJECT:
                return 'icon-extra-object';
            default:
                return '';
        }
    }

    get type(){
        return this.item?.type;
    }

    get apiVersion(){
        return this.item?.apiVersion;
    }

    get durableId(){
        return this.item?.durableId
    }

    get label(){
        return this.item?.label;
    }

    get keyPrefix(){
        return this.item?.keyPrefix;
    }

    get isCustomSetting(){
        return this.item?.isCustomSetting;
    }

    get email(){
        return this.item?.email;
    }

    get profile(){
        return this.item?.profile;
    }

    get username(){
        return this.item?.username;
    }

    get isActive(){
        return this.item?.isActive ? '<span class="slds-text-color_success">Active</span>':'<span class="slds-text-color_error">Inactive</span>';
    }

    get descriptionArray(){
        switch (this.type){
            case TYPE.USER:
                return [this.type,this.email,this.profile,this.isActive].filter(x => x != null);
            case TYPE.FLOW:
                return [this.type,this.apiVersion].filter(x => x != null);
            case TYPE.LINK:
                return [this.item?.section].filter(x => x != null);
            default:
                return [this.type,this.label,this.keyPrefix].filter(x => x != null);
        }
    }

    get description(){
        return this.descriptionArray.join(' • ');
    }

    get formattedTitle(){
        //Username
        switch (this.type){
            case TYPE.USER:
                return this.name+' • '+this.username;
            default:
                return this.name;
        }
    }

    get formattedRichTextTitle(){
        if(!isEmpty(this.filter)){ // new RegExp('(?<!`)\b'+this.filter+'\b(?!`)','gim');
            const regex = new RegExp('('+this.filter+')','gi')
            if(regex.test(this.formattedTitle)){
                return this.formattedTitle.replace(/<?>?/,'').replace(regex,'<span style="font-weight:Bold; color:blue;">$1</span>');
            }
        }
        return this.name;
    }
}