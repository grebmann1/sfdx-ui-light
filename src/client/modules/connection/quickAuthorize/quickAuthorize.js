import { api,track } from "lwc";
import Toast from 'lightning/toast';
import ToolkitElement from 'core/toolkitElement';
import ConnectionNewModal from "connection/connectionNewModal";
import { getConfigurations } from 'connection/utils';

import { isEmpty,isChromeExtension,classSet,isUndefinedOrNull,isNotUndefinedOrNull } from 'shared/utils';

const SALESFORCE_SANDBOX_HOST   = 'sandbox.my.salesforce.com';
const SALESFORCE_HOST           = 'my.salesforce.com';

export default class QuickAuthorize extends ToolkitElement {

    @api instanceUrl;

    @track connections;
    @track exclusionList = [];

    async connectedCallback(){
        this.connections = await getConfigurations();
        //this.exclusionList = this.getExclusionList();
    }

    /** events **/

    addConnection_authorize = async () => {
        const instanceUrl = new URL(this.instanceUrl);
        const newAliasObject = this.generateNewAlias(instanceUrl.host);
        const params = {
            connections:this.connections,
            alias:newAliasObject.alias,
            selectedDomain:'custom',
            customDomain:instanceUrl.host,
            selectedCategory:[{
                id: newAliasObject.category,
                icon: 'standard:category',
                title: newAliasObject.category
            }],
            name:newAliasObject.name
        };

        ConnectionNewModal.open({
            ...params,
            'size':isChromeExtension()?'full':'medium'
        })
        .then(async (res) => {
            
            if(isNotUndefinedOrNull(res)){
                Toast.show({
                    label: `${res.alias} has been added.`,
                    //message: 'Exported to your clipboard', // Message is hidden in small screen
                    variant:'success',
                });
            }
            // Reset Connections
            let _newConnections = await getConfigurations();
            this.connections = null;
            this.connections = _newConnections;
        });
    }

    

    addConnection_hide = () => {
        if(isEmpty(this.instanceUrl)) return;
        const instanceUrl = new URL(this.instanceUrl).host;
        this.exclusionList.push(instanceUrl);
        this.setExclusionList(this.exclusionList);
    }

    /** Methods **/

    getExclusionList = () => {
        const toExcludeText = localStorage.getItem(`QUICK_AUTHORIZE_EXCLUSION_LIST`);
        var toExclude = [];
        if(toExcludeText && toExcludeText != ''){
            toExclude = JSON.parse(toExcludeText)
        }
        return toExclude;
    }
    
    setExclusionList = async (exclusionList) => {
        localStorage.setItem(`QUICK_AUTHORIZE_EXCLUSION_LIST`,JSON.stringify(exclusionList));
    }

    load_orgInformations = async () => {
        let response = await this.connector.conn.query("SELECT Fields(all) FROM Organization LIMIT 1");
        return response.records[0];
    }


    generateNewAlias = (host) => {
        const baseHost = this.getBaseHost(host);
        if(baseHost.includes('--')){
            const [category,name] = baseHost.split('--');
            return {alias:`${category}-${name}`,category,name};
        }else{
            return {alias:`${baseHost}-PROD`,category:baseHost,name:'PROD'};
        }
    }

    getBaseHost = (host) => {
        return host.split('.')[0];
    }

    isSandbox = (host) => {
        return host.endsWith(SALESFORCE_SANDBOX_HOST);
    }

    isStandardOrg = (host) => {
        return host.endsWith(SALESFORCE_HOST);
        const pattern = /^.*\.my(.*)\.salesforce\.com$/;
        // Test the URL against the pattern
        return pattern.test(host);
    }

    /** getters */

    get isDisplayed(){
        if(isEmpty(this.instanceUrl) || isUndefinedOrNull(this.connections)) return false;
        const urls = this.connections.map(x => isNotUndefinedOrNull(x.instanceUrl)?(new URL(x.instanceUrl)).host:(isNotUndefinedOrNull(x.redirectUrl)?(new URL(x.redirectUrl)).host:null))
        const instanceUrl = new URL(this.instanceUrl).host;
        return !urls.includes(instanceUrl) && this.isStandardOrg(instanceUrl) && !this.exclusionList.includes(instanceUrl);
    }
    

}