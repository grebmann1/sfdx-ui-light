import { createSlice,createAsyncThunk,createEntityAdapter } from '@reduxjs/toolkit';
import { lowerCaseKey,arrayToMap,isUndefinedOrNull } from 'shared/utils';
import { cacheManager,CACHE_ORG_DATA_TYPES} from 'shared/cacheManager';
import LOGGER from 'shared/logger';

const DESCRIBE_ID = {
    TOOLING:'TOOLING',
    STANDARD:'STANDARD'
}

// Create an entity adapter for sObjects

// Thunks using createAsyncThunk
export const describeSObjects = createAsyncThunk(
    'describe/describeSObjects',
    async ({ connector }, { dispatch, getState }) => {
        LOGGER.debug('describeSObjects/connector',connector);
        // TODO: connector should be replaced by conn or use the original connector 
        //const conn = useToolingApi ? connector.tooling : connector;
        const fetchDescribeAndSave = async () => {
            const result = {
                standard: await connector.describeGlobal(),
                tooling: await connector.tooling.describeGlobal(),
            };
            if(isUndefinedOrNull(connector.alias)){
                throw new Error('No alias found');
            }
            cacheManager.saveOrgData(connector.alias, CACHE_ORG_DATA_TYPES.DESCRIBE_GLOBAL, result);
            return result;
        }

        try {
            const cachedDescribe = await cacheManager.loadOrgData(connector.alias, CACHE_ORG_DATA_TYPES.DESCRIBE_GLOBAL);
            LOGGER.debug('cachedDescribe',cachedDescribe);
            if(cachedDescribe){
                fetchDescribeAndSave();
                return cachedDescribe;
            }else{
                return await fetchDescribeAndSave();
            }
        } catch (err) {
            throw { error: err };
        }
    }
);

export const describeVersion = createAsyncThunk(
    'describe/describeVersion',
    async ({ connector }, { dispatch, getState }) => {
        // TODO: connector should be replaced by conn or use the original connector 
        const fetchDescribeAndSave = async () => {
            const result = await connector.metadata.describe(connector.version);
            if(isUndefinedOrNull(connector.alias)){
                throw "No alias found";
            }
            cacheManager.saveOrgData(connector.alias, CACHE_ORG_DATA_TYPES.DESCRIBE_VERSION, result);
            return result;
        }

        try {
            const cachedDescribe = await cacheManager.loadOrgData(connector.alias, CACHE_ORG_DATA_TYPES.DESCRIBE_VERSION);
            LOGGER.debug('cachedDescribe',cachedDescribe);
            if(cachedDescribe){
                fetchDescribeAndSave();
                return cachedDescribe;
            }else{
                return await fetchDescribeAndSave();
            }
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




