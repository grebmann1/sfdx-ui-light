import { LightningElement,api} from "lwc";
import { isEmpty,runActionAfterTimeOut} from 'shared/utils';

const ACCOUNT_ID = 'sforce_api_objects_account';

export default class App extends LightningElement {

    @api connector;

    isLoading = false;
    apiDomain = 'https://developer.salesforce.com';
    language = 'en-us';
    documentationId = 'atlas.en-us.object_reference.meta';

    sobjectHeader;
    currentSobject;
    filter;
    isFieldFilterEnabled = false;

    items = [];
    allDocuments = []; // used once everything has been loaded
    selectedMenuItem;
    
    isFooterDisplayed = false;
    loadingPointer = 0;


    async connectedCallback(){
        this.isLoading = true;
        await this.fetchDocument();
        this.selectedMenuItem = ACCOUNT_ID;
        this.selectPageToView();
        this.isLoading = false;
    }

    /** Events */

    handleItemSelection = async (e) => {
        this.selectedMenuItem = e.detail.name;
        this.selectPageToView();
    }

    handleFilter = (e) => {
        runActionAfterTimeOut(e.detail.value,(newValue) => {
            this.filter = newValue;
        },{timeout:500});
    }

    handleToggleChange = (e) => {
        this.isFieldFilterEnabled = e.detail.checked;
        this.displayBodyContent();
    }
    

    /** Methods */

    selectPageToView = async () => {
        let current = this.items.find(x => x.id === this.selectedMenuItem);
        this.currentSobject = await this.loadSingleDocument(current.a_attr.href);
        this.displayBodyContent();
    }

    displayBodyContent = () => {
        const content = this.currentSobject.content;
        let formattedContent = this.cleanContent(content);
        if(!isEmpty(this.filter)){
            var regex = new RegExp('('+this.filter+')','gi');
            if(regex.test(formattedContent)){
                formattedContent = formattedContent.toString().replace(regex,'<span style="font-weight:Bold; color:blue;">$1</span>');
            }
        }
        this.refs.container.innerHTML = formattedContent;
        this.applyFilterOnTable(this.filter);
        //featureTable sort_table
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

    checkIfPresent = (a,b) => {
        return (a || '').toLowerCase().includes((b||'').toLowerCase());
    }

    fetchDocument = async () => {
        let result = await (await fetch(`${this.apiDomain}/docs/get_document/${this.documentationId}`)).json();
        result.toc.forEach(x => {
            x.children.forEach(y => {
                if( y.id === "sforce_api_objects_list"){
                    this.items = y.children
                }
            })
        });
        this.sobjectHeader = result;
        this.loadAllDocuments();
    }

    fetchContentDocument = async (deliverable,contentDocumentId,version) => {
        return await (await fetch(`${this.apiDomain}/docs/get_document_content/${deliverable}/${contentDocumentId}/${this.language}/${version}`)).json();
    }

    loadAllDocuments = async () => {
        this.isFooterDisplayed = true;
        this.loadingPointer = 0;

        // Helper function to chunk the URL list
        const chunkList = (list, size) => {
            const chunks = [];
            for (let i = 0; i < list.length; i += size) {
                chunks.push(list.slice(i, i + size));
            }
            return chunks;
        };
    
        // Chunk the URLs
        const itemChunks = chunkList(this.items.map(x => x.a_attr.href), 15);
        let finalResult = [];
        // Process each chunk
        for (const chunk of itemChunks) {
            const promises = chunk.map(name => this.loadSingleDocument(name));
            const results = await Promise.all(promises);

            finalResult = [].concat(finalResult,results);
            this.loadingPointer = finalResult.length;
        }
        
        this.allDocuments = finalResult;
        this.isFooterDisplayed = false;
    }

    loadSingleDocument = async (name) => {
        try{
            let item = await window.defaultStore.getItem(`doc-${name}`);
            if(item){
                //console.log('Using Cache');
                return item;
            }else{
                let _res = this.fetchContentDocument(
                    this.sobjectHeader.deliverable,
                    name,
                    this.sobjectHeader.version.doc_version
                );
                window.defaultStore.setItem(`doc-${name}`,_res);
                return _res;
            }
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

    get loadingMessage(){
        return `Loading ${this.loadingPointer}/${this.items.length} items`;
    }

    get filteredList(){
        if(isEmpty(this.filter)) return this.items;

        if(this.allDocuments.length == 0){
            // if documents aren't loaded, we only use simple filter
            return this.items.filter(x => this.checkIfPresent(x.text,this.filter));
        }else{
            // Advanced filter
            return this.allDocuments.filter(x => this.checkIfPresent(x.title,this.filter) || this.checkIfPresent(x.content,this.filter)).map(x => ({
                name:x.id,
                text:x.title,
                id:x.id
            }));
        }
        
    }



}