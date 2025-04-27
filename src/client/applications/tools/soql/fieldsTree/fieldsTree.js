import { wire, api } from 'lwc';
import ToolkitElement from 'core/toolkitElement';
import { getFlattenedFields } from '@jetstreamapp/soql-parser-js';
import { store, connectStore, SELECTORS, DESCRIBE, SOBJECT, UI } from 'core/store';
import {
    isEmpty,
    fullApiName,
    isSame,
    escapeRegExp,
    isNotUndefinedOrNull,
    lowerCaseKey,
} from 'shared/utils';

const PAGE_LIST_SIZE = 70;

export default class FieldsTree extends ToolkitElement {
    // relationship Path e.g. "Contact.Owner"
    @api relationship;
    // Child Relationship Name
    @api childrelation;
    @api rootlevel = 1;

    sobjectMeta;
    fields = [];
    isLoading = false;
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

    @api
    get sobject() {
        return this._sobject;
    }
    set sobject(value) {
        if (this._sobject !== value) {
            this._sobject = value;
            this.updateFieldTree();
        }
    }

    @wire(connectStore, { store })
    storeChange({ ui, application }) {
        const isCurrentApp = this.verifyIsActive(application.currentApplication);
        if (!isCurrentApp) return;

        this.updateFieldTree();
    }

    updateFieldTree = () => {
        const { sobject, ui } = store.getState();

        const sobjectState = SELECTORS.sobject.selectById({ sobject }, lowerCaseKey(this.sobject));
        if (!sobjectState) return;

        this.isLoading = sobjectState.isFetching;
        if (sobjectState.data) {
            this.sobjectMeta = sobjectState.data;
        }
        this._updateFields(ui.query, ui.sort);
    };

    connectedCallback() {
        //console.log('connectedCallback - describeSObjectIfNeeded',this.sobject)
        const { describe } = store.getState();
        store.dispatch(
            SOBJECT.describeSObject({
                connector: this.connector.conn,
                sObjectName: this.sobject,
                useToolingApi: describe.nameMap[lowerCaseKey(this.sobject)]?.useToolingApi,
            })
        );
    }

    selectField(event) {
        const fieldName = event.currentTarget.dataset.name;
        store.dispatch(
            UI.reduxSlice.actions.toggleField({
                fieldName,
                relationships: this.relationship,
                childRelationship: this.childrelation,
            })
        );
    }

    toggleReferenceField(event) {
        const fieldName = event.target.dataset.field;
        this._expandedFieldNames[fieldName] = !this._expandedFieldNames[fieldName];
        this._filterFields();
    }

    _updateFields(query, sort) {
        if (!this.sobjectMeta) return;
        const selectedFields = this._getSelectedFieldSuggestion(query).map(x =>
            (x || '').toLowerCase()
        );
        this._rawFields = this.sobjectMeta.fields.map(field => {
            return {
                ...field,
                details: `${field.type.toUpperCase()} / ${field.label}`,
                isNotReference: field.type !== 'reference',
                isActive: selectedFields.includes(
                    (this._getRawFieldName(field) || '').toLowerCase()
                ),
                isExpanded: false,
                ...this._generateRelationshipProperties(field),
            };
        });
        this._sortFields(sort);
        this._filterFields();
    }

    _getSelectedFieldSuggestion(query) {
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
            relationshipPath: this._getRelationshipPath(field),
        };
    }

    _formatField = field => {
        var regex = new RegExp('(' + this.keyword + ')', 'gi');
        if (regex.test(field)) {
            return field
                .toString()
                .replace(/<?>?/, '')
                .replace(regex, '<span style="font-weight:Bold; color:blue;">$1</span>');
        } else {
            return field;
        }
    };

    _filterFields = () => {
        let fields;
        if (this.level === 1 && this.keyword) {
            const escapedKeyword = escapeRegExp(this.keyword);
            const keywordPattern = new RegExp(escapedKeyword, 'i');
            fields = this._rawFields
                .filter(field => {
                    return keywordPattern.test(`${field.name} ${field.label}`);
                })
                .map(field => ({
                    ...field,
                    formattedName: this._formatField(field.name || ''),
                }));
        } else {
            fields = this._rawFields;
        }
        this.fields = fields.map(field => {
            return {
                ...field,
                isExpanded: !!this._expandedFieldNames[field.name],
            };
        });
        this.pageNumber = 1; // reset
    };

    _getFlattenedFields(query) {
        return getFlattenedFields(query).map(field => fullApiName(field));
    }

    _sortFields(sort) {
        if (sort) {
            const SORT_ORDER_PRE_NUMBER = {
                ASC: 1,
                DESC: -1,
            };
            const sortOrderPreNumber = SORT_ORDER_PRE_NUMBER[sort];
            this._rawFields.sort((prev, next) => {
                return (
                    (prev.name.toLowerCase() > next.name.toLowerCase() ? 1 : -1) *
                    sortOrderPreNumber
                );
            });
        }
    }

    /** Events */

    handleScroll(event) {
        //console.log('handleScroll');
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

    get virtualList() {
        // Best UX Improvement !!!!
        return this.fields.slice(0, this.pageNumber * PAGE_LIST_SIZE);
    }
}
