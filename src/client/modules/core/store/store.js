import { configureStore } from '@reduxjs/toolkit'
import logger from 'shared/middleware';
import * as SOBJECT from './sobject';
import * as DESCRIBE from './describe';
import * as DOCUMENT from './document';
import * as APPLICATION from './application';
import {UI,QUERY} from 'soql/store';
const store = configureStore({
    reducer: {
        application:APPLICATION.reduxSlice.reducer,
        sobject: SOBJECT.reduxSlice.reducer,
        describe: DESCRIBE.reduxSlice.reducer,
        ui : UI.reduxSlice.reducer,
        query : QUERY.reduxSlice.reducer,
        queryFiles : DOCUMENT.reduxSlices.QUERYFILE.reducer,
        recents : DOCUMENT.reduxSlices.RECENT.reducer
    },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware({
        serializableCheck: {
            // Ignore these action types
            ignoredActions: ['application/updateConnector','application/login'],
            // Ignore these field paths in all actions
            ignoredActionPaths: ['payload.Connector'],
            // Ignore these paths in the state
            ignoredPaths: ['application.connector'],
          },
    }).concat(logger),
    devTools: process.env.NODE_ENV !== 'production',
});

export { 
    store,
    UI,
    QUERY,
    DOCUMENT,
    APPLICATION,
    SOBJECT,
    DESCRIBE
};
export { connectStore } from './wire-adapter';

export const SELECTORS = {
    sobject:SOBJECT.sObjectsAdapter.getSelectors((state) => state.sobject),
    describe:(state) => state.describe,
    queries:QUERY.queryAdapter.getSelectors((state) => state.query),
    queryFiles:DOCUMENT.queryFileAdapter.getSelectors((state) => state.queryFiles),
}