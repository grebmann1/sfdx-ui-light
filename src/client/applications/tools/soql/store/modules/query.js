import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { store,UI } from 'core/store';

// Thunks using createAsyncThunk
export const executeQuery = createAsyncThunk(
    'queries/executeQuery',
    async ({ connector, soql, isAllRows }, { dispatch }) => {
        //const apiPath = isAllRows ? '/queryAll' : '/query';
        try {
            const res = await connector.query(soql);
            dispatch(UI.reduxSlice.actions.saveRecentQuery({soql, alias: connector.alias}));
            // saveRecentQuery
            return { data: res, soql, alias: connector.alias };
        } catch (err) {
            console.error(err);
            throw { error: err };
        }
    }
);

// Create a slice with reducers and extraReducers
const queriesSlice = createSlice({
    name: 'queries',
    initialState: {
        isFetching: false,
        alias:null,
        soql:null,
        data: null,
        error: null
    },
    reducers: {
        clearQueryError: (state, action) => {
            state.error = null;
        }
    },
    extraReducers: (builder) => {
        builder
            .addCase(executeQuery.pending, (state, action) => {
                state.isFetching = true;
                state.error = null;
            })
            .addCase(executeQuery.fulfilled, (state, action) => {
                const { data, soql, alias } = action.payload;
                Object.assign(state, { 
                    isFetching:false,
                    data,
                    soql,
                    alias,
                    error:null
                })
            })
            .addCase(executeQuery.rejected, (state, action) => {
                state.isFetching = false;
                state.error = action.error.message;
            });
    }
});

// Export selectors
export const selectQueryState = (state) => state.queries;

export const reduxSlice = queriesSlice;
