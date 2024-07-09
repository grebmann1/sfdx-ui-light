import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import {
    getField,
    getFlattenedFields,
    composeQuery,
    parseQuery,
    isQueryValid
} from 'soql-parser-js';
import { stripNamespace } from 'shared/utils';

const RECENT_QUERIES_KEY = 'lsb.recentQueries';
const MAX_RECENT_QUERIES = 20;

const INITIAL_QUERY = {
    fields: [getField('Id')],
    sObject: undefined
};

// Utility functions
function _getRawFieldName(fieldName, relationships) {
    if (relationships) {
        return `${relationships}.${fieldName}`;
    }
    return fieldName;
}

function _toggleField(query, fieldName, relationships) {
    fieldName = stripNamespace(fieldName);
    relationships = stripNamespace(relationships);
    const fieldNames = stripNamespace(getFlattenedFields(query));
    const rawFieldName = stripNamespace(
        _getRawFieldName(fieldName, relationships)
    );
    if (fieldNames.includes(rawFieldName)) {
        return {
            ...query,
            fields: query.fields.filter(field => {
                const relationshipPath =
                    field.relationships && field.relationships.join('.');
                return (
                    stripNamespace(
                        _getRawFieldName(field.field, relationshipPath)
                    ) !== rawFieldName
                );
            })
        };
    }
    if (relationships) {
        return {
            ...query,
            fields: [
                ...query.fields,
                getField({
                    field: fieldName,
                    relationships: relationships.split('.')
                })
            ]
        };
    }
    return {
        ...query,
        fields: [...query.fields, getField(fieldName)]
    };
}

function _toggleChildRelationshipField(
    state,
    fieldName,
    relationships,
    childRelationship
) {
    fieldName = stripNamespace(fieldName);
    childRelationship = stripNamespace(childRelationship);
    const childField = state.fields.find(
        field =>
            field.subquery &&
            stripNamespace(field.subquery.relationshipName) ===
                childRelationship
    );
    if (!childField) {
        return {
            ...state,
            fields: [
                ...state.fields,
                getField({
                    subquery: {
                        fields: [getField(fieldName)],
                        relationshipName: childRelationship
                    }
                })
            ]
        };
    }
    relationships = stripNamespace(relationships);
    const newSubquery = _toggleField(
        childField.subquery,
        fieldName,
        relationships
    );
    const newFields = state.fields.map(field => {
        if (
            field.subquery &&
            stripNamespace(field.subquery.relationshipName) ===
                childRelationship
        ) {
            return {
                ...field,
                subquery: newSubquery
            };
        }
        return field;
    });
    return {
        ...state,
        fields: newFields
    };
}

function loadRecentQueries(alias) {
    try {
        const recentQueriesText = localStorage.getItem(`${alias}-${RECENT_QUERIES_KEY}`);
        if (recentQueriesText) return JSON.parse(recentQueriesText);
    } catch (e) {
        console.warn('Failed to load recent queries from localStorage', e);
    }
    return [];
}

function toggleField(state = INITIAL_QUERY, action) {
    const { fieldName, relationships, childRelationship } = action.payload;
    console.log('toggleField - childRelationship',fieldName, relationships, childRelationship);
    if (childRelationship) {
        return _toggleChildRelationshipField(
            state,
            fieldName,
            relationships,
            childRelationship
        );
    }
    console.log('toggleField',childRelationship);
    return _toggleField(state, fieldName, relationships);
}

function toggleRelationship(state = [], action) {
    const { relationshipName } = action.payload;
    const relationship = stripNamespace(relationshipName);
    const fieldNames = stripNamespace(getFlattenedFields(state));
    if (fieldNames.includes(relationship)) {
        return {
            ...state,
            fields: state.fields.filter(
                field =>
                    !field.subquery ||
                    stripNamespace(field.subquery.relationshipName) !==
                        relationship
            )
        };
    }
    const subquery = {
        fields: [getField('Id')],
        relationshipName: relationship
    };
    return {
        ...state,
        fields: [...state.fields, getField({ subquery })]
    };
}

function selectAllFields(query = INITIAL_QUERY, action) {
    const {sObjectMeta} = action.payload;
    return {
        ...query,
        fields: sObjectMeta.fields.map(field =>
            getField(stripNamespace(field.name))
        )
    };
}

function clearAllFields(query = INITIAL_QUERY) {
    return {
        ...query,
        fields: [getField('Id')]
    };
}

// Create a slice with reducers and extraReducers
const uiSlice = createSlice({
    name: 'ui',
    initialState: {
        useToolingApi: false,
        apiUsage: undefined,
        recentQueries: [],
        selectedSObject: undefined,
        query: INITIAL_QUERY,
        soql: '',
        childRelationship: undefined,
        sort: undefined
    },
    reducers: {
        clearQueryError: (state) => {
            state.error = null;
        },
        updateApiLimit: (state, action) => {
            const { limitInfo } = action.payload?.connector;
            state.apiUsage = limitInfo ? limitInfo.apiUsage : undefined;
        },
        loadRecentQueries: (state, action) => {
            state.recentQueries = loadRecentQueries(action.payload.alias);
        },
        saveRecentQuery : (state, action) => {
            const { soql, alias } = action.payload;
            const recentQueriesState = [
                soql,
                ...state.recentQueries.filter(q => q !== soql).slice(0, MAX_RECENT_QUERIES - 1)
            ];
            try {
                localStorage.setItem(
                    `${alias}-${RECENT_QUERIES_KEY}`,
                    JSON.stringify(recentQueriesState)
                );
            } catch (e) {
                console.warn('Failed to save recent queries to localStorage', e);
            }
            state.recentQueries = recentQueriesState;
        },
        selectSObject: (state, action) => {
            const {sObjectName} = action.payload;
            const query = {
                ...INITIAL_QUERY,
                sObject: stripNamespace(sObjectName)
            };
            state.selectedSObject = sObjectName;
            state.query = query;
            state.soql = composeQuery(query, { format: true });
        },
        deselectSObject: (state) => {
            state.selectedSObject = undefined;
            state.sort = undefined;
        },
        toggleField: (state, action) => {
            console.log('iiiitoggleField',action);
            const query = toggleField(state.query, action);
            state.query = query;
            state.soql = composeQuery(query, { format: true });
        },
        toggleRelationship: (state, action) => {
            const query = toggleRelationship(state.query, action);
            state.query = query;
            state.soql = composeQuery(query, { format: true });
        },
        toggleToolingApi: (state, action) => {
            state.useToolingApi = action.payload.useToolingApi === true;
        },
        updateSoql: (state, action) => {
            const { soql } = action.payload;
            if (!soql.trim()) {
                state.selectedSObject = undefined;
                state.query = undefined;
                state.soql = soql;
            } else {
                const query = isQueryValid(soql) ? parseQuery(soql) : state.query;
                state.selectedSObject = query ? query.sObject : undefined;
                state.query = query;
                state.soql = soql;
            }
        },
        formatSoql: (state) => {
            state.soql = composeQuery(state.query, { format: true });
        },
        selectChildRelationship: (state, action) => {
            state.childRelationship = action.payload.childRelationship;
        },
        deselectChildRelationship: (state) => {
            state.childRelationship = undefined;
        },
        selectAllFields: (state, action) => {
            const query = selectAllFields(state.query, action);
            state.query = query;
            state.soql = composeQuery(query, { format: true });
        },
        clearAllFields: (state) => {
            const query = clearAllFields(state.query);
            state.query = query;
            state.soql = composeQuery(query, { format: true });
        },
        sortFields: (state, action) => {
            state.sort = action.payload.sort;
        }
    }
});

// Export actions
export const SORT = { ORDER: { ASC: 'ASC', DESC: 'DESC' } };
export const reduxSlice = uiSlice;
