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

function receiveSObjectsSuccess(data,alias) {
    return {
        type: RECEIVE_SOBJECTS_SUCCESS,
        payload: { data,alias }
    };
}

function receiveSObjectsError(error) {
    return {
        type: RECEIVE_SOBJECTS_ERROR,
        payload: { error }
    };
}

function shouldFetchSObjects({ sobjects },alias) {
    return !sobjects || !sobjects.data || sobjects.alias != alias
}

function fetchSObjects({connector}) {
    return async dispatch => {
        dispatch(requestSObjects());
        connector
        .describeGlobal()
        .then(res => {
            dispatch(receiveSObjectsSuccess(res,connector.alias));
            dispatch(updateApiLimit({connector}));
        })
        .catch(err => {
            dispatch(receiveSObjectsError(err));
        });
    };
}

export function fetchSObjectsIfNeeded({connector}) {
    return (dispatch, getState) => {
        console.log('check state',getState());
        if (shouldFetchSObjects(getState(),connector.alias)) {
            console.log('------------------ FETCH NEW SOBJECTS ---------------');
            dispatch(fetchSObjects({connector}));
            console.log('check state',getState());
        }
    };
}

export function clearSObjectsError() {
    return {
        type: CLEAR_SOBJECTS_ERROR
    };
}
