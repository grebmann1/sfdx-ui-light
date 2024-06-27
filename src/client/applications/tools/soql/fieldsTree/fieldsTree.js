

import { wire, api } from 'lwc';
import FeatureElement from 'element/featureElement';
import { getFlattenedFields } from 'soql-parser-js';
import {
    connectStore,
    store,
    describeSObjectIfNeeded,
    toggleField
} from 'soql/store';

import { isEmpty,fullApiName,isSame,escapeRegExp,isNotUndefinedOrNull } from 'shared/utils';

const PAGE_LIST_SIZE    = 70;

export default class FieldsTree extends FeatureElement {
    // sObject Name
    @api sobject;
    // relationship Path e.g. "Contact.Owner"
    @api relationship;
    // Child Relationship Name
    @api childrelation;
    @api rootlevel = 1;

    sobjectMeta;
    fields = [];
    isLoading = false;
    useToolingApi = false;
    _keyword;
    _rawFields = [];
    _expandedFieldNames = {};

    // Scrolling
    pageNumber = 1;

    @api
    get keyword() {
        return this._keyword;
    }
    set keyword(value) {
        if (this._keyword !== value) {
            this._keyword = value;
            this._filterFields();
        }
    }

    

    @wire(connectStore, { store })
    storeChange({ sobject, ui }) {
        if(ui.hasOwnProperty('useToolingApi')){
            console.log('ui.useToolingApi',ui.useToolingApi);
            this.useToolingApi = ui.useToolingApi;
        }

        
        const sobjectState = sobject[this.sobject];
        if (!sobjectState) return;
        this.isLoading = sobjectState.isFetching;
        if (sobjectState.data) {
            this.sobjectMeta = sobjectState.data;
        }
        

        this._updateFields(ui.query, ui.sort);
    }

    connectedCallback() {
        console.log('connectedCallback - describeSObjectIfNeeded',this.sobject)
        store.dispatch(describeSObjectIfNeeded({
            connector:this.connector.conn,
            sObjectName:this.sobject,
            useToolingApi:this.useToolingApi
        }));
    }

    selectField(event) {
        const fieldName = event.currentTarget.dataset.name;
        store.dispatch(
            toggleField(fieldName, this.relationship, this.childrelation)
        );
    }

    toggleReferenceField(event) {
        const fieldName = event.target.dataset.field;
        this._expandedFieldNames[fieldName] = !this._expandedFieldNames[
            fieldName
        ];
        this._filterFields();
    }

    _updateFields(query, sort) {
        if (!this.sobjectMeta) return;
        const selectedFields = this._getSelectedFields(query).map(x => (x || '').toLowerCase());
        this._rawFields = this.sobjectMeta.fields.map(field => {
            return {
                ...field,
                details: `${field.type.toUpperCase()} / ${field.label}`,
                isNotReference: field.type !== 'reference',
                isActive: selectedFields.includes((this._getRawFieldName(field) || '').toLowerCase()),
                isExpanded: false,
                ...this._generateRelationshipProperties(field)
            };
        });
        this._sortFields(sort);
        this._filterFields();
    }

    _getSelectedFields(query) {
        if (!query) return [];
        if (this.childrelation) {
            const subquery = query.fields.find(
                field =>
                    field.type === 'FieldSubquery' &&
                    isSame(field.subquery.relationshipName, this.childrelation)
            );
            if (!subquery) return [];
            return this._getFlattenedFields(subquery);
        }
        return this._getFlattenedFields(query);
    }

    _getRawFieldName(field) {
        let rawFieldName;
        if (this.relationship) {
            rawFieldName = `${this.relationship}.${field.name}`;
        } else {
            rawFieldName = field.name;
        }
        return fullApiName(rawFieldName);
    }

    _getRelationshipPath(field) {
        if (this.relationship) {
            return `${this.relationship}.${field.relationshipName}`;
        }
        return field.relationshipName;
    }

    _generateRelationshipProperties(field) {
        return {
            relationshipSObjectName:
                field.referenceTo && field.referenceTo.length > 0
                    ? field.referenceTo[0]
                    : undefined,
            relationshipPath: this._getRelationshipPath(field)
        };
    }

    _filterFields() {
        let fields;
        if (this.level === 1 && this.keyword) {
            const escapedKeyword = escapeRegExp(this.keyword);
            const keywordPattern = new RegExp(escapedKeyword, 'i');
            fields = this._rawFields.filter(field => {
                return keywordPattern.test(`${field.name} ${field.label}`);
            });
        } else {
            fields = this._rawFields;
        }
        this.fields = fields.map(field => {
            return {
                ...field,
                isExpanded: !!this._expandedFieldNames[field.name]
            };
        });
        this.pageNumber = 1; // reset
    }

    _getFlattenedFields(query) {
        return getFlattenedFields(query).map(field => fullApiName(field));
    }

    _sortFields(sort) {
        if (sort) {
            const SORT_ORDER_PRE_NUMBER = {
                ASC: 1,
                DESC: -1
            };
            const sortOrderPreNumber = SORT_ORDER_PRE_NUMBER[sort.order];
            this._rawFields.sort((prev, next) => {
                return (
                    (prev.name.toLowerCase() > next.name.toLowerCase()
                        ? 1
                        : -1) * sortOrderPreNumber
                );
            });
        }
    }

    /** Events */


    handleScroll(event) {
        console.log('handleScroll');
        const target = event.target;
        const scrollDiff = Math.abs(target.clientHeight - (target.scrollHeight - target.scrollTop));
        const isScrolledToBottom = scrollDiff < 5; //5px of buffer
        if (isScrolledToBottom) {
            // Fetch more data when user scrolls to the bottom
            this.pageNumber++;
        }
    }

    /** Getters */

    get level() {
        if (!this.relationship) return this.rootLevelNum;
        return this.relationship.split('.').length + this.rootLevelNum;
    }

    get isMaxLevel() {
        return this.level > 4 + this.rootLevelNum;
    }

    get rootLevelNum() {
        return parseInt(this.rootlevel, 10);
    }

    get isNoFields() {
        return !this.fields || !this.fields.length;
    }

    get virtualList(){
        // Best UX Improvement !!!!
        return this.fields.slice(0,this.pageNumber * PAGE_LIST_SIZE);
    }
}
