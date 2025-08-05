import { z } from 'zod';
import { executeSoqlQuery, executeSoqlQueryIncognito, fetchSoqlSavedQueries, displaySoqlTab } from '../logic/soqlLogic';
const { tool } = window.OpenAIAgentsBundle.Agents;

const soqlQuery = tool({
    name: 'soql_query',
    description: 'Execute a SOQL query in the Salesforce Toolkit.',
    parameters: z.object({
        query: z.string(),
        tabId: z.string().optional().nullable().describe('Optional tab ID to reuse when the tool is called again with the same context/request'),
    }),
    execute: async ({ query, tabId }) => {
        return await executeSoqlQuery({ query, tabId });
    },
});

const soqlQueryIncognito = tool({
    name: 'soql_query_incognito',
    description: 'Execute a SOQL query in the Salesforce Toolkit (Incognito mode). Perfect if you want to execute a query without displaying it in the UI.',
    parameters: z.object({
        query: z.string(),
        useToolingApi: z.boolean().describe('Use Tooling API').default(false),
        includeDeletedRecords: z.boolean().describe('Include deleted records').default(false),
    }),
    execute: async ({ query, useToolingApi, includeDeletedRecords }) => {
        return await executeSoqlQueryIncognito({ query, useToolingApi, includeDeletedRecords });
    },
});

const soqlSavedQueries = tool({
    name: 'soql_saved_queries',
    description: 'Fetch saved SOQL queries for the current org/alias.',
    parameters: z.object({}),
    execute: async () => {
        const alias = window.currentAlias || undefined;
        return await fetchSoqlSavedQueries({ alias });
    },
});

const soqlDisplayTab = tool({
    name: 'soql_display_tab',
    description: 'Display a SOQL tab in the Salesforce Toolkit.',
    parameters: z.object({
        tabId: z.string().describe('Tab ID to display'),
    }),
    execute: async ({ tabId }) => {
        return await displaySoqlTab({ tabId });
    },
});

export const soqlTools = [soqlQuery, soqlQueryIncognito, soqlSavedQueries, soqlDisplayTab];