import { createSlice, createAsyncThunk,createEntityAdapter } from '@reduxjs/toolkit';
import { DOCUMENT } from 'core/store';
import { lowerCaseKey } from 'shared/utils';

export const queryAdapter = createEntityAdapter();

// Thunks using createAsyncThunk
export const executeQuery = createAsyncThunk(
    'queries/executeQuery',
    async ({ connector, soql,tabId,createdDate,useToolingApi,includeDeletedRecords }, { dispatch }) => {
        try {
            const _conn = useToolingApi ? connector.conn.tooling : connector.conn;
            const res = await _conn.query(soql).scanAll(includeDeletedRecords || false);
            dispatch(DOCUMENT.reduxSlices.RECENT.actions.saveQuery({
                soql, 
                alias: connector.configuration.alias,
                data: res
            }));
            return { data: res, soql, alias: connector.configuration.alias,tabId};
        } catch (err) {
            console.error(err);
            throw err;
        }
    }
);

export const explainQuery = createAsyncThunk(
    'queries/explainQuery',
    async ({ connector, soql,tabId,useToolingApi }, { dispatch }) => {
        try {
            const _conn = useToolingApi ? connector.conn.tooling : connector.conn;
            const query = _conn.query(soql);
            const res = await query.explain();
            //console.log('res',res)
            return { data: res, soql, alias: connector.configuration.alias,tabId};
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
                const { tabId,createdDate } = action.meta.arg;
                queryAdapter.upsertOne(state, {
                    id: lowerCaseKey(tabId),
                    data:null,
                    createdDate,
                    isFetching: true,
                    error: null 
                });
            })
            .addCase(executeQuery.fulfilled, (state, action) => {
                const { data,soql } = action.payload;
                const { tabId,sobjectName,createdDate } = action.meta.arg;
                queryAdapter.upsertOne(state, {
                    id: lowerCaseKey(tabId),
                    data,
                    soql,
                    isFetching: false,
                    createdDate,
                    sobjectName,
                    error: null
                });
            })
            .addCase(executeQuery.rejected, (state, action) => {
                const { error } = action;
                const { tabId } = action.meta.arg;
                queryAdapter.upsertOne(state, {
                    id: lowerCaseKey(tabId),
                    isFetching:false,
                    error
                });
                //console.error(error);
            })/** Handling Error for ExplainQuery Rejected */
            .addCase(explainQuery.pending, (state, action) => {
                const { tabId } = action.meta.arg;
                queryAdapter.upsertOne(state, {
                    id: lowerCaseKey(tabId),
                    isFetching: true,
                    error: null 
                });
            })
            .addCase(explainQuery.fulfilled, (state, action) => {
                const { tabId } = action.meta.arg;
                queryAdapter.upsertOne(state, {
                    id: lowerCaseKey(tabId),
                    isFetching: false,
                    error: null
                });
            })
            .addCase(explainQuery.rejected, (state, action) => {
                const { error } = action;
                const { tabId } = action.meta.arg;
                queryAdapter.upsertOne(state, {
                    id: lowerCaseKey(tabId),
                    isFetching:false,
                    error
                });
                //console.error(error);
            });
    }
});

export const reduxSlice = queriesSlice;
