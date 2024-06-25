//import * as salesforce from '../../../service/salesforce';
const salesforce = {};
import {
    REQUEST_SOBJECT,
    RECEIVE_SOBJECT_SUCCESS,
    RECEIVE_SOBJECT_ERROR,
    CLEAR_SOBJECT_ERROR
} from './constants';
import { updateApiLimit } from '../ui/actions';

function requestSObject({connector,sObjectName}) {
    return {
        type: REQUEST_SOBJECT,
        payload: {connector,sObjectName}
    };
}

function receiveSObjectSuccess(sObjectName, data,alias,useToolingApi) {
    return {
        type: RECEIVE_SOBJECT_SUCCESS,
        payload: { sObjectName, data, alias,useToolingApi}
    };
}

function receiveSObjectError(sObjectName, error) {
    return {
        type: RECEIVE_SOBJECT_ERROR,
        payload: { sObjectName, error }
    };
}

function shouldFetchSObject({ sobject }, sObjectName,alias,useToolingApi) {
    return !sobject[sObjectName] || !sobject[sObjectName].data || sobject.alias != alias || sobject.useToolingApi != useToolingApi
}

function describeSObject({connector,sObjectName,useToolingApi}) {
    return async dispatch => {
        dispatch(requestSObject({connector,sObjectName}));
        const conn = useToolingApi?connector.tooling:connector;

        conn
        .describe(sObjectName)
        .then(res => {
            dispatch(receiveSObjectSuccess(sObjectName, res,connector.alias,useToolingApi));
            dispatch(updateApiLimit({connector}));
        })
        .catch(err => {
            dispatch(receiveSObjectError(sObjectName, err));
        });
    };
}

export function describeSObjectIfNeeded({connector,sObjectName,useToolingApi}) {
    return (dispatch, getState) => {
        if (shouldFetchSObject(getState(),sObjectName,connector.alias,useToolingApi)) {
            dispatch(describeSObject({connector,sObjectName,useToolingApi}));
        }
    };
}

export function clearSObjectError(sObjectName) {
    return {
        type: CLEAR_SOBJECT_ERROR,
        payload: { sObjectName }
    };
}
