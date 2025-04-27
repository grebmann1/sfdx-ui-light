import { createSlice, createAsyncThunk, createEntityAdapter } from '@reduxjs/toolkit';
import { lowerCaseKey, isUndefinedOrNull } from 'shared/utils';
import { cacheManager, CACHE_ORG_DATA_TYPES } from 'shared/cacheManager';
import LOGGER from 'shared/logger';
// Create an entity adapter for sObjects
export const sObjectsAdapter = createEntityAdapter({
    selectId: sobject => lowerCaseKey(sobject?.id),
});

const initialState = sObjectsAdapter.getInitialState();

// Thunks using createAsyncThunk
export const describeSObject = createAsyncThunk(
    'sObjects/describeSObject',
    async ({ connector, sObjectName, useToolingApi }, thunkAPI) => {
        console.log('describeSObject', sObjectName, useToolingApi);
        const fetchDescribeAndSave = async sObjectName => {
            const conn = useToolingApi ? connector.tooling : connector;
            const result = {
                sObjectName,
                data: await conn.describe(sObjectName),
            };
            LOGGER.debug('sObjects/describeSObject', result);
            if (isUndefinedOrNull(connector.alias)) {
                throw 'No alias found';
            }
            cacheManager.saveOrgData(
                connector.alias,
                CACHE_ORG_DATA_TYPES.DESCRIBE,
                sObjectName,
                result
            );
            return result;
        };

        try {
            const cachedDescribe = await cacheManager.loadOrgData(
                connector.alias,
                CACHE_ORG_DATA_TYPES.DESCRIBE,
                sObjectName
            );
            if (cachedDescribe) {
                LOGGER.debug('cachedDescribe', cachedDescribe);
                fetchDescribeAndSave(sObjectName);
                return cachedDescribe;
            } else {
                return await fetchDescribeAndSave(sObjectName);
            }
        } catch (err) {
            throw { sObjectName, error: err };
        }
    },
    {
        condition: (payload, { getState, extra }) => {
            const { sobject } = getState();
            LOGGER.log('condition', !sobject.ids.includes(lowerCaseKey(payload.sObjectName)));
            return true; //!sobject.ids.includes(lowerCaseKey(payload.sObjectName)); // missing force refresh and disabled for now as we are using caching
        },
    }
);

// Create a slice with reducers
const sObjectsSlice = createSlice({
    name: 'sObject',
    initialState,
    extraReducers: builder => {
        builder
            .addCase(describeSObject.pending, (state, action) => {
                const { requestId } = action.meta;
                const { sObjectName } = action.meta.arg;
                sObjectsAdapter.upsertOne(state, {
                    id: lowerCaseKey(sObjectName),
                    isFetching: true,
                    error: null,
                });
            })
            .addCase(describeSObject.fulfilled, (state, action) => {
                const { sObjectName, data } = action.payload;
                sObjectsAdapter.upsertOne(state, {
                    id: lowerCaseKey(sObjectName),
                    data,
                    isFetching: false,
                    error: null,
                });
            })
            .addCase(describeSObject.rejected, (state, action) => {
                const { sObjectName } = action.meta.arg;
                const { error } = action;
                sObjectsAdapter.updateOne(state, {
                    id: lowerCaseKey(sObjectName),
                    changes: { isFetching: false, error },
                });
                console.error(error);
            });
    },
});

export const reduxSlice = sObjectsSlice;
