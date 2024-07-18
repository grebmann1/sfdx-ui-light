import { createSlice,createAsyncThunk,createEntityAdapter } from '@reduxjs/toolkit';
import { lowerCaseKey,arrayToMap } from 'shared/utils';


const DESCRIBE_ID = {
    TOOLING:'TOOLING',
    STANDARD:'STANDARD'
}

// Create an entity adapter for sObjects

// Thunks using createAsyncThunk
export const describeSObjects = createAsyncThunk(
    'describe/describeSObjects',
    async ({ connector }, { dispatch, getState }) => {
        //const conn = useToolingApi ? connector.tooling : connector;
        try {
            return { 
                standard: await connector.describeGlobal(),
                tooling: await connector.tooling.describeGlobal(),
            };
        } catch (err) {
            throw { error: err };
        }
    }
);

export const getDescribeTableName = useToolingApi => useToolingApi?DESCRIBE_ID.TOOLING:DESCRIBE_ID.STANDARD;

// Create a slice with reducers
const describeSlice = createSlice({
    name: 'describe',
    initialState:{
        prefixMap:{},
        nameMap:{},
        error:null,
        isFetching:false
    },
    extraReducers: (builder) => {
        builder
            .addCase(describeSObjects.pending, (state, action) => {
                state.error = null;
                state.isFetching = true;
            })
            .addCase(describeSObjects.fulfilled, (state, action) => {
                const { standard,tooling } = action.payload;
                // Tooling
                Object.assign(state.prefixMap,arrayToMap(tooling.sobjects,'keyPrefix',{useToolingApi:true},lowerCaseKey));
                Object.assign(state.nameMap,arrayToMap(tooling.sobjects,'name',{useToolingApi:true},lowerCaseKey));
                // Standard
                Object.assign(state.prefixMap,arrayToMap(standard.sobjects,'keyPrefix',{useToolingApi:false},lowerCaseKey));
                Object.assign(state.nameMap,arrayToMap(standard.sobjects,'name',{useToolingApi:false},lowerCaseKey));
                
                state.isFetching = false;
            })
            .addCase(describeSObjects.rejected, (state, action) => {
                const { error } = action;
                state.error = error;
                state.isFetching = false;
                console.error(error);
            })
    }
});

export const reduxSlice = describeSlice;




