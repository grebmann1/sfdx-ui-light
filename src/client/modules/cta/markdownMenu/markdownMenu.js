import { api, LightningElement } from 'lwc';
import { isEmpty } from 'shared/utils';
import { marked } from 'shared/markdown';

export default class MarkdownMenu extends LightningElement {
    
    init = false;

    @api defaultUrl;
    @api url;
    @api baseUrl;

    async connectedCallback(){
        if(!this.init){
            await this.getDown(this.url);
            this.runAsMenu();
            this.init = true;
            this.sendMenu();
        }
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
                // Add a class to the matching link
                link.parentElement.classList.add('slds-is-active');
            }else{
                link.parentElement.classList.remove('slds-is-active');
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


    navigateBetweenLinks = (isNext) => {
        var links = this.template.querySelectorAll('a');
        let index = [...links].findIndex(x => x.parentElement.classList.contains('slds-is-active'));
        let nextIndex = isNext ? index+1 : index - 1;
        if(nextIndex >= 0 && nextIndex < links.length){
            window.location = links[nextIndex].href;
        }else{
            console.warn('Out of bound array')
        }
    }

    sendMenu = () => {
        var links = this.template.querySelectorAll('a');
        let index = [...links].findIndex(x => x.parentElement.classList.contains('slds-is-active'));

        this.dispatchEvent(new CustomEvent("menu",{detail:{current:index,links:[...links].map(x => ({
            href:x.href,
            title:x.text
        }))}}));
    }

    /** Methods */
    

    @api 
    updateComponent(){
        this.runAsMenu();
    }

    
}