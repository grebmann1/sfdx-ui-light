import { store } from 'core/store';
import LOGGER from 'shared/logger';
import { isNotUndefinedOrNull } from 'shared/utils';

/**
 * Get the current application.
 * @returns {string|null} The current application name or null.
 */
export function getCurrentApplication() {
    const state = store.getState();
    const currentApplication = state.application?.currentApplication || null;
    return JSON.stringify({
        currentApplication,
    });
}

/**
 * Get the current user/connection information.
 * @returns {object|null} The current connector object or null.
 */
export function getCurrentConnection() {
    const state = store.getState();
    LOGGER.debug('getCurrentConnection',state.application?.connector);
    const connector = state.application?.connector || null;
    return JSON.stringify({
        connector: connector.toPublic(),
    });
}

export function checkUserLoggedIn() {
    const state = store.getState();
    const connector = state.application?.connector || null;
    return isNotUndefinedOrNull(connector);
}
