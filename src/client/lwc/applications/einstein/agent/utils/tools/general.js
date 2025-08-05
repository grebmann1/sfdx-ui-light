import { z } from 'zod';
import { getCurrentApplication, getCurrentConnection, checkUserLoggedIn } from '../logic/contextLogic';
const { tool } = window.OpenAIAgentsBundle.Agents;

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