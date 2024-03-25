import { LightningElement,api,track } from "lwc";

export default class CodeBlock extends LightningElement {
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

	prismInitialized = false;
	@track _codeBlock;

	prism;

	renderedCallback() {
		this.loadPrism();
	}

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
            console.log('highlightCodeSegment');
			let codeBlockEl = this.template.querySelector("pre");
			// eslint-disable-next-line
			if (codeBlockEl.innerHTML !== "") {
				// eslint-disable-next-line
				codeBlockEl.innerHTML = "";
				codeBlockEl.classList.remove("language-javascript");
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
			this.prism.highlightAllUnder(codeBlockEl);
		}
	}
}