import { api, LightningElement } from 'lwc';
import { marked } from './markdown';
import { isEmpty } from 'shared/utils';

export default class MarkdownViewer extends LightningElement {
    
    init = false;

    @api defaultUrl;
    @api url;
    @api isMenu = false;
    @api baseUrl;

    connectedCallback(){
        if(!this.init){
            this.initComponent();
        }

        window.addEventListener('hashchange', (e)=> {
            this.updateComponent();
        }, false);

    }

    getPageUrl = () => {
        if(isEmpty(new URL(document.URL).hash)){
            return '';
        }else{
            return (new URL(document.URL).hash).slice(1);
        }
    }

    updateComponent(){
        if(!this.isMenu){
            this.url = this.baseUrl + this.getPageUrl();
            this.getDown(this.url); // we reset
        }else{
            this.runAsMenu();
        }
    }


    initComponent = () => {
        let pageUrl = this.getPageUrl();
        if(this.isMenu){
            this.getDown(this.url);
            this.runAsMenu();
        }else{
            if(isEmpty(pageUrl)){
                // hard coded home page
                this.getDown(this.defaultUrl);
            }else{
                this.url = this.baseUrl + pageUrl;
                this.getDown(this.url);
            }
        }
        this.init = true;
    }



    runAsMenu = () => {
        var currentURL = window.location.href;
        
        // Get all the links on the page
        var links = this.template.querySelectorAll('a');
        // Loop through each link and compare its href with the current URL
        for (var i = 0; i < links.length; i++) {
            var link = links[i];
            var linkURL = link.href;
            // Check if the link's href matches the current URL
            if (linkURL === currentURL) {
                console.log('link',link);
                // Add a class to the matching link
                link.parentElement.classList.add('currentlist');
            }else{
                link.parentElement.classList.remove('currentlist');
            }
        }
    }
    
    async getDown(url){
        const content = await (await fetch(url)).text();
        this.setMarkdown(this.replaceLinks(content))
    }

    setMarkdown(markdown){
        // eslint-disable-next-line @lwc/lwc/no-inner-html
        this.refs.container.innerHTML = marked()(markdown);
        if(this.isMenu)this.runAsMenu();
    }

    replaceLinks = (content) => {

        // Links
        let urlPattern = /\[(.*)\]\([\.\/|\.\.\/]+(.*?)\)/g;
        let updatedContent = content.replace(urlPattern,function(match, p1, p2){
            if(p1 === 'Table of Contents'){
                return `[Table of Contents](${window.location.origin}/cta)`;
            }else{
                return `[${p1}](${window.location.origin}/cta#${p2})`;
            }
        });

        // Images
        let imagePattern = /\!\[(.*)\]\((.*?)\)/g;
        updatedContent = updatedContent.replace(imagePattern,function(match, p1, p2){
           
            let splitted = p2.split('Images/');
            let newLink = splitted.length > 1 ? splitted[1]:splitted[0];
            return `![${p1}](https://github.com/grebmann1/cta-cheat-sheet/raw/main/Images/${newLink})`;
        });
        return updatedContent;
    }
    
}