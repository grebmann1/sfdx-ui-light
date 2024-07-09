import { createSlice,createAsyncThunk,createEntityAdapter } from '@reduxjs/toolkit';
import { lowerCaseKey } from 'shared/utils';


const DESCRIBE_ID = {
    TOOLING:'TOOLING',
    STANDARD:'STANDARD'
}

// Create an entity adapter for sObjects
export const describeAdapter = createEntityAdapter();

const initialState = describeAdapter.getInitialState();

// Thunks using createAsyncThunk
export const describeSObjects = createAsyncThunk(
    'describe/describeSObjects',
    async ({ connector,useToolingApi }, { dispatch, getState }) => {
        const conn = useToolingApi ? connector.tooling : connector;
        try {
            
            const res = await conn.describeGlobal();
            //dispatch(updateApiLimit({ connector }));
            return { useToolingApi,data: res };
        } catch (err) {
            throw { error: err };
        }
    },
    {
        condition: (payload,{ getState, extra }) => {
            const { useToolingApi } = payload;
            const targetName = getDescribeTableName(useToolingApi);
            const { describe } = getState();
            return !describe.ids.includes(targetName) || !describe.entities[targetName].isFetching
        },
    },
);

export const getDescribeTableName = useToolingApi => useToolingApi?DESCRIBE_ID.TOOLING:DESCRIBE_ID.STANDARD;

// Create a slice with reducers
const describeSlice = createSlice({
    name: 'describe',
    initialState,
    reducers: {
        clearDescribeError: {
            reducer: (state, action) => {
                const { useToolingApi } = action.payload;
                describeAdapter.upsertOne(state, {
                    id: getEntityName(useToolingApi),
                    error: null
                });
            },
            prepare: (useToolingApi) => {
              const id = nanoid()
              return { payload: { useToolingApi} }
            },
        }
    },
    extraReducers: (builder) => {
        builder
            .addCase(describeSObjects.pending, (state, action) => {
                const { useToolingApi } = action.meta.arg;
                describeAdapter.upsertOne(state, {
                    id: getDescribeTableName(useToolingApi),
                    isFetching: true, 
                    error: null
                });
            })
            .addCase(describeSObjects.fulfilled, (state, action) => {
                const { data } = action.payload;
                const { useToolingApi } = action.meta.arg;
                describeAdapter.upsertOne(state, {
                    id: getDescribeTableName(useToolingApi),
                    data,
                    isFetching: false,
                    error: null
                });
            })
            .addCase(describeSObjects.rejected, (state, action) => {
                const { useToolingApi } = action.meta.arg;
                const { error } = action;
                describeAdapter.updateOne(state, {
                    id: getDescribeTableName(useToolingApi),
                    changes: { isFetching: false, error }
                });
                console.error(error);
            })
    }
});

export const reduxSlice = describeSlice;




