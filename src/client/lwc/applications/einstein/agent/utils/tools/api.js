import { z } from 'zod';
import { executeApiRequest, editApiScript, fetchApiSavedScripts } from '../logic/apiLogic';
import { store } from 'core/store';

const { tool } = window.OpenAIAgentsBundle.Agents;

const apiExecute = tool({
    name: 'api_execute',
    description: 'Execute API script from the API Editor (Based on a selected tab). Ask for confirmation before executing this tool.',
    parameters: z.object({
        tabId: z.string().describe('Tab ID to reuse when the tool is called again with the same context/request'),
    }),
    execute: async ({ tabId }) => {
        return await executeApiRequest({ tabId });
    },
});

const apiEdit = tool({
    name: 'api_edit',
    description: 'Edit/Create an API script in the Salesforce Toolkit. Call this tool when you need to display the API script in the API Editor.',
    parameters: z.object({
        method: z.string().describe('HTTP method (GET, POST, etc.)'),
        endpoint: z.string().describe('API endpoint'),
        body: z.string().optional().nullable().describe('Request body'),
        headers: z.record(z.string()).optional().nullable().describe('Request headers'),
        tabId: z.string().optional().nullable().describe('Optional tab ID to reuse when the tool is called again with the same context/request'),
        currentApiVersion: z.string().optional().nullable().describe('Optional API version to use in format : 60.0'),
    }),
    execute: async ({ method, endpoint, body, headers, tabId, currentApiVersion }) => {
        return await editApiScript({ method, endpoint, body, headers, tabId, currentApiVersion });
    },
});

const apiSavedScripts = tool({
    name: 'api_saved_scripts',
    description: 'Fetch saved API scripts for the current org/alias.',
    parameters: z.object({
        alias: z.string().optional().nullable().describe('Optional org alias to fetch saved API scripts for'),
    }),
    execute: async ({ alias }) => {
        alias = alias || store.getState().application.connector?.conn?.alias;
        return await fetchApiSavedScripts({ alias });
    },
});

export const apiTools = [apiEdit, apiExecute, apiSavedScripts];