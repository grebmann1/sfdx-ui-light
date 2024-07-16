import { createSlice, createAsyncThunk,createEntityAdapter } from '@reduxjs/toolkit';
import { DOCUMENT } from 'core/store';
import { lowerCaseKey } from 'shared/utils';

export const queryAdapter = createEntityAdapter();

// Thunks using createAsyncThunk
export const executeQuery = createAsyncThunk(
    'queries/executeQuery',
    async ({ connector, soql,tabId, isAllRows }, { dispatch }) => {
        //const apiPath = isAllRows ? '/queryAll' : '/query';
        try {
            const res = await connector.query(soql);
            dispatch(DOCUMENT.reduxSlices.RECENT.actions.saveQuery({
                soql, 
                alias: connector.alias,
                data: res
            }));
            return { data: res, soql, alias: connector.alias,tabId };
        } catch (err) {
            console.error(err);
            throw err;
        }
    }
);

/*
{
        isFetching: false,
        createdDate:null,
        alias:null,
        soql:null,
        data: null,
        error: null
    }
*/
// Create a slice with reducers and extraReducers
const queriesSlice = createSlice({
    name: 'queries',
    initialState:queryAdapter.getInitialState(),
    reducers: {
        clearQueryError: (state, action) => {
            const { tabId } = action.payload;
            queryAdapter.upsertOne(state, {
                id: lowerCaseKey(tabId),
                error: null
            });
        }
    },
    extraReducers: (builder) => {
        builder
            .addCase(executeQuery.pending, (state, action) => {
                const { tabId } = action.meta.arg;
                queryAdapter.upsertOne(state, {
                    id: lowerCaseKey(tabId),
                    isFetching: true,
                    error: null 
                });
            })
            .addCase(executeQuery.fulfilled, (state, action) => {
                const { data,soql } = action.payload;
                const { tabId } = action.meta.arg;
                queryAdapter.upsertOne(state, {
                    id: lowerCaseKey(tabId),
                    data,
                    soql,
                    isFetching: false,
                    createdDate:Date.now(),
                    error: null
                });
            })
            .addCase(executeQuery.rejected, (state, action) => {
                const { error } = action;
                const { tabId } = action.meta.arg;
                queryAdapter.updateOne(state, {
                    id: lowerCaseKey(tabId),
                    changes: { isFetching: false, error }
                });
                console.error(error);
            });
    }
});

export const reduxSlice = queriesSlice;
