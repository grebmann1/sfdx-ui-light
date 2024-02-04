import { api } from "lwc";
import { isEmpty,runActionAfterTimeOut,isNotUndefinedOrNull} from 'shared/utils';
import FeatureElement from 'element/featureElement';
const OBJECT_PREFIX = 'sforce_api_objects_';
const ACCOUNT_ID = 'sforce_api_objects_account';

export default class App extends FeatureElement {

    isLoading = false;
    apiDomain = 'https://developer.salesforce.com';
    language = 'en-us';
    documentationId = 'atlas.en-us.object_reference.meta';

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
        this.initializeMermaid();
        await this.fetchDocument();
        this.selectedMenuItem = ACCOUNT_ID;
        this.selectPageToView();
        this.isLoading = false;
    }

    /** Events */

    handleItemSelection = async (e) => {
        this.redirectTo(e.detail.name);
    }

    handleFilter = (e) => {
        runActionAfterTimeOut(e.detail.value,async (newValue) => {
            //this.filter = newValue;
            if(!isEmpty(newValue)){
                this.filteredItems = await this.getFilteredItems(newValue);   
            }
            this.filter = newValue;
        },{timeout:500});
    }

    handleToggleChange = (e) => {
        this.isFieldFilterEnabled = e.detail.checked;
        this.displayBodyContent();
    }
    

    /** Methods */
    
    redirectTo = (name) => {
        this.isLoading = true;
        this.selectedMenuItem = name;
        this.selectPageToView();
        this.isLoading = false;
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
        return  await (await fetch(`/documentation/search?keywords=${encodeURIComponent(value)}`)).json();
    }

    selectPageToView = async () => {
        let current = this.items.find(x => x.id === this.selectedMenuItem);
        this.currentSobject = await this.loadSingleDocument(current.a_attr.href);
        this.displayBodyContent();
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
        this.template.querySelector('.mermaid').scrollIntoView();
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
        if (node.nodeType === Node.TEXT_NODE && node.textContent.trim().length > 0) {
            text += node.textContent.trim() + ' '; // Concatenate text and add a space for separation
        }
    
        // Iterate through all child nodes
        node.childNodes.forEach(child => {
            text += this.concatenateNonEmptyText(child);
        });
    
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
        console.log('interactWithDiagram',nodeId);
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
                    lookup = lookup.replace(',','|')
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

    fetchDocument = async () => {
        let result = await (await fetch(`${this.apiDomain}/docs/get_document/${this.documentationId}`)).json();
        let _items
        result.toc.forEach(x => {
            x.children.forEach(y => {
                if( y.id === "sforce_api_objects_list"){
                    _items = y.children
                }
            })
        });
        this.items = _items;
        this.sobjectHeader = result;
    }

    fetchContentDocument = async (deliverable,contentDocumentId,version) => {
        return await (await fetch(`${this.apiDomain}/docs/get_document_content/${deliverable}/${contentDocumentId}/${this.language}/${version}`)).json();
    }

    loadSingleDocument = async (name) => {
        try{
            return this.fetchContentDocument(
                this.sobjectHeader.deliverable,
                name,
                this.sobjectHeader.version.doc_version
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
    
    /** Getters */
    
    get pageClass(){//Overwrite
        return super.pageClass+' slds-p-around_small';
    }

    get loadingMessage(){
        return `Loading ${this.loadingPointer}/${this.items.length} items`;
    }

    get filteredList(){
        if(isEmpty(this.filter)) return this.items;
        return this.filteredItems;
    }
}