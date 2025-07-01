import { configureStore } from '@reduxjs/toolkit';
import { APEX } from 'anonymousApex/store';
import { API } from 'api/store';
import { EINSTEIN } from 'assistant/store';
import { METADATA } from 'metadata/store';
import { PACKAGE } from 'package/store';
import { EVENT } from 'platformevent/store';
import { RECORDVIEWER } from 'recordviewer/store';
import logger from 'shared/middleware';
import { UI, QUERY } from 'soql/store';
import { createSlice } from '@reduxjs/toolkit';

import * as APPLICATION from './application';
import * as DESCRIBE from './describe';
import * as DOCUMENT from './document';
import * as SOBJECT from './sobject';
import * as ERROR from './errors';


const store = configureStore({
    reducer: {
        application: APPLICATION.reduxSlice.reducer,
        sobject: SOBJECT.reduxSlice.reducer,
        describe: DESCRIBE.reduxSlice.reducer,
        ui: UI.reduxSlice.reducer,
        query: QUERY.reduxSlice.reducer,
        apex: APEX.reduxSlice.reducer,
        recordViewer: RECORDVIEWER.reduxSlice.reducer,
        metadata: METADATA.reduxSlice.reducer,
        package2: PACKAGE.reduxSlice.reducer,
        platformEvent: EVENT.reduxSlice.reducer,
        api: API.reduxSlice.reducer,
        einstein: EINSTEIN.reduxSlice.reducer,
        queryFiles: DOCUMENT.reduxSlices.QUERYFILE.reducer,
        apexFiles: DOCUMENT.reduxSlices.APEXFILE.reducer,
        apiFiles: DOCUMENT.reduxSlices.APIFILE.reducer,
        recents: DOCUMENT.reduxSlices.RECENT.reducer,
        errors: ERROR.reduxSlice.reducer,
    },
    middleware: getDefaultMiddleware => {
        let middlewares = getDefaultMiddleware({
            serializableCheck: {
                // Ignore these action types
                ignoredActions: [
                    'application/updateConnector',
                    'application/login',
                    'einstein/executeModel',
                    'einstein/executeModel/rejected',
                    'einstein/executeModel/fulfilled',
                    'einstein/executeModel/pending',
                    'application/updateCurrentApplication',
                    'platformEvent/updateReadStatusOnSpecificMessage',
                    'describe/describeVersion',
                    'describe/describeSObjects/fulfilled',
                    'describe/describeSObjects/pending',
                    'describe/describeSObjects/rejected',
                    'metadata/fetchSpecificMetadata/fulfilled',
                    'metadata/fetchSpecificMetadata/pending',
                    'metadata/fetchSpecificMetadata/rejected',
                    'metadata/fetchGlobalMetadata/fulfilled',
                    'metadata/fetchGlobalMetadata/pending',
                    'metadata/fetchGlobalMetadata/rejected',
                    'metadata/setAttributes',
                ],
                // Ignore these field paths in all actions
                ignoredActionPaths: ['meta.arg', 'payload.Connector', 'payload.connector'],
                // Ignore these paths in the state
                ignoredPaths: [
                    'application.connector',
                    'package2.currentRetrieveJob.createdDate',
                    'payload.connector',
                    'metadata.metadata_global',
                ],
            },
        });
        if (process.env.NODE_ENV !== 'production') {
            middlewares = [...middlewares, logger];
        }
        return middlewares;
    },
    devTools: process.env.NODE_ENV !== 'production',
});

export {
    store,
    UI,
    QUERY,
    APEX,
    RECORDVIEWER,
    METADATA,
    PACKAGE,
    EVENT,
    API,
    DOCUMENT,
    APPLICATION,
    SOBJECT,
    DESCRIBE,
    EINSTEIN,
    ERROR,
};
export { connectStore } from './wire-adapter';

export const SELECTORS = {
    sobject: SOBJECT.sObjectsAdapter.getSelectors(state => state.sobject),
    describe: state => state.describe,
    queries: QUERY.queryAdapter.getSelectors(state => state.query),
    platformEvents: EVENT.platformEventAdapter.getSelectors(
        state => state.platformEvent.subscriptions
    ),
    apex: APEX.apexAdapter.getSelectors(state => state.apex.apex), // Not using the standard -> So it's Apex (Slice) then Apex variable
    api: API.apiAdapter.getSelectors(state => state.api.api), // Not using the standard -> So it's Apex (Slice) then Apex variable
    einstein: EINSTEIN.einsteinModelAdapter.getSelectors(state => state.einstein.dialog),
    queryFiles: DOCUMENT.queryFileAdapter.getSelectors(state => state.queryFiles),
    apexFiles: DOCUMENT.apexFileAdapter.getSelectors(state => state.apexFiles),
    apiFiles: DOCUMENT.apiFileAdapter.getSelectors(state => state.apiFiles),
    //errors: ERROR.errorAdapter.getSelectors(state => state.errors),
};