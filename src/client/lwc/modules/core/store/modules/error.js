import { createSlice } from '@reduxjs/toolkit';
import { guid } from 'shared/utils';

function normalizeErrorPayload(error) {
    if (error == null) {
        return {
            id: guid(),
            message: 'Unknown error',
            details: '',
            source: '',
            time: new Date().toISOString(),
        };
    }
    const isErrorInstance = error instanceof Error;
    const message =
        isErrorInstance ? error.message : (typeof error === 'object' && error.message != null ? error.message : String(error));
    const details =
        typeof error === 'object' && error.details != null
            ? String(error.details)
            : isErrorInstance
              ? (error.stack || '')
              : '';
    const source = typeof error === 'object' && error.source != null ? String(error.source) : '';
    return {
        id: guid(),
        message: message || 'Unknown error',
        details: details || '',
        source: source || '',
        time: new Date().toISOString(),
    };
}

// Error slice for global error logging
const errorSlice = createSlice({
    name: 'errors',
    initialState: [], // Array of { id, message, details, time, source? }
    reducers: {
        addError: {
            reducer(state, action) {
                state.push(action.payload);
            },
            prepare(error) {
                return {
                    payload: normalizeErrorPayload(error),
                };
            },
        },
        clearErrors(state) {
            return [];
        },
        removeError(state, action) {
            return state.filter(error => error.id !== action.payload);
        },
    },
});

export const reduxSlice = errorSlice;
