import { api, LightningElement } from 'lwc';
import { isEmpty,isNotUndefinedOrNull } from 'shared/utils';

export default class App extends LightningElement {
    
    @api url = 'https://raw.githubusercontent.com/grebmann1/sfdx-ui-light/master/release.md';

    content;

    connectedCallback(){
        if(!this.init){
            this.initComponent();
        }
    }

    /** Methods **/

    getPageUrl = () => {
        if(isEmpty(new URL(document.URL).hash)){
            return '';
        }else{
            return (new URL(document.URL).hash).slice(1);
        }
    }



    initComponent = () => {
        this.getDown(this.url);
        this.init = true;
    }

    
    async getDown(url){
        this.content = await (await fetch(url)).text();
    }

    /** getters */

    get isMarkdownViewerDisplayed(){
        return isNotUndefinedOrNull(this.content);
    }
    
}