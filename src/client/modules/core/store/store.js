import { configureStore } from '@reduxjs/toolkit'
import logger from 'shared/middleware';
import * as SOBJECT from './sobject';
import * as DESCRIBE from './describe';
import {UI,QUERY} from 'soql/store';
console.log('QUERY',UI,QUERY);
const store = configureStore({
    reducer: {
        sobject: SOBJECT.reduxSlice.reducer,
        describe: DESCRIBE.reduxSlice.reducer,
        ui : UI.reduxSlice.reducer,
        query : QUERY.reduxSlice.reducer
    },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(logger),
    devTools: process.env.NODE_ENV !== 'production',
});

export { 
    store,
    UI,
    QUERY
};
export { connectStore } from './wire-adapter';
export * as SOBJECT from './sobject';
export * as DESCRIBE from './describe';

export const SELECTORS = {
    sobject:SOBJECT.sObjectsAdapter.getSelectors((state) => state.sobject),
    describe:DESCRIBE.describeAdapter.getSelectors((state) => state.describe)
}