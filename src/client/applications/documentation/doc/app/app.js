import { api } from "lwc";
import { isEmpty,runActionAfterTimeOut,isNotUndefinedOrNull,removeDuplicates } from 'shared/utils';
import FeatureElement from 'element/featureElement';
const OBJECT_PREFIX = 'sforce_api_objects_';
const ACCOUNT_ID = 'sforce_api_objects_account';
const SEPARATOR = '###';
const DEFAULT_CONFIG = 'atlas.en-us.object_reference.meta'; // 234.0
const CONFIGURATION = {
    'atlas.en-us.object_reference.meta': {
        label:'Core Salesforce'
    },
    'atlas.en-us.salesforce_feedback_management_dev_guide.meta':{
        label:'Feedback Management'
    },
    'atlas.en-us.salesforce_scheduler_developer_guide.meta' : {
        label:'Scheduler'
    },
    'atlas.en-us.field_service_dev.meta':{
        label:'Field Service Lightning'
    },
    'atlas.en-us.loyalty.meta':{
        label:'Loyalty'
    },
    'atlas.en-us.psc_api.meta':{
        label:'Public Sector Cloud'
    },
    'atlas.en-us.netzero_cloud_dev_guide.meta':{
        label:'Net Zero Cloud'
    },
    'atlas.en-us.edu_cloud_dev_guide.meta':{
        label:'Education Cloud'
    },
    'atlas.en-us.automotive_cloud.meta':{
        label:'Automotive Cloud'
    },
    'atlas.en-us.eu_developer_guide.meta':{
        label:'Energy and Utilities Cloud'
    },
    'atlas.en-us.health_cloud_object_reference.meta':{
        label:'Health Cloud'
    },
    'atlas.en-us.retail_api.meta':{
        label:'Consumer Goods Cloud'
    },
    'atlas.en-us.financial_services_cloud_object_reference.meta':{
        label:'Financial Service Cloud'
    },
    'atlas.en-us.mfg_api_devguide.meta':{
        label:'Manufacturing Cloud'
    },
    'atlas.en-us.nonprofit_cloud.meta':{
        label:'Non profit Cloud'
    }
}

export default class App extends FeatureElement {

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

    items = [];
    filteredItems = []; // used for backend storage
    selectedMenuItem;
    
    isFooterDisplayed = false;
    loadingPointer = 0;


    connectedCallback(){
        this.loadDocumentation();
    }

    loadDocumentation = async () => {
        this.isLoading = true;
        this.isMenuLoading = true;
        this.initializeMermaid();
        await this.fetchDocuments();
        this.selectedMenuItem = `${DEFAULT_CONFIG}${SEPARATOR}${ACCOUNT_ID}`;
        this.selectPageToView();
        this.isLoading = false;
        this.isMenuLoading = false;
    }

    /** Events */
    
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
        this.redirectTo(e.detail.key);
    }


    handleToggleChange = (e) => {
        this.isFieldFilterEnabled = e.detail.checked;
        this.displayBodyContent();
    }
    

    /** Methods */
    
    redirectTo = (key) => {
        this.selectedMenuItem = key;
        this.selectPageToView();
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
        return  await (await fetch(`/documentation/search?keywords=${encodeURIComponent(value)}&filters=${encodeURIComponent(this.cloud_value)}`)).json();
    }

    selectPageToView = async () => {
        this.isLoading = true;
        if(this.refs.mermaid){
            this.refs.mermaid.innerHTML = ''; // Reset
        }
        if(this.refs.doc){
            this.refs.doc.innerHTML     = ''; // Reset
        }
        
        
        //let current = this.items.find(x => x.Name === this.selectedMenuItem);
        const [documentationId,name] = this.selectedMenuItem.split(SEPARATOR);
        this.currentSobject = await this.loadSingleDocument(documentationId,name);
        this.displayBodyContent();
        this.isLoading = false;
    }

    displayBodyContent = () => {
        const content = this.currentSobject.content;
        let formattedContent = this.cleanContent(content);
        if(!isEmpty(this.filter)){
            var regex = new RegExp('(?<=>)([^<]*?)(?:'+this.filter+')','gim');
            if(regex.test(formattedContent)){
                formattedContent = formattedContent.toString().replace(regex,`$1<span style="font-weight:Bold; color:blue;">${this.filter}</span>`);
            }
        }
        this.refs.container.innerHTML = formattedContent;
        this.applyFilterOnTable(this.filter);
        this.buildUML();
        this.template.querySelector('.documentation-container').scrollTo({ top: 0, behavior: 'auto' });
        //this.template.querySelector('.mermaid').scrollIntoView();
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
            const lookupName = OBJECT_PREFIX+nodeId.split('-')[1].toLowerCase();
            if(this.items.find(x => x.id === lookupName)){
                this.redirectTo(lookupName);
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
        //console.log('fetchDocuments',this.cloud_value);
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
        //console.log('this.documentMapping[documentationId]',documentationId,this.documentMapping[documentationId]);
    }

    extraDataFromJson = (documentationId,items,result) => {
        for(var x of (items || [])){
            const itemId = x.id || '';
            if(x.children){
                result = result.concat(this.extraDataFromJson(documentationId,x.children,[]));
            }else{
                if((itemId).startsWith('sforce_api_objects_')){
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
            return this.fetchContentDocument(
                header.deliverable,
                `${name}.htm`,
                header.version.doc_version
            );
        }catch(e){
            console.warn('Error happening',e);
            return {};
        }
    }

    cleanContent = (content) => {
        var regex = new RegExp('(src\=\"\/)','gi');
        if(regex.test(content)){
            content = content.toString().replace(regex,'src="https://developer.salesforce.com/');
        }
        return content;
    }

    cloud_handleChange = async (e) => {
        this.cloud_value = e.detail.value;
        if(!isEmpty(this.filter)){
            this.filteredItems = removeDuplicates(await this.getFilteredItems(this.filter),'id');   
        }
        this.fetchDocuments();
    }
    
    /** Getters */

    get cloud_options(){
        return Object.keys(CONFIGURATION).map(x => ({label:CONFIGURATION[x].label,value:x}));
    }
    
    get pageClass(){//Overwrite
        return super.pageClass+' slds-p-around_small';
    }

    get loadingMessage(){
        return `Loading ${this.loadingPointer}/${this.items.length} items`;
    }

    get filteredList(){
        var items = this.items;
        if(!isEmpty(this.filter)){
            items = this.filteredItems;
        }
        return items.map(x => ({
            key:`${x.documentationId}${SEPARATOR}${x.id}`,
            label:x.text,
            name:x.id,
        }));
    }
}