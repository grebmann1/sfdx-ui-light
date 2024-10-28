import { store,connectStore,SELECTORS,SOBJECT,DESCRIBE,QUERY,UI } from 'core/store';
import { capitalizeFirstLetter,lowerCaseKey } from 'shared/utils';

const DATETIME_EXPRESSION = [
    // Date Formats
    "YYYY-MM-DD", 
    "YYYY-MM-DDThh:mm:ss+hh:mm", 
    "YYYY-MM-DDThh:mm:ss-hh:mm", 
    "YYYY-MM-DDThh:mm:ssZ", 

    // Relative Dates
    "TODAY", 
    "TOMORROW", 
    "YESTERDAY", 

    // Days
    "LAST_N_DAYS:n",
    "N_DAYS_AGO:n",
    "NEXT_N_DAYS:n",
    "LAST_90_DAYS", 
    "NEXT_90_DAYS", 

    // Weeks
    "LAST_WEEK", 
    "THIS_WEEK", 
    "NEXT_WEEK", 
    "LAST_N_WEEKS:n", 
    "NEXT_N_WEEKS:n", 

    // Months
    "LAST_MONTH", 
    "THIS_MONTH", 
    "NEXT_MONTH", 
    "LAST_N_MONTHS:n", 
    "NEXT_N_MONTHS:n", 

    // Quarters
    "THIS_QUARTER", 
    "LAST_QUARTER", 
    "NEXT_QUARTER", 
    "LAST_N_QUARTERS:n", 
    "NEXT_N_QUARTERS:n", 

    // Years
    "THIS_YEAR", 
    "LAST_YEAR", 
    "NEXT_YEAR", 
    "LAST_N_YEARS:n", 
    "NEXT_N_YEARS:n", 

    // Fiscal Quarters
    "THIS_FISCAL_QUARTER", 
    "LAST_FISCAL_QUARTER", 
    "NEXT_FISCAL_QUARTER", 
    "LAST_N_FISCAL_\u200bQUARTERS:n", 
    "NEXT_N_FISCAL_\u200bQUARTERS:n", 

    // Fiscal Years
    "THIS_FISCAL_YEAR", 
    "LAST_FISCAL_YEAR", 
    "NEXT_FISCAL_YEAR", 
    "LAST_N_FISCAL_\u200bYEARS:n", 
    "NEXT_N_FISCAL_\u200bYEARS:n"
];

const AFTER_FROM_STATEMENT = [
    "WHERE",
    "WITH",
    "GROUP BY",
    "ORDER BY",
    "LIMIT",
    "UPDATE",
    "FOR UPDATE"
]

const FROM_STATEMENT = [
    "FROM"
]

class SuggestionTypeHandler{
    constructor(monaco){
        this.monaco = monaco;
    }

    LOOKUP = (field) => ({
        kind: this.monaco.languages.CompletionItemKind.Reference,
        detail: "Lookup",
        label: field.relationshipName,
        insertTextRules: this.monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        insertText: `${field.relationshipName}.$0`
    });

    FIELD = (field,withSeparator) => ({
        kind: this.monaco.languages.CompletionItemKind.Field,
        detail: capitalizeFirstLetter(field.type),
        label: field.name,
        insertText: `${field.name}${withSeparator ? "," : ""} `
    });

    DEFAULT = (label,withSeparator) =>({
        kind: this.monaco.languages.CompletionItemKind.Reference,
        detail: null,
        label: label.trim(),
        insertText: `${label.trim()}${withSeparator ? "," : ""} `
    });

    BOOLEAN =(value) => ({
        kind: this.monaco.languages.CompletionItemKind.Keyword,
        detail: "Boolean",
        label: value,
        insertText: value
    });

    PICKLIST =(value,withSeparator) => ({
        kind: this.monaco.languages.CompletionItemKind.Property,
        detail: "Picklist",
        label: value,
        insertText: `'${value}'${withSeparator ? ", " : ""}`
    });

    DATE =(value,withSeparator) => ({
        kind: this.monaco.languages.CompletionItemKind.Keyword,
        detail: "Date/Datetime Expression",
        label: value,
        insertText: `${value}${withSeparator ? ", " : ""}`
    });

    OBJECT = (sobject,isSnippet) => ({
        kind: this.monaco.languages.CompletionItemKind.Folder,
        detail: 'SObject',
        label: sobject.name,
        insertText: isSnippet ? `SELECT Id, $0 FROM ${sobject.name}` : sobject.name,
        insertTextRules: this.monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
    });

    RELATIONSHIP = (rel,isSnippet) => ({
        kind: this.monaco.languages.CompletionItemKind.Folder,
        detail: "Child Relationship",
        label: rel.relationshipName,
        insertTextRules: this.monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        insertText: isSnippet ? `SELECT Id, $0 FROM ${rel.relationshipName}` : rel.relationshipName
    });

}


export default class SuggestionHandler {
    constructor( monaco, parser,connector,useToolingApi) {
        //this.monaco = monaco;
        this.parser = parser;
        this.connector = connector;
        this.useToolingApi = useToolingApi;
        this.suggestionHandler = new SuggestionTypeHandler(monaco);
    }

    getAfterFromSuggestions(){
        return AFTER_FROM_STATEMENT.map(value => this.suggestionHandler.DEFAULT(value,false));
    }

    getFromSuggestions(){
        return FROM_STATEMENT.map(value => this.suggestionHandler.DEFAULT(value,false));
    }

    // Method to get selectable fields based on the parsed information
    getFieldSuggestions(isSubQuery) {
        //console.log('getFieldSuggestions - isSubQuery',isSubQuery,this.parser.isSubQuery);
        let object = this.parser.fromObject;
        if (isSubQuery) {
            if (this.parser.subquery.type === "select") {
                object = this.extractObjectFromChild();
            } else {
                object = this.parser.subquery.fromObject;
            }
        }
        return this.getFields(object, isSubQuery);
    }

    // Method to get relations from objects
    getChildRelationshipSuggestions = (isSnippet) => {
        const { describe } = store.getState();
        return store.dispatch(SOBJECT.describeSObject({
            connector:this.connector.conn,
            sObjectName:this.parser.fromObject,
            useToolingApi:describe.nameMap[lowerCaseKey(this.parser.fromObject)]?.useToolingApi
        })).then(() => {
            const { sobject } = store.getState();
            const sobjectState = SELECTORS.sobject.selectById({sobject},(this.parser.fromObject||'').toLowerCase());
            return (sobjectState?.data?.childRelationships || []).map(rel => this.suggestionHandler.RELATIONSHIP(rel,isSnippet)).filter(item => item.label !== null)
        });
    }

    // Method to get all queryable objects
    getSObjectSuggestions = (isSnippet,includeSelect = false) => {
        const { describe } = store.getState();
        const _filteredList = Object.values(describe.nameMap)
        .filter(obj => obj.queryable)
        .map(obj => this.suggestionHandler.OBJECT(obj,isSnippet));
        
        return includeSelect?[].concat(_filteredList,this.getFromSuggestions()):_filteredList;
    }

    // Method to get relation fields
    getLookupFieldSuggestions = () => {
        let relation = this.parser.fromRelation;
        let referenceTo = this.parser.fromObject;

        //console.log('getLookupFieldSuggestions',relation,referenceTo)
        if (this.parser.isSubQuery) {
            relation = this.parser.subquery.fromRelation;
            referenceTo = this.extractObjectFromChild();
        }

        let currentReferenceTo = referenceTo;
        return Promise.all(relation.map(rel => {
            const { sobject,describe } = store.getState();
            const sobjectState = SELECTORS.sobject.selectById({sobject},(currentReferenceTo||'').toLowerCase());
            if(!sobjectState || !sobjectState.data) return; // Object no yet fully setup
            const fields = sobjectState.data.fields.filter(field => field.relationshipName && field.relationshipName.toLowerCase() === rel);
            if(fields && fields.length > 0){
                currentReferenceTo = fields[0].referenceTo[0].toLowerCase();
                return store.dispatch(SOBJECT.describeSObject({
                    connector:this.connector.conn,
                    sObjectName:currentReferenceTo,
                    useToolingApi:describe.nameMap[lowerCaseKey(currentReferenceTo)]?.useToolingApi
                }))
            }
            return;
        })).then(() => this.getFields(currentReferenceTo,this.parser.position == 'select'));
    }

    // Method to get predefined values for a field
    getTypeFieldSuggestions = async (object, fieldData, withSeparator) => {
        const { describe } = store.getState();
        const { field } = fieldData;
        const referenceTo = this.parser.isSubQuery
            ? (this.parser.subquery.type === "select" ? this.extractObjectFromChild() : this.parser.subquery.fromObject)
            : object;
    
        await store.dispatch(SOBJECT.describeSObject({
            connector: this.connector.conn,
            sObjectName: referenceTo,
            useToolingApi: describe.nameMap[lowerCaseKey(referenceTo)]?.useToolingApi
        }));
    
        const { sobject } = store.getState();
        const sobjectState = SELECTORS.sobject.selectById({ sobject }, (referenceTo || '').toLowerCase());
        const fieldInfo = sobjectState?.data?.fields?.find(x => x.name.toLowerCase() === field);
    
        if (!fieldInfo) return [];
    
        switch (fieldInfo.type) {
            case "picklist":
                return fieldInfo.picklistValues.map(value => this.suggestionHandler.PICKLIST(value,withSeparator));
            case "date":
            case "datetime":
                return DATETIME_EXPRESSION.map(value => this.suggestionHandler.DATE(value));
            case "boolean":
                return ["TRUE", "FALSE"].map(value => this.suggestionHandler.BOOLEAN(value));
            default:
                return [];
        }
    };

    // Method to get the object name from a child relation
    extractObjectFromChild() {
        const { sobject } = store.getState();
        const sobjectState = SELECTORS.sobject.selectById({sobject},(this.parser.fromObject||'').toLowerCase());
        const childRelation = sobjectState.data.childRelationships.find(rel => rel.relationshipName && rel.relationshipName.toLowerCase() === this.parser.subquery.fromObject);
        return childRelation ? childRelation.childSObject : null;
    }

    // Method to get fields of an object
    getFields = async (referenceTo, withSeparator = true) => {
        //console.log('referenceTo',referenceTo);
        return new Promise(async (resolve) => {
            const { describe } = store.getState();
            await store.dispatch(SOBJECT.describeSObject({
                connector:this.connector.conn,
                sObjectName:referenceTo,
                useToolingApi:describe.nameMap[lowerCaseKey(referenceTo)]?.useToolingApi
            }));
            const { sobject } = store.getState();
            const sobjectState = SELECTORS.sobject.selectById({sobject},(referenceTo||'').toLowerCase());
            const fields = [];
            (sobjectState?.data?.fields || [])
            .forEach(field => {
                fields.push(this.suggestionHandler.FIELD(field,withSeparator));
                if (field.relationshipName) {
                    fields.push(this.suggestionHandler.LOOKUP(field));
                }
            });
            resolve(fields);
       })
    }

    // Method to get selected fields for autocompletion
    getSelectedFieldSuggestion() {
        return this.parser.parsedData.fields.map(field => this.suggestionHandler.DEFAULT(field,true));
    }
}
