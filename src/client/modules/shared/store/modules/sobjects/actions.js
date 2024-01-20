//import * as salesforce from '../../../service/salesforce';
const salesforce = {};

import {
    REQUEST_SOBJECTS,
    RECEIVE_SOBJECTS_SUCCESS,
    RECEIVE_SOBJECTS_ERROR,
    CLEAR_SOBJECTS_ERROR
} from './constants';
import { updateApiLimit } from '../ui/actions';

function requestSObjects() {
    return {
        type: REQUEST_SOBJECTS
    };
}

function receiveSObjectsSuccess(data) {
    return {
        type: RECEIVE_SOBJECTS_SUCCESS,
        payload: { data }
    };
}

function receiveSObjectsError(error) {
    return {
        type: RECEIVE_SOBJECTS_ERROR,
        payload: { error }
    };
}

function shouldFetchSObjects({ sobjects }) {
    return !sobjects || !sobjects.data;
}

function fetchSObjects({connector}) {
    return async dispatch => {
        dispatch(requestSObjects());
        connector
        .describeGlobal()
        .then(res => {
            dispatch(receiveSObjectsSuccess(res));
            dispatch(updateApiLimit({connector}));
        })
        .catch(err => {
            dispatch(receiveSObjectsError(err));
        });
    };
}

export function fetchSObjectsIfNeeded({connector}) {
    return (dispatch, getState) => {
        if (shouldFetchSObjects(getState())) {
            dispatch(fetchSObjects({connector}));
        }
    };
}

export function clearSObjectsError() {
    return {
        type: CLEAR_SOBJECTS_ERROR
    };
}
