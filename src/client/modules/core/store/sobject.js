import { createSlice,createAsyncThunk,createEntityAdapter } from '@reduxjs/toolkit';
import { lowerCaseKey } from 'shared/utils';


// Create an entity adapter for sObjects
export const sObjectsAdapter = createEntityAdapter({
    selectId: (sobject) => lowerCaseKey(sobject?.id),
});

const initialState = sObjectsAdapter.getInitialState();

// Thunks using createAsyncThunk
export const describeSObject = createAsyncThunk(
    'sObjects/describeSObject',
    async ({ connector, sObjectName,useToolingApi },thunkAPI) => {
        const conn = useToolingApi ? connector.tooling : connector;

        try {
            const res = await conn.describe(sObjectName);
            //dispatch(updateApiLimit({ connector }));
            return { sObjectName, data: res };
        } catch (err) {
            throw { sObjectName, error: err };
        }
    },
    {
        condition: (payload, { getState, extra }) => {
            const { sobject } = getState();
            return !sobject.ids.includes(lowerCaseKey(payload.sObjectName)); // missing force refresh
        },
    },
);



// Create a slice with reducers
const sObjectsSlice = createSlice({
    name: 'sObject',
    initialState,
    extraReducers: (builder) => {
        builder
            .addCase(describeSObject.pending, (state, action) => {
                const { requestId } = action.meta
                const { sObjectName } = action.meta.arg;
                sObjectsAdapter.upsertOne(state, {
                    id: lowerCaseKey(sObjectName),
                    isFetching: true,
                    error: null 
                });
            })
            .addCase(describeSObject.fulfilled, (state, action) => {
                const { sObjectName,data } = action.payload;
                sObjectsAdapter.upsertOne(state, {
                    id: lowerCaseKey(sObjectName),
                    data,
                    isFetching: false,
                    error: null
                });
            })
            .addCase(describeSObject.rejected, (state, action) => {
                const { sObjectName } = action.meta.arg;
                const { error } = action;
                sObjectsAdapter.updateOne(state, {
                    id: lowerCaseKey(sObjectName),
                    changes: { isFetching: false, error }
                });
                console.error(error);
            })
    }
});

export const reduxSlice = sObjectsSlice;



