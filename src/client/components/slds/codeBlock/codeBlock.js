import { LightningElement,api,track } from "lwc";
import { isEmpty,runActionAfterTimeOut } from 'shared/utils';

export default class CodeBlock extends LightningElement {

	prismInitialized = false;
	@track _codeBlock;
	prism;

	@api
	set language(value) {
		this._language = value.toLowerCase();
		this.highlightCodeSegment();
	}
	get language() {
		return this._language;
	}

	@api
	set codeBlock(value) {
		this._codeBlock = value;
		if (this.prismInitialized === true) {
			this.highlightCodeSegment();
		}
	}
	get codeBlock() {
		return this._codeBlock;
	}



	renderedCallback() {
		this.loadPrism();
    }


	connectedCallback(){
		this.template.addEventListener('click',this.handleCodeBlockClicks);
	}

	disconnectedCallback(){
		this.template.removeEventListener('click',this.handleCodeBlockClicks);
	}



	/** Methods  **/


	loadPrism() {
		this.prismInitialized = true;
		if (this.prism === undefined) {
			this.prism = window.Prism;
            this.highlightCodeSegment();
		} else {
			this.highlightCodeSegment();
		}
	}

	highlightCodeSegment() {
		if (this.prism) {
			let codeBlockEl = this.template.querySelector("pre");
			// eslint-disable-next-line
			if (codeBlockEl.innerHTML !== "") {
				// eslint-disable-next-line
				codeBlockEl.innerHTML = "";
				//codeBlockEl.classList.remove("language-javascript");
			}
			codeBlockEl.classList.add("line-numbers");
			const codeEl = document.createElement("code");
				codeEl.classList.add(`language-${this._language}`);
			if (this._language === "java") {
				this._codeBlock = this._codeBlock
					.replace(/</g, "&lt;")
					.replace(/>/g, "&gt;");
			}
			// eslint-disable-next-line
			codeEl.innerHTML = this._codeBlock;
			codeBlockEl.appendChild(codeEl);
			//console.log('codeBlockEl',codeBlockEl);
			this.prism.hooks.add('wrap', function (env) {
				if(env.type !== 'string') return;
				const text = env.content.replaceAll('"','').replaceAll('\'','');
				if(text.startsWith('/') || text.startsWith('http')){
					//console.log('env',env);
					env.attributes['data-url'] = text;
					env.tag = 'a';
					if(env.classes.length > 0){
						env.classes.push('slds-link')
					}
				}
			});

			//this.prism.hooks.add('after-highlight',(env) => {})
			
			this.prism.highlightAllUnder(codeBlockEl,false,()=>{
				//console.log('callback');
			});
		}
	}

	/*dynamiseLinks = () => {
		//console.log('this.refs.codeblockcontainer',this.refs);
		const elements = [...this.refs.codeblockcontainer.querySelectorAll('.token.string')];
		//console.log('elements',elements);
		elements.forEach(x => {
			const text = x.innerText.replaceAll('"','').replaceAll('\'','');
			if(text.startsWith('/') || text.startsWith('http')){
				//console.log('relative link');
				//x.innerHTML
			}
		})
	}*/

	/** Events **/

	handleCodeBlockClicks =  (e) => {
		if(e.target.matches('a')) {
			if(!isEmpty(e.target.dataset?.url)){
				this.dispatchEvent(
					new CustomEvent('customlink', {
						detail: {
							url:e.target.dataset.url
						},
						bubbles: true,
						composed: true 
					})
				);
			}
		}
	}

	handleCopy = () => {
        navigator.clipboard.writeText(this._codeBlock);
    }


	

}