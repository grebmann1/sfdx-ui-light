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

function receiveQuerySuccess(data, soql, alias) {
    return {
        type: RECEIVE_QUERY_SUCCESS,
        payload: { data, soql,alias },
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
            .query(soql)
            /*.request({
                method: 'GET',
                url: `${apiPath}?q=${encodeURIComponent(soql)}`,
                //headers: salesforce.getQueryHeaders() // To update later
            })*/
            .then(res => {
                dispatch(receiveQuerySuccess(res, soql,connector.alias));
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
