import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import {
    getField,
    getFlattenedFields,
    composeQuery,
    parseQuery,
    isQueryValid
} from '@jetstreamapp/soql-parser-js';
import { stripNamespace,isNotUndefinedOrNull,guid,lowerCaseKey } from 'shared/utils';
import { SELECTORS,DOCUMENT } from 'core/store';


const SETTINGS_KEY = 'SETTINGS_KEY';

const INITIAL_QUERY = {
    fields: [getField('Id')],
    sObject: undefined
};
const INITIAL_TABS = [
    enrichTab({id:guid(),body:'SELECT Id'},true)
];

const QUERY_CONFIG = {
    fieldMaxLineLength: 100,
    fieldSubqueryParensOnOwnLine: false,
}



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



function saveCacheSettings(alias,state) {
    
    try {
        const { soql, leftPanelToggled, recentPanelToggled,tabs } = state;
        localStorage.setItem(`${alias}-${SETTINGS_KEY}`,JSON.stringify({
            soql,
            leftPanelToggled,
            recentPanelToggled,
            tabs
        }));
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
        return _toggleChildRelationshipField(
            state,
            fieldName,
            relationships,
            childRelationship
        );
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

function updateCurrentTab(state,attributes){
    const tabIndex = state.tabs.findIndex(x => x.id === state.currentTab.id);
    if(tabIndex > -1 ){
        state.tabs[tabIndex].body = state.soql;
        state.tabs[tabIndex].useToolingApi = state.useToolingApi;
        if(attributes){
            // Extra Attributes
            Object.assign(state.tabs[tabIndex],attributes);
        }
    }
}

function formatTab(tab){
    const {id,name,body,useToolingApi,isDraft,fileId,fileBody} = tab;
    return {id,name,body,useToolingApi,isDraft,fileId,fileBody};
}

function enrichTabs(tabs,queryFiles){
    return tabs.map(tab => enrichTab(tab,queryFiles))
}

function enrichTab(tab,queryFiles){
    const file = tab.fileId?SELECTORS.queryFiles.selectById({queryFiles},lowerCaseKey(tab.fileId)):null;
    const fileBody = file?.content || tab.fileBody;
    return {
        ...tab,
        fileBody:fileBody,
        isDraft:fileBody != tab.body && isNotUndefinedOrNull(tab.fileId)
    }
}


function updateSOQL(state,soql){
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
        useToolingApi: false,
        apiUsage: undefined,
        recentQueries: [],
        tabs:INITIAL_TABS,
        currentTab:INITIAL_TABS[0],
        selectedSObject: undefined,
        query: INITIAL_QUERY,
        soql: '',
        childRelationship: undefined,
        sort: undefined,
        leftPanelToggled:false,
        recentPanelToggled:false,
    },
    reducers: {
        loadCacheSettings : (state,action) => {
            const { alias,queryFiles } = action.payload;
            const cachedConfig = loadCacheSettings(alias);
            if(cachedConfig){
                const { soql, leftPanelToggled,recentPanelToggled,tabs } = cachedConfig; 
                Object.assign(state,{
                    soql:soql || '',
                    leftPanelToggled,
                    recentPanelToggled,
                    tabs:enrichTabs(tabs || INITIAL_TABS,queryFiles)
                });
            }
            console.log('#cachedConfig#',cachedConfig);
        },
        saveCacheSettings : (state,action) => {
            const { alias } = action.payload;
            if(isNotUndefinedOrNull(alias)){
                saveCacheSettings(alias,state);
            }
        },
        initTabs:(state,action) => {
            const { queryFiles } = action.payload;
            state.tabs = enrichTabs(state.tabs.map(formatTab),queryFiles)
        },
        addTab:(state,action) => {
            const { queryFiles,tab } = action.payload;
            const enrichedTab = enrichTab(formatTab(tab),queryFiles);
            state.tabs.push(enrichedTab);
            // Assign new tab
            state.currentTab = enrichedTab;
            state.currentFileId = enrichedTab.fileId;
            updateSOQL(state,enrichedTab.body);
        },
        removeTab:(state,action) => {
            const { id,alias } = action.payload;
            state.tabs = state.tabs.filter(x => x.id != id);
            // Assign last tab
            if(state.tabs.length > 0 && state.currentTab.id == id){
                const lastTab = state.tabs[state.tabs.length - 1];
                state.currentTab = lastTab;
                state.useToolingApi = lastTab.useToolingApi;
                updateSOQL(state,lastTab.body);
            }
            if(isNotUndefinedOrNull(alias)){
                saveCacheSettings(alias,state);
            }
            // can't remove the last one !!!
        },
        selectionTab:(state,action) => {
            const { id } = action.payload;
            const tab = state.tabs.find(x => x.id == id);
            // Assign new tab
            if(tab){
                state.currentTab = tab;
                state.useToolingApi = tab.useToolingApi;
                updateSOQL(state,tab.body);
            }
        },
        linkFileToTab:(state,action) => {
            const { fileId,alias,queryFiles } = action.payload;
            const currentTabIndex = state.tabs.findIndex(x => x.id == state.currentTab.id);
            if(currentTabIndex > -1){
                const enrichedTab = enrichTab(
                    formatTab({...state.tabs[currentTabIndex],fileId}),queryFiles
                );
                state.tabs[currentTabIndex] = enrichedTab
                state.currentTab = enrichedTab;
                if(isNotUndefinedOrNull(alias)){
                    saveCacheSettings(alias,state);
                }
            }
        },
        updateLeftPanel:(state, action) => {
            const { value,alias } = action.payload;
            state.leftPanelToggled = value === true;
            if(isNotUndefinedOrNull(alias)){
                saveCacheSettings(alias,state);
            }
        },
        updateRecentPanel:(state, action) => {
            const { value,alias } = action.payload;
            state.recentPanelToggled = value === true;
            if(isNotUndefinedOrNull(alias)){
                saveCacheSettings(alias,state);
            }
        },
        updateApiLimit: (state, action) => {
            const { limitInfo } = action.payload?.connector;
            state.apiUsage = limitInfo ? limitInfo.apiUsage : undefined;
        },
        selectSObject: (state, action) => {
            const {sObjectName} = action.payload;
            const query = {
                ...INITIAL_QUERY,
                sObject: stripNamespace(sObjectName)
            };
            state.selectedSObject = sObjectName;
            state.query = query;
            state.soql = composeQuery(query, { format: true,formatOptions:QUERY_CONFIG });
            updateCurrentTab(state);
        },
        deselectSObject: (state) => {
            state.selectedSObject = undefined;
            state.sort = undefined;
            updateCurrentTab(state);
        },
        toggleField: (state, action) => {
            const query = toggleField(state.query, action);
            state.query = query;
            state.soql = composeQuery(query, { format: true,formatOptions:QUERY_CONFIG });
            updateCurrentTab(state);
        },
        toggleRelationship: (state, action) => {
            const query = toggleRelationship(state.query, action);
            state.query = query;
            state.soql = composeQuery(query, { format: true,formatOptions:QUERY_CONFIG });
            updateCurrentTab(state);
        },
        toggleToolingApi: (state, action) => {
            state.useToolingApi = action.payload.useToolingApi === true;
            updateCurrentTab(state);
        },
        updateSoql: (state, action) => {
            const { soql,isDraft } = action.payload;
            updateSOQL(state,soql);
            updateCurrentTab(state,{isDraft});
        },
        formatSoql: (state) => {
            state.soql = composeQuery(state.query, { format: true,formatOptions:QUERY_CONFIG });
            updateCurrentTab(state);
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
            state.soql = composeQuery(query, { format: true,formatOptions:QUERY_CONFIG });
        },
        clearAllFields: (state) => {
            const query = clearAllFields(state.query);
            state.query = query;
            state.soql = composeQuery(query, { format: true,formatOptions:QUERY_CONFIG });
            updateCurrentTab(state);
        },
        sortFields: (state, action) => {
            state.sort = action.payload.sort;
        }
    }
});


/* Test */

// Export actions
export const SORT = { ORDER: { ASC: 'ASC', DESC: 'DESC' } };
export const reduxSlice = uiSlice;
