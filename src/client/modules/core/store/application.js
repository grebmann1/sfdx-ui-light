import { createSlice,createAsyncThunk } from '@reduxjs/toolkit';
import { lowerCaseKey,guid,isUndefinedOrNull } from 'shared/utils';


// QUERIES
const applicationSlice = createSlice({
    name: 'application',
    initialState:{
        isLoading:false,
        connector:null,
        isLoggedIn:false,
        currentApplication:null
    },
    reducers: {
        updateCurrentApplication: (state, action) => {
            state.currentApplication = action.payload?.application || null
        },
        startLoading: (state, action) => {
            state.isLoading = true;
            state.isLoadingMessage = action.payload?.message || null;
        },
        stopLoading: (state, action) => {
            state.isLoading = false
        },
        login: (state, action) => {
            const { connector } = action.payload;
            state.connector = connector;
            state.isLoggedIn = true;
        },
        logout: (state, action) => {
            state.connector = null;
            state.isLoggedIn = false;
        },
        updateConnector: (state, action) => {
            const { connector } = action.payload;
            state.connector = connector;
        }
    },
});

export const reduxSlice = applicationSlice;