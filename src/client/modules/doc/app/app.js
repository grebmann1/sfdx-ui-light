import { LightningElement,api} from "lwc";
import { isEmpty,runActionAfterTimeOut} from 'shared/utils';
import LightningAlert from 'lightning/alert';
import FeatureElement from 'element/featureElement';
const ACCOUNT_ID = 'sforce_api_objects_account';

export default class App extends FeatureElement {

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
    filteredItems = []; // used for backend storage
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
        this.template.querySelector('.doc').scrollIntoView();

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

    get loadingMessage(){
        return `Loading ${this.loadingPointer}/${this.items.length} items`;
    }

    get filteredList(){
        if(isEmpty(this.filter)) return this.items;
        return this.filteredItems;
    }
}