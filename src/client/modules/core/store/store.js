import { configureStore } from '@reduxjs/toolkit'
import logger from 'shared/middleware';
import * as SOBJECT from './sobject';
import * as DESCRIBE from './describe';
import * as DOCUMENT from './document';
import {UI,QUERY} from 'soql/store';
const store = configureStore({
    reducer: {
        sobject: SOBJECT.reduxSlice.reducer,
        describe: DESCRIBE.reduxSlice.reducer,
        ui : UI.reduxSlice.reducer,
        query : QUERY.reduxSlice.reducer,
        queryFiles : DOCUMENT.reduxSlices.QUERYFILE.reducer,
        recents : DOCUMENT.reduxSlices.RECENT.reducer
    },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(logger),
    devTools: process.env.NODE_ENV !== 'production',
});

export { 
    store,
    UI,
    QUERY,
    DOCUMENT
};
export { connectStore } from './wire-adapter';
export * as SOBJECT from './sobject';
export * as DESCRIBE from './describe';

export const SELECTORS = {
    sobject:SOBJECT.sObjectsAdapter.getSelectors((state) => state.sobject),
    describe:(state) => state.describe,
    queries:QUERY.queryAdapter.getSelectors((state) => state.query),
    queryFiles:DOCUMENT.queryFileAdapter.getSelectors((state) => state.queryFiles),
}