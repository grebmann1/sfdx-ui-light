import {api} from "lwc";
import ToolkitElement from 'core/toolkitElement';
import Toast from 'lightning/toast';
import UserExplorerNetworkModal from 'feature/UserExplorerNetworkModal'
import {chromeOpenInWindow} from 'extension/utils';
import {isEmpty, isNotUndefinedOrNull, runSilent} from "shared/utils";

export default class UserExplorerRow extends ToolkitElement {

    @api item;
    @api currentOrigin;
    hasRendered = false;

    @api get filter() {
        return this._filter;
    }

    set filter(value) {
        this._filter = value;
        if (this.hasRendered) {
            this.renderRows();
        }
    }

    /** Getters */

    get isActive() {
        return this.item?.IsActive;
    }

    get isDisabled() {
        return this.item?.Id === this.connector.conn.userInfo.id || !this.isActive;
    }

    get recordId() {
        return this.item?.Id || '';
    }

    get name() {
        return this.item?.Name || '';
    }

    get username() {
        return this.item?.Username || '';
    }

    get profile() {
        return this.item?.Profile?.Name || '';
    }

    get email() {
        return this.item?.Email || '';
    }

    get isCopyDisplayed() {
        return isNotUndefinedOrNull(this.value);
    }

    get formattedUserName() {
        if (isEmpty(this.filter)) {
            return this.username;
        }

        const regex = new RegExp('(' + this.filter + ')', 'gmi');
        if (regex.test(this.username)) {
            return this.username.toString().replace(/<?>?/, '').replace(regex, '<span style="font-weight:Bold; color:blue;">$1</span>');
        } else {
            return this.username;
        }
    }

    get formattedName() {
        if (isEmpty(this.filter)) {
            return this.name;
        }

        const regex = new RegExp('(' + this.filter + ')', 'gmi');
        if (regex.test(this.name)) {
            return this.name.toString().replace(/<?>?/, '').replace(regex, '<span style="font-weight:Bold; color:blue;">$1</span>');
        } else {
            return this.name;
        }
    }

    get formattedProfile() {
        if (isEmpty(this.filter)) {
            return this.profile;
        }

        const regex = new RegExp('(' + this.filter + ')', 'gmi');
        if (regex.test(this.profile)) {
            return this.profile.toString().replace(/<?>?/, '').replace(regex, '<span style="font-weight:Bold; color:blue;">$1</span>');
        } else {
            return this.profile;
        }
    }

    connectedCallback() {
        this.hasRendered = true;
    }

    renderedCallback() {
        this.renderRows();
    }

    /** Methods  **/
    renderRows = () => {
        this.refs.username.innerHTML = this.formattedUserName;
        this.refs.name.innerHTML = this.formattedName;
        this.refs.profile.innerHTML = this.formattedProfile;
    };

    /** Events **/

    loginAsClick = async () => {
        const query = `SELECT Id, MemberId, NetworkId,Network.Name,Network.Status FROM NetworkMember Where MemberId = '${this.recordId}' AND Network.Status = 'Live'`;
        const retUrl = '/';
        var networkMembers = await runSilent(async () => {
            return (await this.connector.conn.query(query)).records
        }, []);
        networkMembers = networkMembers.map(x => ({
            ...x,
            _redirectLink: `${this.connector.conn.instanceUrl}/servlet/servlet.su?oid=${encodeURIComponent(this.connector.configuration.orgId)}&retURL=${encodeURIComponent(retUrl)}&sunetworkid=${encodeURIComponent(x.NetworkId)}&sunetworkuserid=${encodeURIComponent(x.MemberId)}`
        }));

        const targetUrl = `${this.connector.conn.instanceUrl}/servlet/servlet.su?oid=${this.connector.configuration.orgId}&suorgadminid=${this.item.Id}&retURL=%2Fhome%2Fhome.jsp&targetURL=%2Fhome%2Fhome.jsp`;
        //this.openInAnonymousWindow(this.username,`${this.connector.frontDoorUrl}&retURL=${encodeURIComponent(targetUrl)}`);

        UserExplorerNetworkModal.open({
            username: this.username,
            frontDoorUrl: this.connector.frontDoorUrl,
            standard: this.item.Profile.UserType == 'Standard' ? `${this.connector.frontDoorUrl}&retURL=${encodeURIComponent(targetUrl)}` : '',
            networkMembers
        })
    };

    viewClick = () => {
        //console.log('this.connector.configuration',this.connector.configuration);
        const targetUrl = encodeURIComponent(`/${this.item.Id}?noredirect=1&isUserEntityOverride=1`);
        chromeOpenInWindow(
            `${this.currentOrigin}/lightning/setup/ManageUsers/page?address=${targetUrl}`,
            this.username,
            false
        )
    };

    handleCopyRecordId = () => {
        navigator.clipboard.writeText(this.recordId);
        Toast.show({
            label: 'RecordId exported to your clipboard',
            variant: 'success',
        });
    }

}