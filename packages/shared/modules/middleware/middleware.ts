import type { Middleware } from '@reduxjs/toolkit';

const loggerMiddleware: Middleware = store => next => (action: any) => {
    console.group(action.type);
    console.info('dispatching', action);

    let result = next(action);

    //console.log('next state', store.getState());
    console.groupEnd();

    return result;
};

export default loggerMiddleware;
