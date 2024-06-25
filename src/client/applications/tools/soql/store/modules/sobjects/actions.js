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

function receiveSObjectsSuccess(data,alias,useToolingApi) {
    return {
        type: RECEIVE_SOBJECTS_SUCCESS,
        payload: { data,alias,useToolingApi }
    };
}

function receiveSObjectsError(error) {
    return {
        type: RECEIVE_SOBJECTS_ERROR,
        payload: { error }
    };
}

function shouldFetchSObjects({ sobjects },alias,useToolingApi) {
    return !sobjects || !sobjects.data || sobjects.alias != alias || sobjects.useToolingApi != useToolingApi
}

function fetchSObjects({connector,useToolingApi}) {
    return async dispatch => {
        dispatch(requestSObjects());
        const conn = useToolingApi?connector.tooling:connector;

        conn
        .describeGlobal()
        .then(res => {
            dispatch(receiveSObjectsSuccess(res,connector.alias,useToolingApi));
            dispatch(updateApiLimit({connector}));
        })
        .catch(err => {
            dispatch(receiveSObjectsError(err));
        });
    };
}

export function fetchSObjectsIfNeeded({connector,useToolingApi}) {
    return (dispatch, getState) => {
        if (shouldFetchSObjects(getState(),connector.alias,useToolingApi)) {
            dispatch(fetchSObjects({connector,useToolingApi}));
        }
    };
}

export function clearSObjectsError() {
    return {
        type: CLEAR_SOBJECTS_ERROR
    };
}
