import { createStore, applyMiddleware, combineReducers } from 'redux';
import thunk from 'redux-thunk';

import logger from 'shared/middleware';
import application from './modules/application/reducers';

let middlewares = [thunk];
// eslint-disable-next-line no-undef
if (process.env.NODE_ENV !== 'production') {
    middlewares = [...middlewares, logger];
}

export const store = createStore(
    combineReducers({
        application,
    }),
    applyMiddleware(...middlewares)
);
