import {
    getField,
    getFlattenedFields,
    composeQuery,
    parseQuery,
    isQueryValid,
} from '@jetstreamapp/soql-parser-js';
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { SELECTORS, DOCUMENT } from 'core/store';
import { stripNamespace, isNotUndefinedOrNull, isEmpty, guid, lowerCaseKey } from 'shared/utils';

const SETTINGS_KEY = 'SETTINGS_KEY';

const INITIAL_QUERY = {
    fields: [getField('Id')],
    sObject: undefined,
};
const INITIAL_BODY = 'SELECT Id';
const INITIAL_TABS = [enrichTab({ id: guid(), body: INITIAL_BODY }, true)];

const QUERY_CONFIG = {
    fieldMaxLineLength: 100,
    fieldSubqueryParensOnOwnLine: false,
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
    const rawFieldName = stripNamespace(_getRawFieldName(fieldName, relationships));
    if (fieldNames.includes(rawFieldName)) {
        return {
            ...query,
            fields: query.fields.filter(field => {
                const relationshipPath = field.relationships && field.relationships.join('.');
                return (
                    stripNamespace(_getRawFieldName(field.field, relationshipPath)) !== rawFieldName
                );
            }),
        };
    }
    if (relationships) {
        return {
            ...query,
            fields: [
                ...query.fields,
                getField({
                    field: fieldName,
                    relationships: relationships.split('.'),
                }),
            ],
        };
    }
    return {
        ...query,
        fields: [...query.fields, getField(fieldName)],
    };
}

function _toggleChildRelationshipField(state, fieldName, relationships, childRelationship) {
    fieldName = stripNamespace(fieldName);
    childRelationship = stripNamespace(childRelationship);
    const childField = state.fields.find(
        field =>
            field.subquery && stripNamespace(field.subquery.relationshipName) === childRelationship
    );
    if (!childField) {
        return {
            ...state,
            fields: [
                ...state.fields,
                getField({
                    subquery: {
                        fields: [getField(fieldName)],
                        relationshipName: childRelationship,
                    },
                }),
            ],
        };
    }
    relationships = stripNamespace(relationships);
    const newSubquery = _toggleField(childField.subquery, fieldName, relationships);
    const newFields = state.fields.map(field => {
        if (
            field.subquery &&
            stripNamespace(field.subquery.relationshipName) === childRelationship
        ) {
            return {
                ...field,
                subquery: newSubquery,
            };
        }
        return field;
    });
    return {
        ...state,
        fields: newFields,
    };
}

function saveCacheSettings(alias, state) {
    try {
        const { soql, leftPanelToggled, recentPanelToggled, tabs, includeDeletedRecords } = state;
        localStorage.setItem(
            `${alias}-${SETTINGS_KEY}`,
            JSON.stringify({
                soql,
                leftPanelToggled,
                recentPanelToggled,
                tabs,
                includeDeletedRecords,
            })
        );
    } catch (e) {
        console.error('Failed to save CONFIG to localstorage', e);
    }
}

function loadCacheSettings(alias) {
    try {
        const configText = localStorage.getItem(`${alias}-${SETTINGS_KEY}`);
        if (configText) return JSON.parse(configText);
    } catch (e) {
        console.error('Failed to load CONFIG from localStorage', e);
    }
    return null;
}

function toggleField(state = INITIAL_QUERY, action) {
    const { fieldName, relationships, childRelationship } = action.payload;
    if (childRelationship) {
        return _toggleChildRelationshipField(state, fieldName, relationships, childRelationship);
    }
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
                    stripNamespace(field.subquery.relationshipName) !== relationship
            ),
        };
    }
    const subquery = {
        fields: [getField('Id')],
        relationshipName: relationship,
    };
    return {
        ...state,
        fields: [...state.fields, getField({ subquery })],
    };
}

function selectAllFields(query = INITIAL_QUERY, action) {
    const { sObjectMeta } = action.payload;
    return {
        ...query,
        fields: sObjectMeta.fields.map(field => getField(stripNamespace(field.name))),
    };
}

function clearAllFields(query = INITIAL_QUERY) {
    return {
        ...query,
        fields: [getField('Id')],
    };
}

function updateCurrentTab(state, attributes) {
    const tabIndex = state.tabs.findIndex(x => x.id === state.currentTab.id);
    if (tabIndex > -1) {
        state.tabs[tabIndex].body = state.soql;
        if (attributes) {
            // Extra Attributes
            Object.assign(state.tabs[tabIndex], attributes);
        }
        state.currentTab = state.tabs[tabIndex];
    }
}

function formatTab(tab) {
    const { id, name, body, isDraft, fileId, fileBody, tableSearch, selectedRecordIds } = tab;
    return {
        id,
        name,
        body,
        isDraft,
        fileId,
        fileBody,
        tableSearch: tableSearch || '',
        selectedRecordIds: Array.isArray(selectedRecordIds) ? selectedRecordIds : [],
    };
}

function enrichTabs(tabs, queryFiles) {
    return tabs.map(tab => enrichTab(tab, queryFiles));
}

function enrichTab(tab, queryFiles) {
    const file = tab.fileId
        ? SELECTORS.queryFiles.selectById({ queryFiles }, lowerCaseKey(tab.fileId))
        : null;
    const fileBody = file?.content || tab.fileBody;
    return {
        ...tab,
        fileBody: fileBody,
        isDraft: fileBody != tab.body && isNotUndefinedOrNull(tab.fileId),
    };
}

function updateSOQL(state, soql) {
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
}

// Create a slice with reducers and extraReducers
const uiSlice = createSlice({
    name: 'ui',
    initialState: {
        apiUsage: undefined,
        recentQueries: [],
        tabs: INITIAL_TABS,
        currentTab: INITIAL_TABS[0],
        selectedSObject: undefined,
        query: INITIAL_QUERY,
        soql: '',
        childRelationship: undefined,
        sort: undefined,
        leftPanelToggled: false,
        recentPanelToggled: false,
        includeDeletedRecords: false,
        isInitialized: false,
    },
    reducers: {
        loadCacheSettings: (state, action) => {
            const { alias, queryFiles } = action.payload;
            const cachedConfig = loadCacheSettings(alias);
            if (cachedConfig && !state.isInitialized) {
                const { soql, leftPanelToggled, recentPanelToggled, tabs, includeDeletedRecords } = cachedConfig;
                Object.assign(state, {
                    //soql: soql || '',
                    leftPanelToggled,
                    recentPanelToggled,
                    tabs: !state.tabs || state.tabs.length === 0 ? enrichTabs(tabs || INITIAL_TABS, queryFiles) : state.tabs,
                    includeDeletedRecords,
                });
            }
            state.isInitialized = true;
        },
        saveCacheSettings: (state, action) => {
            const { alias } = action.payload;
            if (isNotUndefinedOrNull(alias)) {
                saveCacheSettings(alias, state);
            }
        },
        clearTabs: (state, action) => {
            const { alias } = action.payload;
            state.tabs = enrichTabs(INITIAL_TABS);
            if (isNotUndefinedOrNull(alias)) {
                saveCacheSettings(alias, state);
            }
        },
        addTab: (state, action) => {
            const { queryFiles, tab } = action.payload;
            const enrichedTab = enrichTab(formatTab(tab), queryFiles);
            if(isEmpty(enrichedTab.body)){
                enrichedTab.body = INITIAL_BODY;
            }
            state.tabs.push(enrichedTab);
            // Assign new tab
            state.currentTab = enrichedTab;
            state.currentFileId = enrichedTab.fileId;
            updateSOQL(state, enrichedTab.body || '');
        },
        removeTab: (state, action) => {
            const { id, alias } = action.payload;
            state.tabs = state.tabs.filter(x => x.id != id);
            // Assign last tab
            if (state.tabs.length > 0 && state.currentTab.id == id) {
                const lastTab = state.tabs[state.tabs.length - 1];
                state.currentTab = lastTab;
                updateSOQL(state, lastTab.body);
            }
            if (isNotUndefinedOrNull(alias)) {
                saveCacheSettings(alias, state);
            }
            // can't remove the last one !!!
        },
        selectionTab: (state, action) => {
            const { id } = action.payload;
            const tab = state.tabs.find(x => x.id == id);
            // Assign new tab
            if (tab) {
                state.currentTab = tab;
                updateSOQL(state, tab.body);
            }
        },
        linkFileToTab: (state, action) => {
            const { fileId, alias, queryFiles } = action.payload;
            const currentTabIndex = state.tabs.findIndex(x => x.id == state.currentTab.id);
            if (currentTabIndex > -1) {
                const enrichedTab = enrichTab(
                    formatTab({ ...state.tabs[currentTabIndex], fileId }),
                    queryFiles
                );
                state.tabs[currentTabIndex] = enrichedTab;
                state.currentTab = enrichedTab;
                if (isNotUndefinedOrNull(alias)) {
                    saveCacheSettings(alias, state);
                }
            }
        },
        updateLeftPanel: (state, action) => {
            const { value, alias } = action.payload;
            state.leftPanelToggled = value === true;
            if (isNotUndefinedOrNull(alias)) {
                saveCacheSettings(alias, state);
            }
        },
        updateRecentPanel: (state, action) => {
            const { value, alias } = action.payload;
            state.recentPanelToggled = value === true;
            if (isNotUndefinedOrNull(alias)) {
                saveCacheSettings(alias, state);
            }
        },
        updateIncludeDeletedRecords: (state, action) => {
            const { value, alias } = action.payload;
            state.includeDeletedRecords = value === true;
            if (isNotUndefinedOrNull(alias)) {
                saveCacheSettings(alias, state);
            }
        },
        updateApiLimit: (state, action) => {
            const { limitInfo } = action.payload?.connector;
            state.apiUsage = limitInfo ? limitInfo.apiUsage : undefined;
        },
        selectSObject: (state, action) => {
            const { sObjectName } = action.payload;
            const query = {
                ...INITIAL_QUERY,
                sObject: stripNamespace(sObjectName),
            };
            state.selectedSObject = sObjectName;
            state.query = query;
            state.soql = composeQuery(query, { format: true, formatOptions: QUERY_CONFIG });
            updateCurrentTab(state);
        },
        deselectSObject: state => {
            state.selectedSObject = undefined;
            state.sort = undefined;
            updateCurrentTab(state);
        },
        toggleField: (state, action) => {
            const query = toggleField(state.query, action);
            state.query = query;
            state.soql = composeQuery(query, { format: true, formatOptions: QUERY_CONFIG });
            updateCurrentTab(state);
        },
        toggleRelationship: (state, action) => {
            const query = toggleRelationship(state.query, action);
            state.query = query;
            state.soql = composeQuery(query, { format: true, formatOptions: QUERY_CONFIG });
            updateCurrentTab(state);
        },
        updateSoql: (state, action) => {
            const { soql, isDraft } = action.payload;
            updateSOQL(state, soql);
            updateCurrentTab(state, { isDraft });
        },
        formatSoql: state => {
            state.soql = composeQuery(state.query, { format: true, formatOptions: QUERY_CONFIG });
            updateCurrentTab(state);
        },
        selectChildRelationship: (state, action) => {
            const childRelationship = action.payload.childRelationship;
            updateCurrentTab(state, { childRelationship });
        },
        deselectChildRelationship: state => {
            const childRelationship = undefined;
            updateCurrentTab(state, { childRelationship });
        },
        selectAllFields: (state, action) => {
            const query = selectAllFields(state.query, action);
            state.query = query;
            state.soql = composeQuery(query, { format: true, formatOptions: QUERY_CONFIG });
        },
        clearAllFields: state => {
            const query = clearAllFields(state.query);
            state.query = query;
            state.soql = composeQuery(query, { format: true, formatOptions: QUERY_CONFIG });
            updateCurrentTab(state);
        },
        sortFields: (state, action) => {
            state.sort = action.payload.sort;
        },
        updateTabTableSearch: (state, action) => {
            const { value } = action.payload;
            const tabIndex = state.tabs.findIndex(x => x.id === state.currentTab.id);
            if (tabIndex > -1) {
                state.tabs[tabIndex].tableSearch = value;
                state.currentTab = state.tabs[tabIndex];
            }
        },
        updateTabSelection: (state, action) => {
            const { selectedRecordIds } = action.payload;
            const tabIndex = state.tabs.findIndex(x => x.id === state.currentTab.id);
            if (tabIndex > -1) {
                state.tabs[tabIndex].selectedRecordIds = Array.isArray(selectedRecordIds)
                    ? selectedRecordIds
                    : [];
                state.currentTab = state.tabs[tabIndex];
            }
        },
    },
});

/* Test */

// Export actions
export const SORT = { ORDER: { ASC: 'ASC', DESC: 'DESC' } };
export const reduxSlice = uiSlice;
