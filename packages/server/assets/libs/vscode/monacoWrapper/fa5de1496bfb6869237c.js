"use strict";var U=Object.create;var l=Object.defineProperty;var x=Object.getOwnPropertyDescriptor;var _=Object.getOwnPropertyNames;var C=Object.getPrototypeOf,P=Object.prototype.hasOwnProperty;var D=(s,i)=>{for(var e in i)l(s,e,{get:i[e],enumerable:!0})},h=(s,i,e,t)=>{if(i&&typeof i=="object"||typeof i=="function")for(let o of _(i))!P.call(s,o)&&o!==e&&l(s,o,{get:()=>i[o],enumerable:!(t=x(i,o))||t.enumerable});return s};var b=(s,i,e)=>(e=s!=null?U(C(s)):{},h(i||!s||!s.__esModule?l(e,"default",{value:s,enumerable:!0}):e,s)),S=s=>h(l({},"__esModule",{value:!0}),s);var I={};D(I,{activate:()=>R});module.exports=S(I);var r=b(require("vscode"));var n=b(require("vscode"));function V(s){for(;s.length;)s.pop()?.dispose()}var p=class{_isDisposed=!1;_disposables=[];dispose(){this._isDisposed||(this._isDisposed=!0,V(this._disposables))}_register(i){return this._isDisposed?i.dispose():this._disposables.push(i),i}get isDisposed(){return this._isDisposed}};function g(){if(typeof crypto.randomUUID=="function")return crypto.randomUUID.bind(crypto)();let s=new Uint8Array(16),i=[];for(let o=0;o<256;o++)i.push(o.toString(16).padStart(2,"0"));crypto.getRandomValues(s),s[6]=s[6]&15|64,s[8]=s[8]&63|128;let e=0,t="";return t+=i[s[e++]],t+=i[s[e++]],t+=i[s[e++]],t+=i[s[e++]],t+="-",t+=i[s[e++]],t+=i[s[e++]],t+="-",t+=i[s[e++]],t+=i[s[e++]],t+="-",t+=i[s[e++]],t+=i[s[e++]],t+="-",t+=i[s[e++]],t+=i[s[e++]],t+=i[s[e++]],t+=i[s[e++]],t+=i[s[e++]],t+=i[s[e++]],t}var a=class s extends p{constructor(e,t,o){super();this.extensionUri=e;this._webviewPanel=this._register(o),this._webviewPanel.webview.options=s.getWebviewOptions(e),this._register(this._webviewPanel.webview.onDidReceiveMessage(c=>{switch(c.type){case"openExternal":try{let d=n.Uri.parse(c.url);n.env.openExternal(d)}catch{}break}})),this._register(this._webviewPanel.onDidDispose(()=>{this.dispose()})),this._register(n.workspace.onDidChangeConfiguration(c=>{if(c.affectsConfiguration("simpleBrowser.focusLockIndicator.enabled")){let d=n.workspace.getConfiguration("simpleBrowser");this._webviewPanel.webview.postMessage({type:"didChangeFocusLockIndicatorEnabled",focusLockEnabled:d.get("focusLockIndicator.enabled",!0)})}})),this.show(t)}static viewType="simpleBrowser.view";static title=n.l10n.t("Simple Browser");static getWebviewLocalResourceRoots(e){return[n.Uri.joinPath(e,"media")]}static getWebviewOptions(e){return{enableScripts:!0,enableForms:!0,localResourceRoots:s.getWebviewLocalResourceRoots(e)}}_webviewPanel;_onDidDispose=this._register(new n.EventEmitter);onDispose=this._onDidDispose.event;static create(e,t,o){let c=n.window.createWebviewPanel(s.viewType,s.title,{viewColumn:o?.viewColumn??n.ViewColumn.Active,preserveFocus:o?.preserveFocus},{retainContextWhenHidden:!0,...s.getWebviewOptions(e)});return new s(e,t,c)}static restore(e,t,o){return new s(e,t,o)}dispose(){this._onDidDispose.fire(),super.dispose()}show(e,t){this._webviewPanel.webview.html=this.getHtml(e),this._webviewPanel.reveal(t?.viewColumn,t?.preserveFocus)}getHtml(e){let t=n.workspace.getConfiguration("simpleBrowser"),o=g(),c=this.extensionResourceUrl("media","index.js"),d=this.extensionResourceUrl("media","main.css"),y=this.extensionResourceUrl("media","codicon.css");return`<!DOCTYPE html>
			<html>
			<head>
				<meta http-equiv="Content-type" content="text/html;charset=UTF-8">

				<meta http-equiv="Content-Security-Policy" content="
					default-src 'none';
					font-src data:;
					style-src ${this._webviewPanel.webview.cspSource};
					script-src 'nonce-${o}';
					frame-src *;
					">

				<meta id="simple-browser-settings" data-settings="${W(JSON.stringify({url:e,focusLockEnabled:t.get("focusLockIndicator.enabled",!0)}))}">

				<link rel="stylesheet" type="text/css" href="${d}">
				<link rel="stylesheet" type="text/css" href="${y}">
			</head>
			<body>
				<header class="header">
					<nav class="controls">
						<button
							title="${n.l10n.t("Back")}"
							class="back-button icon"><i class="codicon codicon-arrow-left"></i></button>

						<button
							title="${n.l10n.t("Forward")}"
							class="forward-button icon"><i class="codicon codicon-arrow-right"></i></button>

						<button
							title="${n.l10n.t("Reload")}"
							class="reload-button icon"><i class="codicon codicon-refresh"></i></button>
					</nav>

					<input class="url-input" type="text">

					<nav class="controls">
						<button
							title="${n.l10n.t("Open in browser")}"
							class="open-external-button icon"><i class="codicon codicon-link-external"></i></button>
					</nav>
				</header>
				<div class="content">
					<div class="iframe-focused-alert">${n.l10n.t("Focus Lock")}</div>
					<iframe sandbox="allow-scripts allow-forms allow-same-origin allow-downloads"></iframe>
				</div>

				<script src="${c}" nonce="${o}"><\/script>
			</body>
			</html>`}extensionResourceUrl(...e){return this._webviewPanel.webview.asWebviewUri(n.Uri.joinPath(this.extensionUri,...e))}};function W(s){return s.toString().replace(/"/g,"&quot;")}var w=class{constructor(i){this.extensionUri=i}_activeView;dispose(){this._activeView?.dispose(),this._activeView=void 0}show(i,e){let t=typeof i=="string"?i:i.toString(!0);if(this._activeView)this._activeView.show(t,e);else{let o=a.create(this.extensionUri,t,e);this.registerWebviewListeners(o),this._activeView=o}}restore(i,e){let t=e?.url??"",o=a.restore(this.extensionUri,t,i);this.registerWebviewListeners(o),this._activeView??=o}registerWebviewListeners(i){i.onDispose(()=>{this._activeView===i&&(this._activeView=void 0)})}};var B="simpleBrowser.api.open",O="simpleBrowser.show",f="workbench.action.browser.open",k=new Set(["localhost","127.0.0.1","[0:0:0:0:0:0:0:1]","[::1]","0.0.0.0","[0:0:0:0:0:0:0:0]","[::]"]),E="simpleBrowser.open";async function u(){return(await r.commands.getCommands(!0)).includes(f)}async function m(s){await r.commands.executeCommand(f,s)}function R(s){let i=new w(s.extensionUri);s.subscriptions.push(i),s.subscriptions.push(r.window.registerWebviewPanelSerializer(a.viewType,{deserializeWebviewPanel:async(e,t)=>{i.restore(e,t)}})),s.subscriptions.push(r.commands.registerCommand(O,async e=>{if(await u())return m(e);e||(e=await r.window.showInputBox({placeHolder:r.l10n.t("https://example.com"),prompt:r.l10n.t("Enter url to visit")})),e&&i.show(e)})),s.subscriptions.push(r.commands.registerCommand(B,async(e,t)=>{await u()?await m(e.toString(!0)):i.show(e,t)})),s.subscriptions.push(r.window.registerExternalUriOpener(E,{canOpenExternalUri(e){let t=new URL(e.toString(!0));return k.has(t.hostname)?L()?r.ExternalUriOpenerPriority.Default:r.ExternalUriOpenerPriority.Option:r.ExternalUriOpenerPriority.None},async openExternalUri(e){if(await u())await m(e.toString(!0));else return i.show(e,{viewColumn:r.window.activeTextEditor?r.ViewColumn.Beside:r.ViewColumn.Active})}},{schemes:["http","https"],label:r.l10n.t("Open in simple browser")}))}function L(){return!(typeof process=="object"&&process.versions.node)&&r.env.uiKind===r.UIKind.Web}
//# sourceMappingURL=extension.js.map
