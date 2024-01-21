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

function receiveSObjectSuccess(sObjectName, data,alias) {
    return {
        type: RECEIVE_SOBJECT_SUCCESS,
        payload: { sObjectName, data, alias }
    };
}

function receiveSObjectError(sObjectName, error) {
    return {
        type: RECEIVE_SOBJECT_ERROR,
        payload: { sObjectName, error }
    };
}

function shouldFetchSObject({ sobject }, sObjectName,alias) {
    return !sobject[sObjectName] || !sobject[sObjectName].data || sobject.alias != alias
}

function describeSObject({connector,sObjectName}) {
    return async dispatch => {
        dispatch(requestSObject({connector,sObjectName}));

        connector
        .describe(sObjectName)
        .then(res => {
            dispatch(receiveSObjectSuccess(sObjectName, res,connector.alias));
            dispatch(updateApiLimit({connector}));
        })
        .catch(err => {
            dispatch(receiveSObjectError(sObjectName, err));
        });
    };
}

export function describeSObjectIfNeeded({connector,sObjectName}) {
    return (dispatch, getState) => {
        if (shouldFetchSObject(getState(),sObjectName,connector.alias)) {
            dispatch(describeSObject({connector,sObjectName}));
        }
    };
}

export function clearSObjectError(sObjectName) {
    return {
        type: CLEAR_SOBJECT_ERROR,
        payload: { sObjectName }
    };
}
