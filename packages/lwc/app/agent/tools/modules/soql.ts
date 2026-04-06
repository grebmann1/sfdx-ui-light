import { store, UI, QUERY, DOCUMENT, SELECTORS } from 'core/store';
import LOGGER from 'shared/logger';
import { z } from 'zod';

import { SOQL_TOOL_DESCRIPTIONS, TOOL_APP_NAMES } from '../constants';
import { waitForLoaded, wrappedNavigate, formatTabId } from '../utils/utils';

const { tool } = window.OpenAIAgentsBundle?.Agents || {};
// Execute a SOQL query and return the result
async function executeSoqlQuery({ query, tabId }) {
    LOGGER.log('executeSoqlQuery');
    return await store.dispatch(async (dispatch, getState) => {
        const { application, ui } = getState();
        const { tabId: realTabId, isNewTab } = formatTabId(tabId, ui.tabs);
        if (application.isLoading) await waitForLoaded();
        await wrappedNavigate({ applicationName: TOOL_APP_NAMES.soql });
        if (isNewTab) {
            await dispatch(UI.reduxSlice.actions.addTab({ tab: { id: realTabId, body: query } }));
        } else {
            await dispatch(UI.reduxSlice.actions.selectionTab({ id: realTabId }));
            await dispatch(
                UI.reduxSlice.actions.updateSoql({
                    connector: application.connector,
                    soql: query,
                    //isDraft: false,
                })
            );
        }
        LOGGER.log('ExecuteSoqlQuery - 1', query);
        const res = await dispatch(
            QUERY.executeQuery({
                connector: application.connector,
                soql: query,
                tabId: realTabId,
                useToolingApi: false,
                includeDeletedRecords: false,
            })
        );
        LOGGER.log('ExecuteSoqlQuery - 2', res);
        await dispatch(UI.reduxSlice.actions.selectionTab({ id: realTabId }));
        let _output = res.payload;
        if (res.error) {
            _output = { error: res.error };
        }
        Object.assign(_output, { tabId: realTabId });
        LOGGER.log('ExecuteSoqlQuery - 3', _output);
        return _output;
    });
}

async function executeSoqlQueryIncognito({ query, useToolingApi, includeDeletedRecords }) {
    LOGGER.log('executeSoqlQueryIncognito', query, useToolingApi, includeDeletedRecords);
    return await store.dispatch(async (dispatch, getState) => {
        const { application, ui } = getState();
        const res = await dispatch(
            QUERY.executeQueryIncognito({
                connector: application.connector,
                soql: query,
                useToolingApi,
                includeDeletedRecords,
            })
        );
        let _output = res.payload;
        if (res.error) {
            _output = { error: res.error };
        }
        LOGGER.log('ExecuteSoqlQueryIncognito - 1', _output);
        return _output;
    });
}

async function displaySoqlTab({ tabId }) {
    LOGGER.log('displaySoqlTab', tabId);
    return await store.dispatch(async (dispatch, getState) => {
        await dispatch(UI.reduxSlice.actions.selectionTab({ id: tabId }));
    });
}

// Fetch saved SOQL queries for the current alias
async function fetchSoqlSavedQueries({ alias }) {
    await store.dispatch(DOCUMENT.reduxSlices.QUERYFILE.actions.loadFromStorage({ alias }));
    const { queryFiles } = store.getState();
    const entities = SELECTORS.queryFiles.selectAll({ queryFiles });
    return entities.filter(item => item.isGlobal || item.alias === alias);
}

const soqlQuery = tool({
    name: 'soql_query',
    description: SOQL_TOOL_DESCRIPTIONS.query,
    parameters: z.object({
        query: z.string(),
        tabId: z
            .string()
            .optional()
            .nullable()
            .describe(SOQL_TOOL_DESCRIPTIONS.queryTabId),
    }),
    execute: async ({ query, tabId }) => {
        return await executeSoqlQuery({ query, tabId });
    },
});

const soqlQueryIncognito = tool({
    name: 'soql_query_incognito',
    description: SOQL_TOOL_DESCRIPTIONS.queryIncognito,
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
    description: SOQL_TOOL_DESCRIPTIONS.savedQueries,
    parameters: z.object({}),
    execute: async () => {
        const alias = window.currentAlias || undefined;
        return await fetchSoqlSavedQueries({ alias });
    },
});

const soqlDisplayTab = tool({
    name: 'soql_display_tab',
    description: SOQL_TOOL_DESCRIPTIONS.displayTab,
    parameters: z.object({
        tabId: z.string().describe('Tab ID to display'),
    }),
    execute: async ({ tabId }) => {
        return await displaySoqlTab({ tabId });
    },
});

export const soqlTools = [soqlQuery, soqlQueryIncognito, soqlSavedQueries, soqlDisplayTab];
