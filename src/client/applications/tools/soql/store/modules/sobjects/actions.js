import {
    REQUEST_SOBJECTS,
    RECEIVE_SOBJECTS_SUCCESS,
    RECEIVE_SOBJECTS_ERROR,
    CLEAR_SOBJECTS_ERROR
} from './constants';
import { updateApiLimit,updateToolingApi } from '../ui/actions';

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

function shouldFetchSObjects({ sobjects,ui },useToolingApi) {
    return !sobjects || !sobjects.data ||  ui.useToolingApi != useToolingApi
}

function fetchSObjects({connector}) {
    return async (dispatch,getState) => {
        const { ui } = getState();
        dispatch(requestSObjects());
        const conn = ui.useToolingApi?connector.tooling:connector;

        conn
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

export function fetchSObjectsIfNeeded({connector,useToolingApi}) {
    return (dispatch, getState) => {
        if (shouldFetchSObjects(getState(),useToolingApi)) {
            dispatch(updateToolingApi(useToolingApi));
            dispatch(fetchSObjects({connector}));
        }
    };
}

export function clearSObjectsError() {
    return {
        type: CLEAR_SOBJECTS_ERROR
    };
}
