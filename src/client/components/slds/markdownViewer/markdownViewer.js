import { api, LightningElement,createElement } from 'lwc';
import { marked } from 'shared/markdown';
import { isEmpty } from 'shared/utils';
import sldsCodeBlock from 'slds/codeBlock';

export default class MarkdownViewer extends LightningElement {
    
    @api value;
    


    connectedCallback(){
        window.setTimeout(() => {
            this.getDown(this.value);
        },1);
    }


    
    
    

    /** Methods */

    getDown = (content) =>{
        this.setMarkdown(content);
    }

    setMarkdown = (markdown) =>{
        var html = marked()(markdown);
        this.refs.container.innerHTML = html;
        this.transformCodeBlockToComponents();

    }

    transformCodeBlockToComponents = () => {
        //console.log('transformCodeBlockToComponents');
        const mapping = {js: "javascript",apex:"apex"};
        this.refs.container.querySelectorAll("pre .language-java,pre .language-apex,pre .language-javascript,pre .language-soql")
        .forEach( el => {
            //const newTarget = el.parentNode;
            
            el.setAttribute("lwc:dom", "manual");
            const list = el.classList;
            let c = "";
            for (const d in list)
                if (typeof list[d] == "string") {
                    const p = list[d];
                    p.startsWith("language-") && (c = p.split("-")[1])
                }
            const newElement = createElement("slds-code-block", {
                is: sldsCodeBlock
            });
            console.log('createElement',mapping[c] || c);
            Object.assign(newElement, {
                codeBlock: el.innerHTML,
                language: mapping[c] || c,
                title: "",
            }),
            el.innerHTML = "",
            el.appendChild(newElement)
            //newTarget.replaceWith(newElement)
        })
    }
    
}