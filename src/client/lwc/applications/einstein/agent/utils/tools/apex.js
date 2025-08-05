import { z } from 'zod';
import { executeAnonymousApex, fetchApexSavedScripts, editApexTab } from '../logic/apexLogic';
import { store } from 'core/store';
const { tool } = window.OpenAIAgentsBundle.Agents;

const apexExecute = tool({
    name: 'apex_execute',
    description: 'Execute anonymous Apex script from the Apex Editor (Based on a selected tab). Ask for confirmation before executing this tool.',
    parameters: z.object({
        tabId: z.string().describe('Tab ID to reuse when the tool is called again with the same context/request'),
    }),
    execute: async ({ tabId }) => {
        return await executeAnonymousApex({ tabId });
    },
});

const apexEdit = tool({
    name: 'apex_edit',
    description: `Create or edit an Apex script in the Apex Editor. \nCall this tool when you need to create or edit an Apex script.`,
    parameters: z.object({
        body: z.string().describe('The Apex code to edit or create'),
        tabId: z.string().optional().nullable().describe('Optional tab ID to reuse when the tool is called again with the same context/request'),
    }),
    execute: async ({ body, tabId }) => {
        return await editApexTab({ body, tabId });
    },
});

const apexSavedScripts = tool({
    name: 'apex_saved_scripts',
    description: 'Fetch saved Apex scripts for the current org/alias. Call this tool when you need to fetch saved Apex scripts.',
    parameters: z.object({
        alias: z.string().optional().nullable().describe('Optional org alias to fetch saved Apex scripts for'),
    }),
    execute: async ({ alias }) => {
        alias = alias || store.getState().application.connector?.conn?.alias;
        return await fetchApexSavedScripts({ alias });
    },
});

export const apexTools = [apexExecute, apexEdit, apexSavedScripts];