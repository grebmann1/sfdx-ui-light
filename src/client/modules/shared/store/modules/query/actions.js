//import * as salesforce from '../../../service/salesforce';
const salesforce = {};
import {
    REQUEST_QUERY,
    RECEIVE_QUERY_SUCCESS,
    RECEIVE_QUERY_ERROR,
    CLEAR_QUERY_ERROR
} from './constants';
import { updateApiLimit } from '../ui/actions';

function requestQuery() {
    return {
        type: REQUEST_QUERY
    };
}

function receiveQuerySuccess(data, soql) {
    return {
        type: RECEIVE_QUERY_SUCCESS,
        payload: { data, soql }
    };
}

function receiveQueryError(error) {
    return {
        type: RECEIVE_QUERY_ERROR,
        payload: { error }
    };
}

export function executeQuery({connector,soql}, isAllRows) {
    const apiPath = isAllRows ? '/queryAll' : '/query';
    return async dispatch => {
        dispatch(requestQuery());
        connector
            .request({
                method: 'GET',
                url: `${apiPath}?q=${encodeURIComponent(soql)}`,
                //headers: salesforce.getQueryHeaders() // To update later
            })
            .then(res => {
                dispatch(receiveQuerySuccess(res, soql));
                dispatch(updateApiLimit({connector}));
            })
            .catch(err => {
                dispatch(receiveQueryError(err));
            });
    };
}

export function clearQueryError() {
    return {
        type: CLEAR_QUERY_ERROR
    };
}
