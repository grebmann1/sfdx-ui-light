import ToolkitElement from 'core/toolkitElement';
import { wire,api,createElement } from "lwc";
import { isEmpty,getFromStorage,runActionAfterTimeOut,isUndefinedOrNull,isNotUndefinedOrNull,removeDuplicates,classSet } from 'shared/utils';
import { CurrentPageReference,NavigationContext, generateUrl, navigate } from 'lwr/navigation';
import { connectStore,store as legacyStore,store_application } from 'shared/store';
import sldsCodeBlock from 'slds/codeBlock';

const PREFIX = {
    DEFAULT : 'sforce_api_objects_',
    DATA_CLOUD : 'c360dm_'
}

const ACCOUNT_ID = 'sforce_api_objects_account';
const SEPARATOR = '###';
const DEFAULT_CONFIG = 'atlas.en-us.object_reference.meta'; // 234.0
const CONFIGURATION = {
    'atlas.en-us.automotive_cloud.meta': {
        label: 'Automotive Cloud'
    },
    'atlas.en-us.retail_api.meta': {
        label: 'Consumer Goods Cloud'
    },
    'atlas.en-us.object_reference.meta': {
        label: 'Core Salesforce'
    },
    'atlas.en-us.c360a_api.meta': {
        label: 'Data Cloud'
    },
    'atlas.en-us.edu_cloud_dev_guide.meta': {
        label: 'Education Cloud'
    },
    'atlas.en-us.eu_developer_guide.meta': {
        label: 'Energy and Utilities Cloud'
    },
    'atlas.en-us.salesforce_feedback_management_dev_guide.meta': {
        label: 'Feedback Management'
    },
    'atlas.en-us.field_service_dev.meta': {
        label: 'Field Service Lightning'
    },
    'atlas.en-us.financial_services_cloud_object_reference.meta': {
        label: 'Financial Service Cloud'
    },
    'atlas.en-us.health_cloud_object_reference.meta': {
        label: 'Health Cloud'
    },
    'atlas.en-us.loyalty.meta': {
        label: 'Loyalty'
    },
    'atlas.en-us.mfg_api_devguide.meta': {
        label: 'Manufacturing Cloud'
    },
    'atlas.en-us.netzero_cloud_dev_guide.meta': {
        label: 'Net Zero Cloud'
    },
    'atlas.en-us.nonprofit_cloud.meta': {
        label: 'Non profit Cloud'
    },
    'atlas.en-us.psc_api.meta': {
        label: 'Public Sector Cloud'
    },
    'atlas.en-us.salesforce_scheduler_developer_guide.meta': {
        label: 'Scheduler'
    }
}
const DOCUMENTATION_CLOUD_VALUE = 'DOCUMENTATION_CLOUD_VALUE';

export default class App extends ToolkitElement {
    @wire(NavigationContext)
    navContext;

    @api isResponsive = false;
    @api isDiagramDisplayed = false;

    isLoading = false;
    isMenuLoading = false;
    apiDomain = 'https://developer.salesforce.com';
    language = 'en-us';
    documentationId = DEFAULT_CONFIG;


    cloud_value = [DEFAULT_CONFIG]; // standard by default
    documentMapping = {};


    sobjectHeader;
    currentSobject;
    filter;
    isFieldFilterEnabled = false;
    displayFilter = false;
    displayMenu = false;

    items = [];
    filteredItems = []; // used for backend storage
    selectedMenuItem;
    
    isFooterDisplayed = false;
    loadingPointer = 0;

    _pageRef;
    @wire(CurrentPageReference)
    handleNavigation(pageRef){
        if(isUndefinedOrNull(pageRef)) return;
        if(JSON.stringify(this._pageRef) == JSON.stringify(pageRef)) return;
        
        if(pageRef?.state?.applicationName == 'documentation'){
            this._pageRef = pageRef;
            this.loadFromNavigation(pageRef);
        }
    }

    @wire(connectStore, { store })
    applicationChange({application}) {
        if(application?.type === 'FAKE_NAVIGATE'){
            const pageRef = application.target;
            this.loadFromNavigation(pageRef);
        }
        // Toggle Menu
        //console.log('application',application)
    }

    loadFromNavigation = async ({state}) => {
        //('documentation - loadFromNavigation');
        const {name,attribute1,applicationName}  = state;
        if(applicationName != 'documentation') return; // Only for metadata

        this.isNoRecord = false;

        if(attribute1){
            await this.fetchDocuments_single(attribute1);
            //console.log('cloud fetched',attribute1);
            if(!this.cloud_value.includes(attribute1) && CONFIGURATION.hasOwnProperty(attribute1)){
                this.cloud_value.push(attribute1);
                this.documentationId = attribute1;
            }
            if(name){
                this.selectedMenuItem = `${attribute1}${SEPARATOR}${name}`;
                this.selectPageToView();
            }
        }
    }


    connectedCallback(){
        this.loadFromCache();
        this.loadDocumentation();
    }

    loadFromCache = async () => {
        //console.log('cache',localStorage.getItem(`doc-isDiagramDisplayed`));
        this.isDiagramDisplayed = localStorage.getItem(`doc-isDiagramDisplayed`) === 'true';
        this.cloud_value = getFromStorage(localStorage.getItem(DOCUMENTATION_CLOUD_VALUE),[DEFAULT_CONFIG]);
    }

    loadDocumentation = async () => {
        this.isLoading = true;
        this.isMenuLoading = true;
        this.initializeMermaid();
        await this.fetchDocuments();
        if(isUndefinedOrNull(this.selectedMenuItem)){
            // Only add for the core cloud when loading
            if(this.filteredList.length > 0){
                this.redirectTo(this.filteredList[0].key);
            }
            
        }
        this.isLoading = false;
        this.isMenuLoading = false;
    }

    updateCloudValueInCache = () => {
        localStorage.setItem(DOCUMENTATION_CLOUD_VALUE,JSON.stringify(this.cloud_value));
    }

    /** Events */

    openFilter = (e) => {
        e.preventDefault();
        this.displayFilter = true;
    }

    handleItemRemove = (e) => {
        this.displayFilter = true; // always open the filter menu
        if(this.cloud_value.length == 1) return; // dont allow to remove the last one
        this.cloud_value = this.cloud_value.filter(x => x != e.detail.item.name);
        this.updateCloudValueInCache();
        this.refreshDocumentsFromCloud();
    }

    handleCloseVerticalPanel = (e) => {
        this.displayFilter = false;
    }

    filtering_handleClick = (e) => {
        this.displayFilter = !this.displayFilter;
    }

    menu_handleClick = (e) => {
        this.displayMenu = !this.displayMenu;
    }
    
    @api
    externalSearch = async (value) => {
        this.isLoading = true;
        if(!isEmpty(value)){
            this.displayMenu = true;
            this.filteredItems = removeDuplicates(await this.getFilteredItems(value),'id');
        }
        this.filter = value;
        this.isLoading = false;
    }

    handleFilter = (e) => {
        this.isMenuLoading = true;
        runActionAfterTimeOut(e.detail.value,async (newValue) => {
            //this.filter = newValue;
            if(!isEmpty(newValue)){
                this.filteredItems = removeDuplicates(await this.getFilteredItems(newValue),'id');
            }
            this.filter = newValue;
            this.isMenuLoading = false;
        },{timeout:500});
    }

    handleItemSelection = async (e) => {
        this.displayMenu = false; // For the responsive
        this.redirectTo(e.detail.key);
    }


    handleToggleChange = (e) => {
        this.isFieldFilterEnabled = e.detail.checked;
        this.displayBodyContent();
    }

    handleDisplayDiagram = (e) => {
        this.isDiagramDisplayed = e.detail.checked;
        localStorage.setItem(`doc-isDiagramDisplayed`,e.detail.checked);
    }
    

    /** Methods */

    refreshDocumentsFromCloud = async() => {
        window.setTimeout(async () => {
            if(!isEmpty(this.filter)){
                this.filteredItems = removeDuplicates(await this.getFilteredItems(this.filter),'id');   
            }
            this.fetchDocuments();
        },1)
    }
    
    redirectTo = (key) => {
        const [documentationId,name] = (key || '').split(SEPARATOR);
        const params = {
            type:'application',
            state:{
                applicationName:'documentation',
                name:name,
                attribute1:documentationId
            }
        };

        if(this.isNavigationAvailable){
            navigate(this.navContext,params);
        }else{
            legacyStore.dispatch(store_application.fakeNavigate(params));
        }
    }
    
    initializeMermaid = () => {
        window.mermaidCallback = (nodeId) => {
            this.interactWithDiagram(nodeId);
        }
        window.mermaid.initialize({
            startOnLoad: false,
            securityLevel: 'loose'
        });
    }

    getFilteredItems = async (value) => {
        /** Doesnt work when testing the extension running on a server **/
        return await (await fetch(`${this.searchHost}documentation/search?keywords=${encodeURIComponent(value)}&filters=${encodeURIComponent(this.cloud_value)}`)).json();
    }

    selectPageToView = async () => {
        this.isLoading = true;
        if(this.refs?.mermaid){
            this.refs.mermaid.innerHTML = ''; // Reset
        }
        if(this.refs?.doc){
            this.refs.doc.innerHTML     = ''; // Reset
        }
        
        
        //let current = this.items.find(x => x.Name === this.selectedMenuItem);
        const [documentationId,name] = this.selectedMenuItem.split(SEPARATOR);
        this.currentSobject = await this.loadSingleDocument(documentationId,name);
        if(this.currentSobject){
            this.displayBodyContent();
        }else{
            this.isNoRecord = true;
        }
        
        this.isLoading = false;
    }

    displayBodyContent = () => {
        const content = this.currentSobject.content;
        let formattedContent = this.cleanContent(content);
        if(!isEmpty(this.filter)){
            var regex = new RegExp('(?<=>)([^<]*?)('+this.filter+')','gim');
            if(regex.test(formattedContent)){
                formattedContent = formattedContent.toString().replace(regex,`<span style="font-weight:Bold; color:blue;">$2</span>`);
            }
        }


        this.refs.container.innerHTML = formattedContent;
        this.applyFilterOnTable(this.filter);
        this.buildUML();
        this.transformCodeBlockToComponents();
        this.template.querySelector('.documentation-container').scrollTo({ top: 0, behavior: 'auto' });
        //this.template.querySelector('.mermaid').scrollIntoView();
    }

    transformCodeBlockToComponents = () => {
        const mapping = {js: "javascript"};
        this.refs.container.querySelectorAll(".codeSection")
        .forEach( el => {
            el.setAttribute("lwc:dom", "manual");
            const list = el.firstChild.classList;
            let c = "";
            for (const d in list)
                if (typeof list[d] == "string") {
                    const p = list[d];
                    p.startsWith("brush:") && (c = p.split(":")[1])
                }
            const newElement = createElement("slds-code-block", {
                is: sldsCodeBlock
            });
            Object.assign(newElement, {
                codeBlock: el.innerHTML,
                language: mapping[c] || c,
                title: "",
            }),
            el.innerHTML = "",
            el.appendChild(newElement)
        })
    }

    applyFilterOnTable = (keywords) => {
        runActionAfterTimeOut(keywords,(value) => {
            let items = this.refs.container.querySelectorAll('.featureTable .tbody tr');
            [...items].forEach(x => {
                if(this.isFieldFilterEnabled && !isEmpty(keywords)){
                    if(this.checkIfPresent(x.textContent,value)){
                        x.classList.remove('slds-hide');
                    }else{
                        x.classList.add('slds-hide');
                    }
                }else{
                    // Remove slds-hide to all
                    x.classList.remove('slds-hide');
                }
                
            });
        },{timeout:300});
    }

    concatenateNonEmptyText = (node) => {
        let text = '';
    
        // Check if the current node is a text node and has non-whitespace content
        if(isNotUndefinedOrNull(node)){
            if (node.nodeType === Node.TEXT_NODE && node.textContent.trim().length > 0) {
                text += node.textContent.trim() + ' '; // Concatenate text and add a space for separation
            }
        
            // Iterate through all child nodes
            node.childNodes.forEach(child => {
                text += this.concatenateNonEmptyText(child);
            });
        }
        
    
        return text;
    }

    extractData = () => {
        let items = this.refs.container.querySelector('.featureTable').querySelectorAll('tbody tr');
        const result = [];
        [...items].forEach(x => {
            const data = {
                Field:this.concatenateNonEmptyText(x.querySelector('.keyword'))
            };
            x.querySelectorAll('.detailList .dt').forEach((dt) => {
                const dd = dt.nextElementSibling;
                data[(dt.textContent || "").replace(/ /g, "")] = (dd.textContent || "").replace(/ /g, "");
            });
            result.push(data);
        });
        return result;
    }

    interactWithDiagram = (nodeId) => {
        try{
            const defaultLookupName     = PREFIX.DEFAULT+nodeId.split('-')[1].toLowerCase();
            const dataCloudLookupName   = PREFIX.DATA_CLOUD+nodeId.split('-')[1].toLowerCase();
            const bundleList = [defaultLookupName,dataCloudLookupName];
            if(this.items.find(x => bundleList.includes(x.id))){
                this.redirectTo(`${this.documentationId}${SEPARATOR}${lookupName}`);
            }
        }catch(e){
            console.error('interactWithDiagram',e);
        }
        
    }
    

    buildUML = async () => {
        this.refs.mermaid.innerHTML = '';
        const source = this.concatenateNonEmptyText(this.refs.container.querySelector('.helpHead1')).replace(/ /g, "");
        const result = ['classDiagram','direction LR',`class \`${source}\``];
        const interactions = [`click \`${source}\` call mermaidCallback()`];
        // Filter to take only fields with "Refer To"
        const references = this.extractData().filter(x => x.Type === 'reference');
            references.forEach(x => {
                var lookup = x.RefersTo || this.extractManualObject(x.Field);
                    lookup = lookup.replaceAll(',','|')
                if(lookup){
                    if(lookup.split('|').length > 5){
                        lookup = `${x.Field} Objects`;
                    }
                    result.push(`\`${source}\` --> \`${lookup || 'Undefined'}\` : ${x.Field}`);
                    interactions.push(`click \`${lookup}\` call mermaidCallback()`)
                }
            });
            //console.log('r',[].concat(result,interactions).join('\n'));
        const { svg,bindFunctions } = await window.mermaid.render('graphDiv',[].concat(result,interactions).join('\n'));
        this.refs.mermaid.innerHTML = svg;
        if (bindFunctions) {
            bindFunctions(this.refs.mermaid);
        }
    }

    extractManualObject = (field) => {
        if(!isEmpty(field) /*|| supportedFields.includes(field)*/){
            field = field.replace(/ /g, "");
            if (field.endsWith("Id")) {
                return field.slice(0, -2); // Remove the last 2 characters
            }
            return field;
        }
        return null;
    }

    checkIfPresent = (a,b) => {
        return (a || '').toLowerCase().includes((b||'').toLowerCase());
    }

    fetchDocuments = async () => {

        this.isMenuLoading = true;
        for (const item of this.cloud_value) {
            await this.fetchDocuments_single(item);
        }
        // group items
        this.items = Object.keys(this.documentMapping)
        .filter(documentationId => this.cloud_value.includes(documentationId))
        .reduce((acc,documentationId) => acc.concat(this.documentMapping[documentationId].items.map(x => ({...x,documentationId}))),[])
        .sort((a, b) => (a.text || '').localeCompare(b.text));

        //console.log('this.items',this.items);
        this.isMenuLoading = false;
    }

    fetchDocuments_single = async (documentationId) => {
        //console.log('fetchDocuments_single',documentationId);
        if(this.documentMapping.hasOwnProperty(documentationId)) return;
        
        let result = await (await fetch(`${this.apiDomain}/docs/get_document/${documentationId}`)).json();
        //console.log(documentationId,result);
        var items = removeDuplicates(this.extraDataFromJson(documentationId,result.toc,[]),'id')
        this.documentMapping[documentationId] = {
            items:items,
            header:result
        }
    }

    extraDataFromJson = (documentationId,items,result) => {
        for(var x of (items || [])){
            const itemId = x.id || '';
            if(x.children){
                result = result.concat(this.extraDataFromJson(documentationId,x.children,[]));
            }else{
                if((itemId).startsWith(PREFIX.DEFAULT) || (itemId).startsWith(PREFIX.DATA_CLOUD)){
                    result.push(x)
                }
            }
        }
        return result;
    }

    fetchContentDocument = async (deliverable,contentDocumentId,version) => {
        return await (await fetch(`${this.apiDomain}/docs/get_document_content/${deliverable}/${contentDocumentId}/${this.language}/${version}`)).json();
    }

    loadSingleDocument = async (documentationId,name) => {
        try{
            const header = this.documentMapping[documentationId].header;
            return await this.fetchContentDocument(
                header.deliverable,
                `${name}.htm`,
                header.version.doc_version
            );
        }catch(e){
            console.warn('Error happening',e);
            return null;
        }
    }

    cleanContent = (content) => {
        const srcRegex = new RegExp('(src\=\"\/)','gi');
        const hrefRegex = new RegExp('href="((?!http:\/\/|https:\/\/)[^":]+)"','gi');

        if(srcRegex.test(content)){
            content = content.toString().replace(srcRegex,'src="https://developer.salesforce.com/');
        }
        if(hrefRegex.test(content)){
            content = content.toString().replace(hrefRegex,function(match, p1, p2){
                return `href="https://developer.salesforce.com/docs/${p1}" target="_blank"`;
            });
        }

        return content;
    }

    cloud_handleChange = async (e) => {
        this.cloud_value = e.detail.value;
        this.updateCloudValueInCache();
        this.refreshDocumentsFromCloud();
    }
    
    /** Getters */

    get documentationTitle(){
        return `Documentation Explorer ${isNotUndefinedOrNull(this.currentSobject)?` - ${this.currentSobject.title}`:''}`;
    }

    get searchHost(){
        return this.isResponsive?'https://sf-toolkit.com/':'/';
    }

    get isNavigationAvailable(){
        return isNotUndefinedOrNull(this.navContext);
    }

    get pillItems(){
        return this.cloud_value.map(x => ({name:x,label:CONFIGURATION[x].label}))
    }

    get filtering_variant(){
        return this.displayFilter?'brand':'border-filled';
    }

    get menu_variant(){
        return this.displayMenu?'brand':'border-filled';
    }

    get cloud_options(){
        return Object.keys(CONFIGURATION).map(x => ({label:CONFIGURATION[x].label,value:x}));
    }
    
    get pageClass(){//Overwrite
        return super.pageClass+' slds-p-around_small';
    }

    get loadingMessage(){
        return `Loading ${this.loadingPointer}/${this.items.length} items`;
    }

    get mermaidClass(){
        return classSet('mermaid')
        .add({
            'slds-hide':!this.isDiagramDisplayed
        })
        .toString();
    }

    get articleContainerClass(){
        return classSet('full-page slds-card slds-col')
        .add({
            //'slds-m-top_small':!this.isResponsive, slds-calculated-width
            //'slds-25-width':this.displayFilter && this.isResponsive,
            //'slds-100-width':!this.isResponsive || !this.displayFilter
            //'slds-scrollable_y':this.isResponsive
            //'slds-show_large':this.displayFilter || this.displayMenu
            'slds-calculated-width':this.displayFilter,
            'slds-100-width':!this.displayFilter
        }).toString();
    }

    get filterContainerClass(){
        return classSet("slds-page-header__row slds-page-header__row_gutters")
        .add({
            'slds-show':this.displayFilter,
            'slds-show_small':!this.displayFilter
        }).toString();
    }

    get menuContainerClass(){
        return classSet('slds-flex-column slds-p-left_x-small slds-full-height slds-col min-height-200 background-gray')
        .add({
            'slds-size_1-of-1 slds-large-size_1-of-4':this.isResponsive,
            'slds-size_1-of-4':!this.isResponsive,
            'slds-show':this.displayMenu,
            'slds-show_large':!this.displayMenu && this.isResponsive
        }).toString();
    }

    get documentationContainerClass(){
        return classSet('documentation-container slds-scrollable_y slds-p-horizontal_small slds-flex-column slds-full-height slds-col slds-is-relative')
        .add({
            'slds-size_1-of-1 slds-large-size_3-of-4':this.isResponsive,
            'slds-size_3-of-4':!this.isResponsive,
            //'slds-scrollable_y':!this.isResponsive
            //'slds-show_large':this.displayFilter || this.displayMenu
        }).toString();
    }

    get fullPageHeaderClass(){
        return classSet('full-page-header slds-page-header slds-page-header_joined is-sticky')
        .add({
            'collapsed':this.displayFilter || this.displayMenu
        }).toString();
    }

    get filterPanelSize(){
        return this.isResponsive ? 'slds-size_full':'slds-size_medium'
    }

    get isNotResponsive(){
        return !this.isResponsive;
    }

    get filteredList(){
        var items = this.items;
        if(!isEmpty(this.filter)){
            items = this.filteredItems;
        }
        return items.map(x => {
            const key = `${x.documentationId}${SEPARATOR}${x.id}`;
            return {
                key,
                label:x.text,
                name:x.id,
                isSelected:this.selectedMenuItem == key
            }
        });
    }
}