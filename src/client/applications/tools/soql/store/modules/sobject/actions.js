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

function receiveSObjectSuccess(sObjectName, data) {
    return {
        type: RECEIVE_SOBJECT_SUCCESS,
        payload: { sObjectName, data}
    };
}

function receiveSObjectError(sObjectName, error) {
    return {
        type: RECEIVE_SOBJECT_ERROR,
        payload: { sObjectName, error }
    };
}

function shouldFetchSObject({ sobject,ui }, sObjectName,useToolingApi) {
    return !sobject[sObjectName] || !sobject[sObjectName].data || ui.useToolingApi != useToolingApi
}

function describeSObject({connector,sObjectName}) {
    return async (dispatch, getState) => {
        const { ui } = getState();
        dispatch(requestSObject({connector,sObjectName}));
        const conn = ui.useToolingApi?connector.tooling:connector;

        conn
        .describe(sObjectName)
        .then(res => {
            dispatch(receiveSObjectSuccess(sObjectName, res));
            dispatch(updateApiLimit({connector}));
        })
        .catch(err => {
            dispatch(receiveSObjectError(sObjectName, err));
        });
    };
}

export function describeSObjectIfNeeded({connector,sObjectName,useToolingApi}) {
    return (dispatch, getState) => {
        if (shouldFetchSObject(getState(),sObjectName,useToolingApi)) {
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
