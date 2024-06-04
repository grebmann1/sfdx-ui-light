import {api} from "lwc";
import FeatureElement from 'element/featureElement';
import { isNotUndefinedOrNull,isSalesforceId,isEmpty,isUndefinedOrNull } from "shared/utils";
export default class UserExplorerRow extends FeatureElement {

    @api item;
    @api currentOrigin;
    @api get filter(){
        return this._filter;
    }
    set filter(value){
        this._filter = value;
        if(this.hasRendered){
            this.renderRows();
        }
    }

    hasRendered = false;

    connectedCallback(){
        this.hasRendered = true;
    }

    renderedCallback() {
        this.renderRows();
    }


    /** Methods  **/
    renderRows = () => {
        this.refs.username.innerHTML    = this.formattedUserName;
        this.refs.name.innerHTML        = this.formattedName;
        this.refs.profile.innerHTML     = this.formattedProfile;
    }

    createOrAddToTabGroup = (tab, groupName,windowId) =>{
        chrome.tabGroups.query({windowId:windowId}, (groups) => {
            let group = groups.find(g => g.title === groupName);
        
            if (group) {
                // Group exists, add the tab to this group
                chrome.tabs.group({groupId: group.id, tabIds: tab.id}, () => {
                    console.log(`Tab added to existing group '${groupName}'`);
                });
            } else {
                // Group does not exist, create a new group with this tab
                chrome.tabs.group({createProperties: {}, tabIds: tab.id}, (newGroupId) => {
                    chrome.tabGroups.update(newGroupId, {title: groupName}, () => {
                        console.log(`New group '${groupName}' created and tab added`);
                    });
                });
            }
        });
    }

    openInAnonymousWindow = (groupName,targetUrl) => {
        chrome.windows.getAll({populate: false, windowTypes: ['normal']}, (windows) => {
            for (let w of windows) {
                if (w.incognito) {
                    // Use this window.
                    chrome.tabs.create({url: targetUrl, windowId: w.id},(tab) => {
                        const groupName = this.username;
                        chrome.tabs.group({createProperties: {}, tabIds: tab.id}, (newGroupId) => {
                            chrome.tabGroups.update(newGroupId, {title: groupName}, () => {
                                console.log(`New group '${groupName}' created and tab added`);
                            });
                        });
                    });
                    return;
                }
            }
            // No incognito window found, open a new one.
            chrome.windows.create({url: targetUrl, incognito: true});
        });
    }

    /** Events **/

    loginAsClick = () => {
        const targetUrl = `${this.connector.conn.instanceUrl}/servlet/servlet.su?oid=${this.connector.header.orgId}&suorgadminid=${this.item.Id}&retURL=%2Fhome%2Fhome.jsp&targetURL=%2Fhome%2Fhome.jsp`;
        this.openInAnonymousWindow(this.username,`${this.connector.frontDoorUrl}&retURL=${encodeURIComponent(targetUrl)}`);
    }

    viewClick = () => {
        const targetUrl = encodeURIComponent(`/${this.item.Id}?noredirect=1&isUserEntityOverride=1`);
        window.open(`${this.currentOrigin}/lightning/setup/ManageUsers/page?address=${targetUrl}`,'_blank');
    }


    

    /** Getters */

    get isActive(){
        return this.item?.IsActive;
    }

    get isDisabled(){
        return this.item?.Id === this.connector.conn.userInfo.id || !this.isActive;
    }

    get name(){
        return this.item?.Name || '';
    }

    get username(){
        return this.item?.Username || '';
    }

    get profile(){
        return this.item?.Profile?.Name || '';
    }

    get email(){
        return this.item?.Email || '';
    }

    get isCopyDisplayed(){
        return isNotUndefinedOrNull(this.value);
    }
    

    get formattedUserName(){
        if(isEmpty(this.filter)){
            return this.username;
        }
        
        const regex = new RegExp('('+this.filter+')','gmi');
        if(regex.test(this.username)){
            return this.username.toString().replace(/<?>?/,'').replace(regex,'<span style="font-weight:Bold; color:blue;">$1</span>');
        }else{
            return this.username;
        }
    }

    get formattedName(){
        if(isEmpty(this.filter)){
            return this.name;
        }
        
        const regex = new RegExp('('+this.filter+')','gmi');
        if(regex.test(this.name)){
            return this.name.toString().replace(/<?>?/,'').replace(regex,'<span style="font-weight:Bold; color:blue;">$1</span>');
        }else{
            return this.name;
        }
    }

    get formattedProfile(){
        if(isEmpty(this.filter)){
            return this.profile;
        }
        
        const regex = new RegExp('('+this.filter+')','gmi');
        if(regex.test(this.profile)){
            return this.profile.toString().replace(/<?>?/,'').replace(regex,'<span style="font-weight:Bold; color:blue;">$1</span>');
        }else{
            return this.profile;
        }
    }
    
}