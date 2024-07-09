import { wire, api } from 'lwc';
import getCaretCoordinates from 'textarea-caret';
import ToolkitElement from 'core/toolkitElement';
import { store,connectStore,SELECTORS,SOBJECT,DESCRIBE,QUERY,UI } from 'core/store';
import { fullApiName,stripNamespace,escapeRegExp,isUndefinedOrNull,lowerCaseKey } from 'shared/utils';

const SOQL_SYNTAX_KEYWORDS = [
    'SELECT',
    'FROM',
    'USING SCOPE',
    'WHERE',
    'AND',
    'OR',
    'LIKE',
    'IN',
    'GROUP BY',
    'HAVING',
    'ORDER BY',
    'ASC',
    'DESC',
    'NULLS FIRST',
    'NULLS LAST',
    'LIMIT',
    'OFFSET'
];
const __fetching__ = '__fetching__';


class BasicSOQLParser {
    constructor(query) {
        this.query = query;
        this.tokens = [];
        this.position = 0;
        this.currentToken = null;
    }

    tokenize() {
        const regex = /\b(SELECT|FROM|WHERE|LIMIT|ORDER BY|GROUP BY|HAVING|IN|NOT IN|AND|OR|ASC|DESC)\b|['"][^'"]*['"]|\*|\w+|\(|\)|,|./gi;
        this.tokens = this.query.match(regex).filter(token => token.trim().length > 0);
    }

    nextToken() {
        if (this.position < this.tokens.length) {
            this.currentToken = this.tokens[this.position++];
        } else {
            this.currentToken = null;
        }
        return this.currentToken;
    }

	parseFrom(){
		this.tokenize();
		while (this.nextToken()) {
            if(this.currentToken.toUpperCase() === 'FROM'){
				return this.nextToken();
			}
		}
		return this.currentToken;
	}

    
}

export default class QueryEditorPanel extends ToolkitElement {
    @api namespace;
    
    isMenuSmall = false;
    isCompletionVisible;
    completionStyle;
    completionItems;
    _sobjectMeta;
    _selectionStart;
    _soql;
    _currentEvent;
    isLoadingCompletion = false;

    get soql() {
        return this._soql;
    }

    set soql(value) {
        this._soql = value;
        const inputEl = this.template.querySelector('.soql-input');
        if (inputEl && inputEl.value != value){
            inputEl.value = isUndefinedOrNull(value)?'':value;
        }
    }

    @api
    get useToolingApi(){
        return this._useToolingApi;
    }
    set useToolingApi(value){
        this._useToolingApi = value === true;
        store.dispatch(DESCRIBE.describeSObjects({
            connector:this.connector.conn,
            useToolingApi:this._useToolingApi
        }));
    }

    //fetchSObjectsIfNeeded

    _childRelationships = [];
    _sobjectSize = 0;
    @wire(connectStore, { store })
    storeChange({ ui,sobject }) {
        const { query, soql } = ui;
        if (query) {
            const sobjectState = SELECTORS.sobject.selectById({sobject},lowerCaseKey(fullApiName(query.sObject,this.namespace)));
            if (sobjectState) {
                this._sobjectMeta = sobjectState.data;
            }
            if(query && this._sobjectMeta){
                this.mapChildRelationships(query);
            }
        }

        const sobjects = SELECTORS.sobject.selectAll({sobject});
        if(sobjects.length > 0 && this._sobjectSize != sobjects.filter(x => !x.isFetching).length && this._currentKeyword && this._currentTargetValue){
            // force a live refresh
            console.log('force a live refresh');
            this._generateCompletionItems(this._currentKeyword,this._currentTargetValue);
            this._sobjectSize = sobjects.filter(x => !x.isFetching).length;
        }
        
        //if (soql !== this.soql) {
            this.soql = soql;
        //}
    }
/*
    @wire(connectStore, { store:store })
    storeChange2({ sobject }) {
        console.log('sobject --> new ',sobject);
        const sobjects = sobjectSelectors.selectAll(store.getState());
        if(sobjects.length > 0 && this._sobjectSize != sobjects.filter(x => !x.isFetching).length && this._currentKeyword && this._currentTargetValue){
            // force a live refresh
            console.log('force a live refresh');
            this._generateCompletionItems(this._currentKeyword,this._currentTargetValue);
            this._sobjectSize = sobjects.filter(x => !x.isFetching).length;
        }
    }*/

    runQuery() {
        this._runQuery();
    }

    runQueryAll() {
        this._runQuery(true);
    }

    formatQuery() {
        store.dispatch(UI.reduxSlice.actions.formatSoql());
    }

    mapChildRelationships = (query) => {
        const relationships = query.fields.filter(x => x.type === 'FieldSubquery').map(x => x.subquery.relationshipName);
        const SObjects = this._sobjectMeta.childRelationships.filter(x =>relationships.includes(x.relationshipName)).map(x => x.childSObject);
        SObjects
        .filter(sobjectName => !this._childRelationships.includes(sobjectName))
        .forEach(sobjectName => {
            this._childRelationships.push(sobjectName);
            store.dispatch(SOBJECT.describeSObject({
                connector:this.connector.conn,
                sObjectName:sobjectName,
                useToolingApi:this.useToolingApi
            }))
        })
        
    }

    insertItem(event) {
        const key = event.target.dataset.key;
        if (this._closeCompletionTimer) {
            clearTimeout(this._closeCompletionTimer);
        }
        const selectedItem = this.completionItems.find(
            item => item.key === key
        );
        const inputEl = this.template.querySelector('.soql-input');
        this._insertItem(inputEl, selectedItem);
    }

    handleToolingApiCheckboxChange = (e) => {
        this.useToolingApi = e.detail.checked;
    }

    handleKeyupSoql(event) {
        const { value } = event.target;
        if (this._soql !== value) {
            store.dispatch(UI.reduxSlice.actions.updateSoql({
                connector:this.queryConnector,
                soql:value
            }));
        }

        if (!this._sobjectMeta) return;
        if (!this.isCompletionVisible) {
            this._openCompletion(event);
        } else {
            this._handleCompletion(event);
        }
    }

    handleKeydownSoql(event) {
        const { key, isComposing } = event;
        if (this.isCompletionVisible) {
            if (isComposing) return;
            switch (key) {
                case 'ArrowDown':
                    this._selectBellowItem(event);
                    break;
                case 'ArrowUp':
                    this._selectAboveItem(event);
                    break;
                case 'Enter':
                    this._insertItemByKeyboard(event);
                    break;
                default:
                    break;
            }
        } else {
            if (isComposing && key === 'Enter') {
                this._openCompletion(event);
            }
        }
    }

    handleBlurSoql() {
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        this._closeCompletionTimer = setTimeout(
            () => this._closeCompletion(),
            100
        );
    }

    _runQuery(isAllRows) {
        const input = this.template.querySelector('.soql-input');
        if (!input) return;
        const query = input.value;
        if (!query) return;
        store.dispatch(QUERY.executeQuery({connector:this.queryConnector,soql:query}, isAllRows));
    }

    _openCompletion(event) {
        const { target } = event;
        this._selectionStart =
            this._findSeparator(
                target.value.substring(0, target.selectionEnd)
            ) || target.selectionEnd;
        if (this._canOpenCompletion(event)) {
            this._searchCompletionItems(event);
        }
    }

    _canOpenCompletion(event) {
        const { key, altKey, ctrlKey, metaKey, isComposing } = event;
        return (
            (ctrlKey && key === ' ') ||
            (key.length === 1 &&
                ![' ', ','].includes(key) &&
                !altKey &&
                !ctrlKey &&
                !metaKey &&
                !isComposing) ||
            (isComposing && key === 'Enter')
        );
    }

    _findSeparator(value) {
        const result = /[,. \n][^, \n]*$/g.exec(value);
        return result && result.index + 1;
    }

    _closeCompletion() {
        this.isCompletionVisible = false;
    }

    _setCompletionPosition(event) {
        const { target } = event;
        const caret = getCaretCoordinates(target, target.selectionStart);
        this.completionStyle = `top:${caret.top + caret.height}px;left:${
            caret.left
        }px;`;
    }

    getPreviousWord(text, position) {
        // Ensure position is within the text length
        if (position <= 0 || position > text.length) {
            return null;
        }
    
        // Find the last space or punctuation before the given position
        let end = position - 1;
        while (end > 0 && /\s|\W/.test(text[end])) {
            end--;
        }
    
        // If no word is found, return null
        if (end === 0 && /\s|\W/.test(text[end])) {
            return null;
        }
    
        // Find the start of the word
        let start = end;
        while (start > 0 && !/\s|\W/.test(text[start - 1])) {
            start--;
        }
    
        // Extract and return the word
        return text.substring(start, end + 1);
    }

    // Function to get the previous word from a given position in text
    getPreviousWord(text, position) {
        if (position <= 0 || position > text.length) return null;

        // Find the end of the word
        let end = position - 1;
        while (end > 0 && /\s|\W/.test(text[end])) end--;
        if (end === 0 && /\s|\W/.test(text[end])) return null;

        // Find the start of the word
        let start = end;
        while (start > 0 && !/\s|\W/.test(text[start - 1])) start--;

        return text.substring(start, end + 1);
    }

    // Function to extract the token immediately following 'FROM' that is not within parentheses
    extractRightFrom(tokens) {
        if (tokens.length <= 1) return null;
        let from = null, isOpen = false;
        for (let i = 0; i < tokens.length - 1; i++) {
            if (tokens[i] === '(') {
                isOpen = true;
            } else if (tokens[i] === ')') {
                isOpen = false;
            } else if (tokens[i].toUpperCase() === 'FROM' && !isOpen) {
                from = tokens[i + 1];
                break;
            }
        }
        return from;
    }

    // Function to check if the token before 'FROM' is an object
    checkIfIsObject(tokens) {
        return tokens.length > 3 && tokens[tokens.length - 3].toUpperCase() === 'FROM';
    }

    // Function to extract the token immediately preceding 'FROM'
    extractLeftFrom(tokens) {
        if (tokens.length <= 1) return null;
        let from = null;
        for (let i = tokens.length - 1; i > 0; i--) {
            if (tokens[i].toUpperCase() === 'FROM') {
                from = tokens[i + 1];
                break;
            }
        }
        return from;
    }

    // Function to check if text at the position is within parentheses
    checkParentheses(text, position) {
        if (position < 0 || position >= text.length) return false;
        let leftParen = false, rightParen = false;

        for (let i = position - 1; i >= 0; i--) {
            if (text[i] === '(') {
                leftParen = true;
                break;
            }
        }

        for (let i = position; i < text.length; i++) {
            if (text[i] === ')') {
                rightParen = true;
                break;
            }
        }

        return leftParen && rightParen;
    }

    // Function to extract lookup target based on initial object and keyword
    extractLookupTarget(sobject,initialObject, keyword) {
        let currentObject = initialObject;
        const words = keyword.split('.').slice(0, -1);
        
        for (const lookup of words) {
            const lookupElement = currentObject.fields.find(x => x.relationshipName === lookup);
            if (!lookupElement) {
                console.error('lookupElement doesn\'t exist', lookup);
                return __fetching__;
            }

            const referenceTo = lowerCaseKey(lookupElement.referenceTo[0]);
            if (!sobject.hasOwnProperty(referenceTo)) {
                console.warn('Not mapped yet, need to be');
                store.dispatch(SOBJECT.describeSObject({
                    connector:this.connector.conn,
                    sObjectName:referenceTo,
                    useToolingApi:this.useToolingApi
                }))
                return __fetching__;
            } else if(sobject[referenceTo].isFetching) {
                return __fetching__;
            }else {
                currentObject = sobject[referenceTo].data;
            }
        }
        return currentObject;
    }

    // Function to get fields matching keyword pattern
    _getFields(sobjectPointer, keywordPattern, lookupFields) {
        return sobjectPointer.fields
            .filter(field => keywordPattern.test(`${field.name} ${field.label}`))
            .map(field => ({
                ...field,
                key: [...lookupFields, field.name].join('.'),
                name: [...lookupFields, field.name].join('.'),
                itemLabel: `${field.name} / ${field.label}`,
                isActive: false,
                isSyntax: false
            }));
    }

    // Function to get lookups matching keyword pattern
    _getLookups(sobjectPointer, keywordPattern, lookupFields) {
        return sobjectPointer.fields
            .filter(field => field.relationshipName && keywordPattern.test(`${field.name} ${field.relationshipName}`))
            .map(field => ({
                ...field,
                name: [...lookupFields, field.relationshipName].join('.'),
                key: [...lookupFields, field.relationshipName].join('.'),
                itemLabel: `${field.relationshipName} (${field.referenceTo.join(',')})`,
                isActive: false,
                isSyntax: false,
                isLookup: true
            }));
    }

    // Function to generate completion items based on keyword and query
    _generateCompletionItems(keyword, query) {
        const _previousWord = this.getPreviousWord(query, this._selectionStart) || '';
        const sobject   = store.getState().sobject.entities;
        const sobjects = SELECTORS.describe.selectById(store.getState(),DESCRIBE.getDescribeTableName(this._useToolingApi));

        const _parserUntil = new BasicSOQLParser(query.substring(0, this._selectionStart));
        const _parserTotal = new BasicSOQLParser(query);
        _parserUntil.tokenize();
        _parserTotal.tokenize();

        const _pointer = _parserUntil.tokens.length - 1;
        const right_tokens = _parserTotal.tokens.slice(_pointer);
        const left_tokens = _parserTotal.tokens.slice(0, _pointer);

        const isInnerQuery = this.checkParentheses(query, this._selectionStart);
        const query_object = this.extractRightFrom(right_tokens) || this.extractLeftFrom(left_tokens);
        let initialObject = this._sobjectMeta;

        if (query_object !== this._sobjectMeta.name) {
            const _child = initialObject.childRelationships.find(x => x.relationshipName === query_object);
            const _lowerCaseChildSObject = lowerCaseKey(_child.childSObject);
            if (_child && sobject.hasOwnProperty(_lowerCaseChildSObject) && !sobject[_lowerCaseChildSObject].isFetching) {
                initialObject = sobject[_lowerCaseChildSObject].data;
            }
        }

        const lookupFields = keyword.split('.');
        const _keyword = lookupFields.pop();
        const keywordPattern = new RegExp(escapeRegExp(_keyword), 'i');

        this.completionItems = [];
        const _lookupTarget = this.extractLookupTarget(sobject,initialObject, keyword);
        const _sobjectPointer = (lookupFields.length > 0 ?_lookupTarget:initialObject) || initialObject;

        if (_previousWord.toUpperCase() === 'FROM') {
            if (isInnerQuery) {
                this.completionItems = this._sobjectMeta.childRelationships
                    .filter(childRelationship => keywordPattern.test(`${childRelationship.relationshipName} ${childRelationship.field}`))
                    .map((childRelationship, index) => ({
                        ...childRelationship,
                        key: index,
                        name: childRelationship.relationshipName,
                        itemLabel: `${childRelationship.relationshipName} / ${childRelationship.field}`,
                        isActive: false,
                        isSyntax: false
                    }));
            } else {
                this.completionItems = sobjects.data.sobjects
                    .filter(x => x.queryable && !x.associateEntityType)
                    .filter(sobject => keywordPattern.test(`${sobject.name} ${sobject.label}`))
                    .map(sobject => ({
                        ...sobject,
                        key: sobject.name,
                        itemLabel: `${sobject.name} / ${sobject.label}`,
                        isActive: false,
                        isSyntax: false
                    }));
            }
        } else if (_sobjectPointer !== __fetching__ ) { // && (!isInnerQuery && query_object === _sobjectPointer.name || keyword.includes('.'))
            const completionFields = this._getFields(_sobjectPointer, keywordPattern, lookupFields);
            const completionLookups = this._getLookups(_sobjectPointer, keywordPattern, lookupFields);
            this.completionItems = [...this.completionItems, ...completionFields, ...completionLookups];
        } else if (isInnerQuery && _sobjectPointer !== __fetching__) {
            /*const _child = _sobjectPointer.childRelationships.find(x => x.relationshipName === query_object);
            const _lowerCaseChildSObject = lowerCaseKey(_child?.childSObject);
            if (_child && sobject.hasOwnProperty(_lowerCaseChildSObject) && !sobject[_lowerCaseChildSObject].isFetching) {
                const completionFields = this._getFields(sobject[_lowerCaseChildSObject].data, keywordPattern, lookupFields);
                const completionLookups = this._getLookups(sobject[_lowerCaseChildSObject].data, keywordPattern, lookupFields);
                this.completionItems = [...this.completionItems, ...completionFields, ...completionLookups];
            } else if (_child) {
                store.dispatch(SOBJECT.describeSObject({
                    connector:this.connector.conn,
                    sObjectName:_child.childSObject,
                    useToolingApi:this.useToolingApi
                }))
            }*/
        }

        const completionClauses = SOQL_SYNTAX_KEYWORDS.filter(syntax => keywordPattern.test(syntax)).map((syntax, index) => ({
            name: syntax,
            key: `syntax_${index}`,
            itemLabel: syntax,
            isActive: false,
            isSyntax: true
        }));

        if (lookupFields.length === 0) {
            this.completionItems = [...this.completionItems, ...completionClauses];
        }

        this.isLoadingCompletion = _sobjectPointer === __fetching__;
        if (this.isLoadingCompletion) {
            this.completionItems = [{ key: 'loading', itemLabel: '', isActive: false, isSyntax: false, isLoading: true }];
        }

        this.completionItems.sort((a, b) => a.itemLabel.localeCompare(b.itemLabel));
    }


    _searchCompletionItems(event) {
        const { target } = event;
        const keyword = target.value.substring(
            this._selectionStart,
            target.selectionEnd
        );
        this._currentKeyword = keyword;
        this._currentTargetValue = target.value;
        this._generateCompletionItems(keyword,target.value);
        
        if (this.completionItems.length > 0) {
            this.completionItems[0].isActive = true;
            this._setCompletionPosition(event);
            this.isCompletionVisible = true;
        } else {
            this.isCompletionVisible = false;
        }
    }

    _handleCompletion(event) {
        const { key, altKey, ctrlKey, metaKey } = event;
        if (altKey || ctrlKey || metaKey) {
            this._closeCompletion();
        }
        switch (key) {
            //case '.':
            case ',':
            case ' ':
            case 'Escape':
            case 'ArrowLeft':
            case 'ArrowRight':
                this._closeCompletion();
                break;
            case 'Backspace':
                this._deleteKeyword(event);
                break;
            case 'ArrowDown':
            case 'ArrowUp':
            case 'Enter':
                if (event.isComposing) {
                    this._searchCompletionItems(event);
                }
                break;
            default:
                this._searchCompletionItems(event);
                break;
        }
    }

    _deleteKeyword(event) {
        this._searchCompletionItems(event);
        if (this._selectionStart === event.target.selectionStart) {
            this._closeCompletion();
        }
    }

    _selectBellowItem(event) {
        event.preventDefault();
        const activeIndex = this._getActiveItemIndex();
        if (activeIndex + 1 < this.completionItems.length) {
            this.completionItems = this.completionItems.map((item, index) => {
                return {
                    ...item,
                    isActive: index === activeIndex + 1
                };
            });
            this._keepInCenter();
        }
    }

    _selectAboveItem(event) {
        event.preventDefault();
        const activeIndex = this._getActiveItemIndex();
        if (activeIndex > 0) {
            this.completionItems = this.completionItems.map((item, index) => {
                return {
                    ...item,
                    isActive: index === activeIndex - 1
                };
            });
            this._keepInCenter();
        }
    }

    _keepInCenter = () => {
        window.setTimeout(()=>{
            this.template.querySelector('.slds-listbox__option_plain[aria-selected="true"]').scrollIntoView({ behavior: 'smooth', block: 'center' });
        },1)
    }

    _getActiveItemIndex() {
        return this.completionItems.findIndex(item => item.isActive);
    }

    _insertItemByKeyboard(event) {
        event.preventDefault();
        const selectedItem = this.completionItems.find(item => item.isActive);
        const { target } = event;
        this._insertItem(target, selectedItem);
    }

    _insertItem(textarea, selectedItem) {
        if (selectedItem) {
            const soql = textarea.value;
            const preSoql = soql.substring(0, this._selectionStart);
            const postSoql = soql.substring(textarea.selectionStart);
            const strippedItemName = stripNamespace(selectedItem.name,this.namespace);
            this.soql = preSoql + strippedItemName + postSoql;
            const insertedIndex = this._selectionStart + strippedItemName.length;
            textarea.focus();
            textarea.setSelectionRange(insertedIndex, insertedIndex);
            store.dispatch(UI.reduxSlice.actions.updateSoql({
                connector:this.queryConnector,
                soql:this.soql
            }));
        }
        this._closeCompletion();
    }

    /** Getters **/

    get queryConnector(){
        return this.useToolingApi?this.connector.conn.tooling:this.connector.conn;
    }

    get iconName(){
        return this.isMenuSmall?'utility:toggle_panel_left':'utility:toggle_panel_right';
    }
    
}
