import { api, track } from 'lwc';
import Toast from 'lightning/toast';
import ToolkitElement from 'core/toolkitElement';
import ConnectionNewModal from 'connection/connectionNewModal';
import { getConfigurations,OAUTH_TYPES } from 'connection/utils';

import {
    isEmpty,
    isChromeExtension,
    classSet,
    isUndefinedOrNull,
    isNotUndefinedOrNull,
} from 'shared/utils';

const SALESFORCE_SANDBOX_HOST = 'sandbox.my.salesforce.com';
const SALESFORCE_HOST = ['my.salesforce.com', 'my.stm.salesforce.com'];
export default class QuickAuthorize extends ToolkitElement {
    @api instanceUrl;

    @track connections;
    @track exclusionList = [];

    async connectedCallback() {
        this.connections = await getConfigurations();
        //this.exclusionList = this.getExclusionList();
    }

    /** events **/

    addConnection_authorize = async () => {
        const instanceUrl = new URL(this.instanceUrl);
        const newAliasObject = this.generateNewAlias(instanceUrl.hostname);
        let params = {
            connections: this.connections,
            alias: newAliasObject.alias,
            selectedDomain: 'custom',
            customDomain: instanceUrl.host, // Can't use hostname here because it might miss the port
            selectedCategory: [
                {
                    id: newAliasObject.category,
                    icon: 'standard:category',
                    title: newAliasObject.category,
                },
            ],
            name: newAliasObject.name,
        };
        if(this.isInternalDevOrg){
            //console.log('addConnection_authorize - this.connector.conn', this.connector);
            params.credentialType = OAUTH_TYPES.USERNAME;
            params.username = this.connector.configuration.username;
        }else{
            params.credentialType = OAUTH_TYPES.OAUTH;
        }

        ConnectionNewModal.open({
            ...params,
            size: isChromeExtension() ? 'full' : 'medium',
        }).then(async res => {
            console.log('addConnection_authorize - res', res);
            if (isNotUndefinedOrNull(res)) {
                Toast.show({
                    label: `${res?.configuration?.alias || res?.alias} has been added.`,
                    //message: 'Exported to your clipboard', // Message is hidden in small screen
                    variant: 'success',
                });
            }
            // Reset Connections
            let _newConnections = await getConfigurations();
            this.connections = null;
            this.connections = _newConnections;
        });
    };

    addConnection_hide = () => {
        if (isEmpty(this.instanceUrl)) return;
        this.exclusionList.push(new URL(this.instanceUrl).hostname);
        this.setExclusionList(this.exclusionList);
    };

    /** Methods **/

    getExclusionList = () => {
        const toExcludeText = localStorage.getItem(`QUICK_AUTHORIZE_EXCLUSION_LIST`);
        var toExclude = [];
        if (toExcludeText && toExcludeText != '') {
            toExclude = JSON.parse(toExcludeText);
        }
        return toExclude;
    };

    setExclusionList = async exclusionList => {
        localStorage.setItem(`QUICK_AUTHORIZE_EXCLUSION_LIST`, JSON.stringify(exclusionList));
    };

    load_orgInformations = async () => {
        let response = await this.connector.conn.query(
            'SELECT Fields(all) FROM Organization LIMIT 1'
        );
        return response.records[0];
    };

    generateNewAlias = host => {
        const baseHost = this.getBaseHost(host);
        if (baseHost.includes('--')) {
            const [category, name] = baseHost.split('--');
            return { alias: `${category}-${name}`, category, name };
        } else {
            return { alias: `${baseHost}-PROD`, category: baseHost, name: 'PROD' };
        }
    };

    getBaseHost = hostname => {
        return hostname.split('.')[0];
    };

    isSandbox = hostname => {
        return hostname.endsWith(SALESFORCE_SANDBOX_HOST);
    };

    isStandardOrg = hostname => {
        return SALESFORCE_HOST.some(pattern => hostname.endsWith(pattern));
    };

    isInternalDevOrg = (host,port) => {
        return ['.dev','.qa'].some(pattern => host.endsWith(pattern)) || isNotUndefinedOrNull(port);
    };

    /** getters */

    get isDisplayed() {
        // Return false if required data is missing
        if (isEmpty(this.instanceUrl) || isUndefinedOrNull(this.connections)) {
            return false;
        }

        // Extract host from instance URL
        let _url = new URL(this.instanceUrl);
        const hostName = _url.hostname;
        const port = _url.port;

        // Get list of existing connection hosts
        const existingHosts = this.connections.map(connection => {
            if (isNotUndefinedOrNull(connection.instanceUrl)) {
                return new URL(connection.instanceUrl).hostname;
            }
            if (isNotUndefinedOrNull(connection.redirectUrl)) {
                return new URL(connection.redirectUrl).hostname;
            }
            return null;
        });

        // Show quick authorize if:
        // 1. Host not already connected
        // 2. Is a standard Salesforce org
        // 3. Not in exclusion list
        return (
            !existingHosts.includes(hostName) &&
            !this.exclusionList.includes(hostName) &&
            (this.isStandardOrg(hostName) || this.isInternalDevOrg(hostName,port))
        );
    }

    get labelAuthorizeOrg() {
        return this.isInternalDevOrg ? 'Yes, Add Dev Org' : 'Yes, Authorize';
    }
}
