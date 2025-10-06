import { configureStore } from '@reduxjs/toolkit';
import * as APPLICATION from './modules/application';
import * as ERROR from './modules/error';

import logger from 'shared/middleware';

const store = configureStore({
    reducer: {
        application: APPLICATION.reduxSlice.reducer,
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
    ERROR,
    APPLICATION
};
export { connectStore } from './wire-adapter';

export const SELECTORS = {};