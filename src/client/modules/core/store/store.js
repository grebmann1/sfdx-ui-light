import { configureStore } from '@reduxjs/toolkit'
import logger from 'shared/middleware';
import * as SOBJECT from './sobject';
import * as DESCRIBE from './describe';
import * as DOCUMENT from './document';
import * as APPLICATION from './application';
import { UI,QUERY } from 'soql/store';
import { APEX } from 'anonymousApex/store';
import { API } from 'api/store';
import { EVENT } from 'platformevent/store';
import { EINSTEIN } from 'assistant/store';

const store = configureStore({
    reducer: {
        application:APPLICATION.reduxSlice.reducer,
        sobject: SOBJECT.reduxSlice.reducer,
        describe: DESCRIBE.reduxSlice.reducer,
        ui : UI.reduxSlice.reducer,
        query : QUERY.reduxSlice.reducer,
        apex : APEX.reduxSlice.reducer,
        platformEvent : EVENT.reduxSlice.reducer,
        api : API.reduxSlice.reducer,
        einstein: EINSTEIN.reduxSlice.reducer,
        queryFiles : DOCUMENT.reduxSlices.QUERYFILE.reducer,
        apexFiles : DOCUMENT.reduxSlices.APEXFILE.reducer,
        recents : DOCUMENT.reduxSlices.RECENT.reducer
    },
    middleware: (getDefaultMiddleware) => {
        let middlewares = getDefaultMiddleware({
            serializableCheck: {
                // Ignore these action types
                ignoredActions: [
                    'application/updateConnector',
                    'application/login',
                    'einstein/executeModel',
                    'einstein/executeModel/rejected',
                    'einstein/executeModel/fulfilled',
                    'einstein/executeModel/pending'
                ],
                // Ignore these field paths in all actions
                ignoredActionPaths: ['payload.Connector',''],
                // Ignore these paths in the state
                ignoredPaths: ['application.connector'],
              },
        });
        if (process.env.NODE_ENV !== 'production') {
            middlewares = [...middlewares,logger];
        };
        return middlewares;
    },
    devTools: process.env.NODE_ENV !== 'production',
});

export { 
    store,
    UI,
    QUERY,
    APEX,
    EVENT,
    API,
    DOCUMENT,
    APPLICATION,
    SOBJECT,
    DESCRIBE,
    EINSTEIN
};
export { connectStore } from './wire-adapter';

export const SELECTORS = {
    sobject:SOBJECT.sObjectsAdapter.getSelectors((state) => state.sobject),
    describe:(state) => state.describe,
    queries:QUERY.queryAdapter.getSelectors((state) => state.query),
    platformEvents:EVENT.platformEventAdapter.getSelectors((state) => state.platformEvent.subscriptions),
    apex:APEX.apexAdapter.getSelectors((state) => state.apex.apex), // Not using the standard -> So it's Apex (Slice) then Apex variable
    einstein:EINSTEIN.einsteinModelAdapter.getSelectors((state) => state.einstein.dialog),
    queryFiles:DOCUMENT.queryFileAdapter.getSelectors((state) => state.queryFiles),
    apexFiles:DOCUMENT.apexFileAdapter.getSelectors((state) => state.apexFiles),
}