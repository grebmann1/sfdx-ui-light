import { api, wire,track } from "lwc";
import ToolkitElement from 'core/toolkitElement';
import { isEmpty, isSalesforceId, classSet, isUndefinedOrNull, isNotUndefinedOrNull, runActionAfterTimeOut, formatFiles, sortObjectsByField, removeDuplicates } from 'shared/utils';
import { CurrentPageReference, NavigationContext, generateUrl, navigate } from 'lwr/navigation';


const METADATA_EXCLUDE_LIST = ['Flow', 'FlowDefinition'];

export default class Menu extends ToolkitElement {
    @wire(NavigationContext)
    navContext;
    
    @api isNavigationEnabled = false;
    @api isBasicSelectionEnabled = false;
    @api isSelectAllDisplayed = false;

    isLoading = false;
    isNoRecord = false;
    isGlobalMetadataLoaded = false;

    @track metadata = [{ records: [], label: 'Metadata' }];
    currentLevel = 0;

    // Filters
    @track menuItems = [];
    keepFilter = false;

    currentMetadata;

    
    @api sobject;
    @api param1;
    @api param2;
    @api label1;
    @api label2;


    // Internal Caching
    _caching = {};
    _byPassCaching = false;

    // Worker
    metadataResult;
    tasks = {};
    error;



    connectedCallback() {
        this.processMetadata({});
    }

    /** Methods */

    @api
    process = (attributes) => {
        this.processMetadata(attributes);
    }

    processMetadata = async ({ param1, label1, param2, label2, sobject }) => {
        let isSelection = false;
        if (!this.isGlobalMetadataLoaded) {
            await this.load_metadataGlobal();
        }
        this.isNoRecord = false;

        const exceptionMetadata = sobject ? this.exceptionMetadataList.find(x => x.name === sobject) : null;
        if (sobject && this.currentMetadata != sobject) {
            // Metadata
            this.currentLevel = 1;
            this.currentMetadata = sobject;
            if (exceptionMetadata) {
                await this.load_specificMetadataException(exceptionMetadata, null, 1);
            } else {
                await this.load_specificMetadata(sobject);
            }
        }
        if (param1 && this.param1 != param1) {
            this.keepFilter = true; // Avoid menu search refresh !
            this.param1 = param1;
            this.label1 = label1;
            if (exceptionMetadata && exceptionMetadata.hasLvl2) {
                this.keepFilter = false; // For exception we refresh !
                let metadataRecord = this.metadata[this.metadata.length - 1].records.find(x => x.key == param1);

                // Advanced with Extra lvl
                this.currentLevel = 2;
                const lvl2ExceptionMetadata = this.exceptionMetadataList.find(x => x.name === exceptionMetadata.lvl2Type);
                await this.load_specificMetadataException(lvl2ExceptionMetadata, param1, 2);
                if (isUndefinedOrNull(param2) && exceptionMetadata.selectDefaultFunc) {
                    param2 = exceptionMetadata.selectDefaultFunc(metadataRecord);
                    label2 = exceptionMetadata.selectDefaultLabelFunc(metadataRecord);
                }
            } else {
                // Basic
                isSelection = true;
                this.dispatchEvent(
                    new CustomEvent("select", { 
                        detail:{
                            param:this.param1,
                            label:this.label1,
                            sobject: this.currentMetadata
                        },
                        bubbles: true,composed: true 
                    })
                );
            }
        }

        if (param2 && this.param2 != param2) {
            this.param2 = param2;
            this.label2 = label2;
            //this.currentLevel = 2;
            isSelection = true;
            this.dispatchEvent(
                new CustomEvent("select", { 
                    detail:{
                        param:this.param2,
                        label:this.label2,
                        sobject: this.currentMetadata
                    },
                    bubbles: true,composed: true 
                })
            );
        }
        // At the end to avoid multiple refresh
        if(!this.isBasicSelectionEnabled || !isSelection){
            this.setMenuItems();
        }
        
    }

    dispatchMetadataRequest = (params) => {
        if(this.isNavigationEnabled){
            navigate(this.navContext, {
                type: 'application',
                state: {
                    applicationName: 'metadata',
                    ...params
                }
            });
        }else{
            this.processMetadata(params);
        }
    }


    /** Events */

    selectAll_handleClick = (e) => {
        this.dispatchEvent(new CustomEvent("selectall", { 
            detail:{
                sobject: this.currentMetadata
            },
            bubbles: true,composed: true 
        }));
    }

    unselectAll_handleClick = (e) => {
        this.dispatchEvent(new CustomEvent("unselectall", { 
            detail:{
                sobject: this.currentMetadata
            },
            bubbles: true,composed: true 
        }));
    }

    handleMenuSelection = (e) => {
        const { name, label } = e.detail;
        switch (this.currentLevel) {
            case 0:
                // Metadata Type selection
                //this.load_specificMetadata({name,label});
                this.currentMetadata = null;
                this.param1 = null;
                this.param2 = null;
                this.currentLevel = 1;
                this.dispatchMetadataRequest({
                    sobject: name,
                    label1: label
                })
                break;
            case 1:
                // Metadata Record selection
                this.param1 = null;
                this.param2 = null;
                this.dispatchMetadataRequest({
                    sobject: this.currentMetadata,
                    param1: name,
                    label1: label
                });

                //this.currentLevel = 2; // Only for the flows
                break;
            case 2:
                this.param2 = null;
                this.dispatchMetadataRequest({
                    sobject: this.currentMetadata,
                    param1: this.param1,
                    label1: this.label1,
                    param2: name,
                    label2: label
                })
                // Only work for items such as flows
                break;
        }
    }

    handleRefresh = async () => {
        this._byPassCaching = true;
        if (this.currentLevel === 1) {
            const exceptionMetadata = this.currentMetadata ? this.exceptionMetadataList.find(x => x.name === this.currentMetadata) : null;
            if (exceptionMetadata) {
                await this.load_specificMetadataException(exceptionMetadata, null, 1);
            } else {
                await this.load_specificMetadata(this.currentMetadata);
            }
        }
        this._byPassCaching = false;
    }

    handleMenuBack = () => {
        this.keepFilter = false;
        if (this.currentLevel > 0) {
            this.currentLevel--;
        } else {
            this.currentLevel = 0;
        }

        this.metadata = this.metadata.slice(0, this.currentLevel + 1);
        if (this.currentLevel == 2) {
            this.param2 = null;
            this.dispatchMetadataRequest({
                sobject: this.currentMetadata,
                param1: this.param1,
                label1: this.label1
            })
        } else if (this.currentLevel == 1) {
            this.param1 = null;
            this.param2 = null;
            this.dispatchMetadataRequest({
                sobject: this.currentMetadata,
            })
        } else if (this.currentLevel == 0) {
            this.currentMetadata = null;
            this.param1 = null;
            this.param2 = null;
            this.dispatchMetadataRequest({})
        }
    }

    /** Methods */


    load_metadataGlobal = async () => {
        this.isLoading = true;
        let sobjects = (await this.connector.conn.tooling.describeGlobal$()).sobjects.map(x => x.name);
        let result = await this.connector.conn.metadata.describe(this.connector.conn.version);
            result = (result?.metadataObjects || [])
            result = result.filter(x => sobjects.includes(x.xmlName)).map(x => ({ ...x, ...{ name: x.xmlName, label: x.xmlName, key: x.xmlName } }));
            result = result.filter(x => !METADATA_EXCLUDE_LIST.includes(x.name));
            result = [].concat(result, this.exceptionMetadataList.filter(x => x.isSearchable));
            result = result.sort((a, b) => a.name.localeCompare(b.name));
        this.metadata[0] = { records: result, label: 'Metadata' };
        this.isLoading = false;
        this.isGlobalMetadataLoaded = true;
    }

    runAndCacheQuery = async (query) => {
        if (this._caching[query] && new Date() - this._caching[query].date < 1000 * 60 * 5 && !this._byPassCaching) {
            return this._caching[query].data;
        } else {
            let queryExec = this.connector.conn.tooling.query(query);
            let result = (await queryExec.run({ responseTarget: 'Records', autoFetch: true, maxFetch: 10000 })) || [];
            this._caching[query] = {
                data: result,
                date: new Date()
            }
            return result;
        }
    }

    load_specificMetadataException = async (exceptionMetadata, recordId, level) => {
        const { name, label, queryFields, queryObject, labelFunc, field_id, manualFilter, badgeFunc, compareFunc, filterFunc } = exceptionMetadata;
        const newCompare = compareFunc ? compareFunc : (a, b) => (a.label || '').localeCompare(b.label);

        this.isLoading = true;
        const metadataConfig = await this.connector.conn.tooling.describeSObject$(queryObject) || [];
        const fields = [].concat(metadataConfig.fields.map(x => x.name).filter(x => ['Id', 'Name', 'DeveloperName', 'MasterLabel', 'NamespacePrefix'].includes(x)), queryFields);
        try {
            const query = `SELECT ${fields.join(',')} FROM ${queryObject} ${filterFunc(recordId)}`;
            let result = (await this.runAndCacheQuery(query)) || [];
            result = result.filter(x => manualFilter(x))

            result = result.map(x => {
                const badge = badgeFunc(x);
                return {
                    ...x,
                    name: x[field_id],
                    label: labelFunc(x),
                    key: x[field_id],
                    badgeLabel: badge ? badge.label : null,
                    badgeClass: badge ? badge.class : null
                }
            }).sort(newCompare);


            if (this.metadata.length <= level) {
                this.metadata.push(null)
            }
            this.metadata[level] = { records: result, label };
        } catch (e) {
            console.error(e); // We still show the menu
        }
        this.isLoading = false;
    }

    load_specificMetadata = async (name) => {
        this.isLoading = true;
        const metadataConfig = await this.connector.conn.tooling.describeSObject$(name) || [];
        const fields = metadataConfig.fields.map(x => x.name).filter(x => ['Id', 'Name', 'DeveloperName', 'MasterLabel', 'NamespacePrefix'].includes(x));
        try {
            const query = `SELECT ${fields.join(',')} FROM ${name}`;
            let result = (await this.runAndCacheQuery(query)) || [];
            result = result.map(x => {
                const _tempName = this.formatName(x);
                return {
                    ...x,
                    name: x.Id,
                    label: _tempName,
                    key: x.Id,
                }
            }).sort((a, b) => (a.label || '').localeCompare(b.label));

            if (this.metadata.length <= 1) {
                this.metadata.push(null)
            }
            this.metadata[1] = { records: result, label: name };
        } catch (e) {
            console.error(e); // We still show the menu
        }
        this.isLoading = false;
    }

    load_recordFromRestAPI = async (recordId) => {
        const urlQuery = `/services/data/v${this.connector.conn.version}/tooling/sobjects/${this.currentMetadata}/${recordId}`;
        return await this.connector.conn.request(urlQuery);
    }

    

    formatName = (x) => {
        const name = x.MasterLabel || x.Name || x.DeveloperName || x.Id;
        return x.NamespacePrefix ? `${x.NamespacePrefix}__${name}` : name;
    }


    handle_LWC = async (key) => {
        var queryString = `SELECT LightningComponentBundleId,LightningComponentBundle.MasterLabel,Format,FilePath,Source FROM LightningComponentResource WHERE `;
        if (isSalesforceId(key)) {
            queryString += `LightningComponentBundleId = '${key}'`;
        } else {
            queryString += `LightningComponentBundle.DeveloperName = '${key}'`;
        }
        let resources = (await this.connector.conn.tooling.query(queryString)).records || [];
        let files = formatFiles(resources.map(x => ({
            path: x.FilePath,
            name: x.FilePath.split('/').pop(),
            body: x.Source,
            apiVersion: x.ApiVersion,
            metadata: this.currentMetadata,
            id: x.LightningComponentBundleId,
            _source: x
        })));

        // Added from Extension redirection
        if (resources.length > 0) {
            this.label1 = resources[0].LightningComponentBundle.MasterLabel;
        }
        return sortObjectsByField(files, 'extension', ['html', 'js', 'css', 'xml'])
    }

    handle_APEX = async (data, extension = 'cls', bodyField = 'Body') => {
        return formatFiles([{
            path: `${data.FullName || data.Name}.${extension}`,
            name: `${data.FullName || data.Name}.${extension}`,
            body: data[bodyField],
            apiVersion: data.ApiVersion,
            metadata: this.currentMetadata,
            id: data.Id,
        }]);
    }

    _auraNameMapping = (name, type) => {
        switch (type) {
            case 'COMPONENT':
                return `${name}.cmp`;
            case 'CONTROLLER':
                return `${name}Controller.js`;
            case 'HELPER':
                return `${name}Helper.js`;
            case 'RENDERER':
                return `${name}Renderer.js`;
            case 'DOCUMENTATION':
                return `${name}.auradoc`;
            case 'DESIGN':
                return `${name}.design`;
            case 'SVG':
                return `${name}.svg`;
            default:
                return name;
        }
    }

    handle_AURA = async (data) => {
        let resources = (await this.connector.conn.tooling.query(`SELECT AuraDefinitionBundleId,Format,DefType,Source FROM AuraDefinition WHERE AuraDefinitionBundleId = '${data.Id}'`)).records || [];
        let files = formatFiles(resources.map(x => {
            let _name = this._auraNameMapping(data.FullName, x.DefType);
            return {
                path: _name,
                name: _name,
                body: x.Source,
                apiVersion: data.ApiVersion,
                metadata: this.currentMetadata,
                id: data.Id,
                _source: x
            }
        }));
        return sortObjectsByField(files, 'extension', ['cmp', 'html', 'js', 'css', 'xml'])
    }

    checkIfPresent = (a, b) => {
        return (a || '').toLowerCase().includes((b || '').toLowerCase());
    }


    setMenuItems = () => {
        // Doesn't work all the time if param1 isn't the recordId !!! (Example LWC)
        if (this.metadata.length == 0) {
            this.menuItems = [];
        } else {
            this.menuItems = this.metadata[this.metadata.length - 1].records.map(x => ({
                ...x,
                isSelected: this.selectedItem == x.key
            }));
        }
    }


    /** Getters */

    get exceptionMetadataList() {
        return [
            {
                isSearchable: true,
                name: 'Flow',
                label: 'Flow',
                key: 'Flow',
                isException: true,
                hasLvl2: true,
                lvl2Type: 'FlowVersion',
                queryObject: 'FlowDefinition',
                queryFields: ['ActiveVersion.ProcessType', 'ActiveVersion.Status', 'ActiveVersionId'],
                labelFunc: this.formatName,
                filterFunc: (x) => " WHERE ActiveVersion.ProcessType <> 'Workflow'",
                field_id: 'Id',
                selectDefaultFunc: (x) => x.ActiveVersionId,
                selectDefaultLabelFunc: (x) => 'Active',
                badgeFunc: (x) => {
                    return x.ActiveVersion?.Status ? {
                        label: 'Active',
                        class: 'slds-theme_success'
                    } : {
                        label: 'Inactive',
                        class: ''
                    }
                },
                manualFilter: (x) => { return x.ActiveVersion?.ProcessType !== 'Workflow' }


            },
            {
                isSearchable: true,
                name: 'WorkFlow',
                label: 'WorkFlow',
                key: 'WorkFlow',
                isException: true,
                hasLvl2: true,
                lvl2Type: 'FlowVersion',
                queryObject: 'FlowDefinition',
                queryFields: ['ActiveVersion.ProcessType', 'ActiveVersion.Status', 'ActiveVersionId'],
                labelFunc: this.formatName,
                filterFunc: (x) => " WHERE ActiveVersion.ProcessType = 'Workflow'",
                field_id: 'Id',
                selectDefaultFunc: (x) => x.ActiveVersionId,
                selectDefaultLabelFunc: (x) => 'Active',
                badgeFunc: (x) => {
                    return x.ActiveVersion?.Status ? {
                        label: 'Active',
                        class: 'slds-theme_success'
                    } : {
                        label: 'Inactive',
                        class: ''
                    }
                },
                manualFilter: (x) => { return x.ActiveVersion?.ProcessType === 'Workflow' }
            },
            {
                isSearchable: false,
                name: 'FlowVersion',
                label: 'FlowVersion',
                key: 'FlowVersion',
                isException: true,
                hasLvl2: false,
                queryObject: 'Flow',
                queryFields: ['ProcessType', 'Status', 'VersionNumber'],
                labelFunc: (x) => `Version ${x.VersionNumber}`,
                filterFunc: (x) => ` WHERE Definition.Id = '${x}'`,
                field_id: 'Id',
                badgeFunc: (x) => {
                    return x.Status === 'Active' ? {
                        label: 'Active',
                        class: 'slds-theme_success'
                    } : {
                        label: x.Status,
                        class: ''
                    }
                },
                manualFilter: (x) => { return true; },
                compareFunc: (a, b) => (a.Status || '').localeCompare(b.Status)
            }
        ]
    }

    get noRecordMessage() {
        return `This record wasn't found in your metadata.`;
    }

    get isRefreshButtonDisplayed() {
        return this.currentLevel === 1;
    }

    /*get menuItems(){
        if(this.metadata.length == 0) return [];
        return this.metadata[this.metadata.length - 1].records.map(x => ({
            ...x,
            isSelected:this.selectedItem == x.key
        }));
    }*/

    get selectedItem() {
        if (this.currentLevel == 2) {
            return this.param2;
        } else if (this.currentLevel == 1) {
            return this.param1;
        } else if (this.currentLevel == 0) {
            return this.currentMetadata;
        } else {
            return null;
        }
    }

    get menuBackTitle() {

        if (this.currentLevel == 2) {
            return this.label1;
        } else if (this.currentLevel == 1) {
            return this.currentMetadata;
        } else if (this.currentLevel == 0) {
            return '';
        }
    }

    get isBackDisplayed() {
        return this.currentLevel > 0;
    }

    get pageClass() {
        return super.pageClass + ' slds-p-around_small';
    }

    get editorClass() {
        return classSet("slds-full-height").add({ 'slds-hide': !this.isEditorDisplayed }).toString();
    }

    get isSelectAllDisplayedAdvanced(){
        return this.isSelectAllDisplayed && this.currentLevel >= 1
    }

    
}