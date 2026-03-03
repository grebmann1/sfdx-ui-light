import { configureStore } from '@reduxjs/toolkit';
import logger from 'shared/middleware';

import application from './modules/application/reducers';

export const store = configureStore({
    reducer: {
        application,
    },
    middleware: getDefaultMiddleware => {
        const middlewares = getDefaultMiddleware();
        // eslint-disable-next-line no-undef
        if (process.env.NODE_ENV !== 'production') {
            return [...middlewares, logger];
        }
        return middlewares;
    },
    // eslint-disable-next-line no-undef
    devTools: process.env.NODE_ENV !== 'production',
});
