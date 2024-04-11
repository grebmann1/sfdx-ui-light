import { createStore, applyMiddleware, combineReducers } from 'redux';
import thunk from 'redux-thunk';

import logger from 'shared/middleware';
import channel from './modules/channel/reducers';
import ui from './modules/ui/reducers';

let middlewares = [thunk];
// eslint-disable-next-line no-undef
if (process.env.NODE_ENV !== 'production') {
    middlewares = [...middlewares, logger];
}

export const store = createStore(
    combineReducers({
        channel,
        ui
    }),
    applyMiddleware(...middlewares)
);
