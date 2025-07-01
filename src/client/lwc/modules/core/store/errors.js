import { createSlice } from '@reduxjs/toolkit';
import { guid } from 'shared/utils';
// Error slice for global error logging
const errorSlice = createSlice({
    name: 'errors',
    initialState: [], // Array of { id, message, details, time }
    reducers: {
        addError: {
            reducer(state, action) {
                state.push(action.payload);
            },
            prepare(error) {
                return {
                    payload: {
                        id: guid(),
                        message: error.message,
                        details : error.details || '',
                        time: new Date().toISOString(),
                    },
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