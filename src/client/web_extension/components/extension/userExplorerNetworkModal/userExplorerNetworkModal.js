import LightningModal from 'lightning/modal';
import { api } from "lwc";
import { isUndefinedOrNull,isNotUndefinedOrNull,isElectronApp,isChromeExtension,decodeError,checkIfPresent } from "shared/utils";

export default class UserExplorerNetworkModal extends LightningModal {

    @api networkMembers;
    @api standard;
    @api frontDoorUrl;
    @api username;


    handleCloseClick() {
        this.close('canceled');
    }

    closeModal() {
        this.close('success');
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

    /** events **/

    handleStandardLogin = (e) => {
        e.preventDefault();
        this.openInAnonymousWindow(this.username,`${this.frontDoorUrl}&retURL=${encodeURIComponent(this.standard)}`);

    }

    /* Getters */

    get isStandardDisplayed(){
        return isNotUndefinedOrNull(this.standard);
    }

    get isNetworkMembersDisplayed(){
        return this.networkMembers.length > 0;
    }
  

    

   


}