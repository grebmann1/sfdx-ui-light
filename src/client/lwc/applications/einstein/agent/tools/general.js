import { z } from 'zod';
import { store } from 'core/store';
import LOGGER from 'shared/logger';
import { isNotUndefinedOrNull } from 'shared/utils';
const { tool } = window.OpenAIAgentsBundle.Agents;

/**
 * Get the current application.
 * @returns {string|null} The current application name or null.
 */
function getCurrentApplication() {
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
function getCurrentConnection() {
    const state = store.getState();
    LOGGER.debug('getCurrentConnection',state.application?.connector);
    const connector = state.application?.connector || null;
    return JSON.stringify({
        connector: connector.toPublic(),
    });
}

function checkUserLoggedIn() {
    const state = store.getState();
    const connector = state.application?.connector || null;
    return isNotUndefinedOrNull(connector);
}

const getCurrentApp = tool({
    name: 'get_current_application',
    description: 'Get the current application name in the toolkit.',
    parameters: z.object({}),
    execute: async () => {
        return getCurrentApplication();
    },
});

const getCurrentUserConnection = tool({
    name: 'get_current_connection',
    description: 'Get the current user/connection information.',
    parameters: z.object({}),
    execute: async () => {
        return getCurrentConnection();
    },
});

const checkUserLoggedInTool = tool({
    name: 'check_user_logged_in',
    description: 'Check if the user is logged in.',
    parameters: z.object({}),
    execute: async () => {
        return {
            isLoggedIn: checkUserLoggedIn(),
        };
    },
});

export const generalTools = [getCurrentApp, getCurrentUserConnection, checkUserLoggedInTool];