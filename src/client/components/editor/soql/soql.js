import { api,wire } from "lwc";
import ToolkitElement from 'core/toolkitElement';
import { isEmpty,isElectronApp,classSet,isNotUndefinedOrNull,runActionAfterTimeOut,guid } from 'shared/utils';
import loader from '@monaco-editor/loader';
import { formatQuery,parseQuery } from '@jetstreamapp/soql-parser-js';
import { SOQL } from 'editor/languages';
import { store,connectStore } from 'core/store';
import SOQLParser from './soqlParser';
import SuggestionHandler from './suggestion';

export default class Soql extends ToolkitElement {

    @api maxHeight;
    @api files = [];
    @api currentFile;
    @api metadataType;
    @api isActionHidden = false;
    @api isAddTabEnabled = false;

    @api isTabEnabled = false; // by default, we display tabs
    


    models = [];
    editor;
    monaco;

    isEditMode = false;
    isLoading = false;
    hasLoaded = false;

    counter = 0;


    _useToolingApi = false;

    @wire(connectStore, { store })
    storeChange({ ui,sobject }) {
        if(ui && ui.hasOwnProperty('useToolingApi')){
            this._useToolingApi = ui.useToolingApi;
        }
    }


    async connectedCallback(){
        await this.loadMonacoEditor();
    }

    /** Events */



    /** Methods **/

    createEditor = (model) => {

       /* const innerContainer2 = document.createElement('div');
            innerContainer2.setAttribute("slot", "editor");
            innerContainer2.style.width = '100%';
            innerContainer2.style.height = '100%';
        this.refs.editor.appendChild(innerContainer2);*/

        this.currentFile = model;
        this.editor = this.monaco.editor.create(this.refs.editor, {
            model: model,
            //theme:'vs-dark',
            wordWrap: "on",
            minimap: {
                enabled: false
            },
            automaticLayout:true,
            readOnly: false,
            scrollBeyondLastLine: false,
            fixedOverflowWidgets: true
        });
        this.editor.onDidChangeModelContent(this.handleModelContentChange);
        /*this.editor.addCommand(this.monaco.KeyMod.CtrlCmd | this.monaco.KeyCode.KEY_S, () => {
            console.log('SAVE pressed!');
        });*/
        this.editor.onKeyDown((e) => {
            if ((e.ctrlKey || e.metaKey) && e.keyCode === this.monaco.KeyCode.KeyS) {
                e.preventDefault();
                this.dispatchEvent(new CustomEvent("monacosave", {bubbles: true,composed:true }));
            }
        });
    }

    loadMonacoEditor = async () => {
        this.monaco = await loader.init();
        // Setup
        this.configureSoqlLanguage(this.monaco);
        //this.configureTheme(this.monaco)

        this.dispatchEvent(new CustomEvent("monacoloaded", {bubbles: true }));
        this.hasLoaded = true;
    }

    /*configureTheme = (monaco) => {
        monaco.editor.defineTheme("sftoolkitTheme", {
            base: "vs",
            inherit: true,
            rules: [{
                background: "#FFFFFF"
            }],
            colors: {}
        })
    }*/

    configureSoqlLanguage = (monaco) => {
        monaco.languages.register({
            id: 'soql'
        });
        monaco.languages.setLanguageConfiguration('soql', SOQL.languageConfiguration);
        monaco.languages.setMonarchTokensProvider('soql', SOQL.language);
    
        monaco.languages.registerDocumentFormattingEditProvider('soql', {
            provideDocumentFormattingEdits: async (model, options, token) => {
                return [{
                    range: model.getFullModelRange(),
                    text: formatQuery(model.getValue(),{
                        fieldMaxLineLength: 20,
                        fieldSubqueryParensOnOwnLine: false,
                        whereClauseOperatorsIndented: true,
                      }),
                }, ];
            },
        });
        monaco.languages.registerCompletionItemProvider('soql', {
            provideCompletionItems: this.generateCompletion,
        });
    }

    handleModelContentChange = (event) => {
        //console.log('onDidChangeModelContent');
        //this.dispatchEvent(new CustomEvent("change", {detail:{value:this.editor.getValue(),type:'body'},bubbles: true }));
        const objectRegex = /.*\s(from(?![^\(]*\)))\s+($|\w+).*$/gim
        const query = this.editor.getValue().toLowerCase();
        const position = this.editor.getPosition()
        const beforeText = this.editor.getModel().getValueInRange({
            startLineNumber: 1,
            startColumn: 1,
            endLineNumber: position.lineNumber,
            endColumn: position.column
        }).toUpperCase();

        let objectRegexResult = objectRegex.exec(query);
        if(isNotUndefinedOrNull(objectRegexResult)){
            let referenceTo = objectRegexResult[2];
            if(isNotUndefinedOrNull(referenceTo) && (beforeText.endsWith("AND ") || beforeText.endsWith("OR ") || beforeText.endsWith(", "))){
                this.editor.trigger("", "editor.action.triggerSuggest");
            }
        }
        runActionAfterTimeOut(this.editor.getValue(),(value) => {
            this.dispatchEvent(new CustomEvent("change", {detail:{value:this.editor.getValue(),type:'body'},bubbles: true }));
        },{timeout:200});
    }

    getCompletionItems = (parserInstance, suggestionInstance) => {
        console.log('parserInstance',parserInstance);
        const isSelectPosition = (parser, sub = false) => {
            return sub ? parser.subquery.position === "select" : parser.position === "select";
        };
    
        const hasFromObject = (parser, sub = false) => {
            return sub ? parser.subquery.fromObject !== null : parser.fromObject !== null;
        };
    
        const isWherePosition = (parser, sub = false) => {
            return sub ? parser.subquery.position === "where" : parser.position === "where";
        };
    
        const getFilterCompletionItems = (parser, sub = false) => {
            const query = sub ? parser.subquery : parser;
            if (query.filter.field && query.filter.operator) {
                if (query.filter.value.startsWith("(")) {
                    return Promise.all([
                        suggestionInstance.getTypeFieldSuggestions(query.fromObject, query.filter),
                        suggestionInstance.getSObjectSuggestions(true)
                    ]).then(results => [...results[0], ...results[1]]);
                } else {
                    return suggestionInstance.getTypeFieldSuggestions(query.fromObject, query.filter);
                }
            } else {
                return suggestionInstance.getFieldSuggestions(false);
            }
        };
    
        const getSubqueryItems = () => {
            if (parserInstance.subquery.type === "select" && !parserInstance.subquery.hasSelect) {
                return suggestionInstance.getChildRelationshipSuggestions(true);
            }
            if (isWherePosition(parserInstance, true) && hasFromObject(parserInstance, true)) {
                return getFilterCompletionItems(parserInstance, true);
            }
            if (isSelectPosition(parserInstance, true) && !parserInstance.subquery.fromRelation.length) {
                return suggestionInstance.getFieldSuggestions(parserInstance.isSubQuery);
            }
            return null;
        };
        //console.log('parserInstance',parserInstance)
        if (parserInstance.isSubQuery || parserInstance.hasSelect) {
            if (parserInstance.isSubQuery || parserInstance.position !== "select" || parserInstance.fromObject !== null) {
                const subqueryItems = parserInstance.isSubQuery ? getSubqueryItems() : null;
                //console.log('--> suggestion 0 - subqueryItems',subqueryItems);
                if (subqueryItems) return subqueryItems;
    
                if (parserInstance.fromRelation.length && (isSelectPosition(parserInstance) || isWherePosition(parserInstance)) && hasFromObject(parserInstance)) {
                    //console.log('--> suggestion 1');
                    return suggestionInstance.getLookupFieldSuggestions();
                }
    
                if (isSelectPosition(parserInstance) && hasFromObject(parserInstance) && !parserInstance.fromRelation.length) {
                    //console.log('--> suggestion 2');
                    return suggestionInstance.getFieldSuggestions(parserInstance.isSubQuery);
                }
    
                if (parserInstance.position === "from" && parserInstance.lastWord === parserInstance.fromObject /*!hasFromObject(parserInstance, true)*/ || (parserInstance.isSubQuery && (parserInstance.subquery.position === "from" || !parserInstance.subquery.hasSelect))) {
                    //console.log('--> suggestion 3');
                    return suggestionInstance.getSObjectSuggestions(false);
                }

                if(parserInstance.position === "from" && hasFromObject(parserInstance)){
                    //console.log('--> suggestion 3.1');
                    return suggestionInstance.getAfterFromSuggestions(parserInstance);
                }
    
                if (isWherePosition(parserInstance) && hasFromObject(parserInstance) && !parserInstance.isSubQuery) {
                    //console.log('--> suggestion 4');
                    return getFilterCompletionItems(parserInstance);
                }
    
                if (parserInstance.position === "order by") {
                    //console.log('--> suggestion 5');
                    return suggestionInstance.getFieldSuggestions(false);
                }
    
                if (parserInstance.position === "group by" || parserInstance.position === "having") {
                    //console.log('--> suggestion 6');
                    return suggestionInstance.getSelectedFields();
                }
            } else if(parserInstance.fromObject !== null) {
                //console.log('--> suggestion 7');
                return suggestionInstance.getSObjectSuggestions(true);
            } else if(parserInstance.fromObject === null && parserInstance.position === 'select'){
                return suggestionInstance.getFromSuggestions();
            }
        } else {
            //console.log('--> suggestion 8');
            return suggestionInstance.getSObjectSuggestions(true,true);
        }
    }
    

    generateCompletion = (model,position,context) => {
        return new Promise((resolve,reject) => {
            let completionItems = new Promise((resolve) => resolve([]));

            const textBefore = model.getValueInRange({
                startLineNumber: 1,
                startColumn: 1,
                endLineNumber: position.lineNumber,
                endColumn: position.column
            })
            const textAfter = model.getValue().substring(textBefore.length);
        
            const parserInstance = new SOQLParser().process(textBefore,textAfter);
            const suggestionInstance = new SuggestionHandler(monaco,parserInstance,this.connector,this._useToolingApi);

            completionItems = this.getCompletionItems(parserInstance,suggestionInstance) || completionItems;

            //console.log('### Text ###',textBefore,textAfter);
            //console.log('suggestionInstance',suggestionInstance);
            //console.log('parserInstance',parserInstance);
            //console.log('##### completionItems #####',completionItems);

            Promise.resolve(completionItems).then(res => {
                resolve({
                    suggestions: res,
                })
            });
        })
    }
    
    @api
    addMarkers = (markers) => {
        this.monaco.editor.setModelMarkers(this.currentModel, "owner", markers);
    }

    @api
    resetMarkers = () => {
        this.monaco.editor.setModelMarkers(this.currentModel, "owner",[]);
    }


    @api
    displayModel = (model) => {
        if(this.editor){
            this.editor.setModel(model); // set last model
        }else{
            this.createEditor(model);
        }
    }

    @api
    createModel = ({body,language}) => {
        return this.monaco.editor.createModel(body,language);
    }


    /** Deployment Methods */


    /** Getters */

    @api
    get currentModel(){
        return this.editor?.getModel() || null;
    }

    @api
    get currentEditor(){
        return this.editor;
    }

    @api
    get currentMonaco(){
        return this.monaco;
    }

    @api 
    get editorUpdatedFiles(){
        return this.models.map(x => {
            return {
                ...x._file,
                body:x.model.getValue()
            }
        })
    }
    
    get formattedModels(){
        return this.models.map(x => ({
            ...x,
            isCloseable:this.models.length > 1,
            class:classSet('slds-tabs_scoped__item').add({'slds-is-active':x.path === this.currentFile}).toString()
        }))
    }

    get isToolDisplayed(){
        return this.models.length > 0;
    }

}