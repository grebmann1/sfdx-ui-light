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
        this.enable_codeViewer();
        this.enable_mermaid();

    }

    enable_codeViewer = () => {
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

    enable_mermaid = () => {
        this.refs.container.querySelectorAll("pre .language-mermaid")
        .forEach( async el => {
            this.renderMermaid(el);
        });
    }


    fixDiagram = (input) => {
        function camelCaseToLowercaseWords(input) {
            return input.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
        }
        
        function fixClassName(line) {
            const match = line.match(/([A-Z][a-zA-Z0-9]*)\s*\{/);
            if (match) {
                const className = match[1];
                //const newClassName = camelCaseToLowercaseWords(className); // we dont use, it's more complicate
                return line.replace(className, `class ${className}`);
            }
            return line;
        }

        // Split the input into lines for easier manipulation.
        const lines = input.split('\n');
        let isValidDiagram = false;
        let fixedDiagram = [];
    
        lines.forEach(line => {
            //line = line.trim();
    
            if (line.startsWith('classDiagram')) {
                isValidDiagram = true;
            }
    
            if (isValidDiagram) {
                // Fix class names
                line = fixClassName(line);
                fixedDiagram.push(line);
            } else {
                fixedDiagram.push(line);
            }
        });
    
        // Join the fixed lines back into a single string.
        return fixedDiagram.join('\n');
    }
    

    renderMermaid = async (el) => {

        

        try{
            const diagramText = this.fixDiagram(el.innerText);
            console.log('diagramText');
            console.log(diagramText);
            if(await mermaid.parse(diagramText)){
                const { svg,bindFunctions } = await window.mermaid.render('graphDiv',diagramText);
                el.innerHTML = svg;
            }else{
                console.log('Invalid format')
            }
            
        }catch(e){
            console.log('Unknown diagram & error',e);
        }
    }
    
}