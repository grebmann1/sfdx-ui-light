import {

    UPDATE_API_LIMIT,
    LOAD_RECENT_QUERIES,
    SELECT_SOBJECT,
    DESELECT_SOBJECT,
    TOGGLE_FIELD,
    TOGGLE_RELATIONSHIP,
    UPDATE_SOQL,
    FORMAT_SOQL,
    SELECT_CHILD_RELATIONSHIP,
    DESELECT_CHILD_RELATIONSHIP,
    SELECT_ALL_FIELDS,
    CLEAR_ALL_FIELDS,
    SORT_FIELDS,
    TOGGLE_TOOLINGAPI
} from './constants';


export function updateApiLimit({connector}) {
    return {
        type: UPDATE_API_LIMIT,
        payload: { connector },
        alias: connector.alias
    };
}

export function loadRecentQueries(alias) {
    return {
        type: LOAD_RECENT_QUERIES,
        alias: alias
    };
}

export function selectSObject(sObjectName) {
    return {
        type: SELECT_SOBJECT,
        payload: { sObjectName }
    };
}

export function deselectSObject() {
    return {
        type: DESELECT_SOBJECT
    };
}

export function toggleField(fieldName, relationships, childRelationship) {
    return {
        type: TOGGLE_FIELD,
        payload: {
            fieldName,
            relationships,
            childRelationship
        }
    };
}

export function toggleRelationship(relationshipName) {
    return {
        type: TOGGLE_RELATIONSHIP,
        payload: { relationshipName }
    };
}

export function updateSoql({connector,soql}) {
    return {
        type: UPDATE_SOQL,
        payload: { connector,soql }
    };
}
export function updateToolingApi(useToolingApi) {
    return {
        type: TOGGLE_TOOLINGAPI,
        payload: { useToolingApi }
    };
}

export function formatSoql() {
    return {
        type: FORMAT_SOQL
    };
}

export function selectChildRelationship(childRelationship) {
    return {
        type: SELECT_CHILD_RELATIONSHIP,
        payload: { childRelationship }
    };
}

export function deselectChildRelationship() {
    return {
        type: DESELECT_CHILD_RELATIONSHIP
    };
}

export function selectAllFields(sObjectMeta) {
    return {
        type: SELECT_ALL_FIELDS,
        payload: { sObjectMeta }
    };
}

export function clearAllFields() {
    return {
        type: CLEAR_ALL_FIELDS
    };
}

export function sortFields(order) {
    return {
        type: SORT_FIELDS,
        payload: {
            sort: {
                order
            }
        }
    };
}
