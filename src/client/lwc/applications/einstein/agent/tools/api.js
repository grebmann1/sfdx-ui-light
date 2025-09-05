import { z } from 'zod';
import { store, API, DOCUMENT, SELECTORS } from 'core/store';
import { generateDefaultTab } from 'api/utils';
import LOGGER from 'shared/logger';
import { waitForLoaded, wrappedNavigate, formatTabId } from './utils/utils.js';

const { tool } = window.OpenAIAgentsBundle.Agents;

// --- Internal Async Functions ---
async function getTabs() {
    const { api } = store.getState();
    return api.tabs;
}
async function selectTab({ tabId }) {
    await store.dispatch(API.reduxSlice.actions.selectionTab({ id: tabId }));
    return { success: true, tabId };
}
async function upsertTab({ tab }) {
    const { api } = store.getState();
    const existing = api.tabs.find(t => t.id === tab.id);
    if (existing) {
        await store.dispatch(API.reduxSlice.actions.updateRequest({
            ...tab,
            tabId: tab.id,
        }));
    } else {
        await store.dispatch(API.reduxSlice.actions.addTab({ tab }));
    }
    return { success: true, tab };
}
async function getRecentApiCalls() {
    const { recents } = store.getState();
    return recents.api || [];
}
async function getSavedApiScripts() {
    const { apiFiles } = store.getState();
    const entities = SELECTORS.apiFiles.selectAll({ apiFiles });
    return entities.filter(item => item.isGlobal || item.alias);
}
async function getOpenAPISavedScripts() {
    const { openapiSchemaFiles } = store.getState();
    return SELECTORS.openapiSchemaFiles.selectAll({ openapiSchemaFiles });
}
async function getOpenAPIMethodForScript({ scriptId, method }) {
    const { openapiSchemaFiles } = store.getState();
    const schemas = SELECTORS.openapiSchemaFiles.selectAll({ openapiSchemaFiles });
    const schema = schemas.find(s => s.id === scriptId);
    if (!schema) return null;
    const pathEntries = Object.entries(schema.content.paths || {});
    for (const [path, methods] of pathEntries) {
        if (methods[method.toLowerCase()]) {
            return { path, method: method.toUpperCase(), operation: methods[method.toLowerCase()] };
        }
    }
    return null;
}
async function updateBody({ tabId, body }) {
    await store.dispatch(API.reduxSlice.actions.updateRequest({
        body,
        tabId,
    }));
    return { success: true };
}
async function updateHeader({ tabId, header }) {
    await store.dispatch(API.reduxSlice.actions.updateRequest({
        header,
        tabId,
    }));
    return { success: true };
}
async function updateVariable({ variables }) {
    await store.dispatch(API.reduxSlice.actions.updateVariables({ variables }));
    return { success: true };
}
async function updateEndpoint({ tabId, endpoint }) {
    await store.dispatch(API.reduxSlice.actions.updateRequest({
        endpoint,
        tabId,
    }));
    return { success: true };
}
async function updateMethod({ tabId, method }) {
    await store.dispatch(API.reduxSlice.actions.updateRequest({
        method,
        tabId,
    }));
    return { success: true };
}

// --- Agent Tool Objects ---
const apiAgentTools = [
    tool({
        name: 'getTabs',
        description: `Get all API tabs currently open in the API editor. 
        Returns an array of tab objects representing the current open API tabs. 
        Use this to list or inspect all open tabs.`,
        parameters: z.object({}),
        execute: getTabs,
    }),
    tool({
        name: 'selectTab',
        description: `Select a tab by its ID in the API editor. 
        The tabId must correspond to an existing tab. 
        If the tabId does not exist, the selection will fail.`,
        parameters: z.object({ tabId: z.string().describe('Tab ID to select') }),
        execute: selectTab,
    }),
    tool({
        name: 'upsertTab',
        description: `Add or update a tab in the API editor. 
        If the tab.id matches an existing tab, that tab will be updated. 
        If the tab.id is new, a new tab will be created. 
        When creating a new tab, ensure the id is unique and not reused from an existing tab. 
        Reusing an existing tab id for a new tab is not allowed and will result in updating the existing tab instead.`,
        parameters: z.object({ tab: z.object({ id: z.string(), body: z.string().optional().nullable(), header: z.string().optional().nullable(), method: z.string().optional().nullable(), endpoint: z.string().optional().nullable() }).describe('Tab object to upsert') }),
        execute: upsertTab,
    }),
    tool({
        name: 'getRecentApiCalls',
        description: `Get the list of recent API calls. 
        Returns an array of recent API call objects, ordered from most recent to least recent.`,
        parameters: z.object({}),
        execute: getRecentApiCalls,
    }),
    tool({
        name: 'getSavedApiScripts',
        description: `Get the list of saved API scripts. 
        Only scripts that are global or associated with an alias are returned. 
        Use this to retrieve reusable API scripts.`,
        parameters: z.object({}),
        execute: getSavedApiScripts,
    }),
    tool({
        name: 'getOpenAPISavedScripts',
        description: `Get the list of saved OpenAPI schema files. 
        Returns all OpenAPI schema files currently available in the editor.`,
        parameters: z.object({}),
        execute: getOpenAPISavedScripts,
    }),
    tool({
        name: 'getOpenAPIMethodForScript',
        description: `Get the OpenAPI method definition for a specific script and HTTP method. 
        Provide a valid scriptId and HTTP method (GET, POST, etc.). 
        Returns the path, method, and operation details if found, otherwise returns null.`,
        parameters: z.object({ scriptId: z.string().describe('OpenAPI schema file ID'), method: z.string().describe('HTTP method (GET, POST, etc.)') }),
        execute: getOpenAPIMethodForScript,
    }),
    tool({
        name: 'updateBody',
        description: `Update the body for a specific tab. 
        The tabId must correspond to an existing tab. 
        The body should be a string representing the request payload.`,
        parameters: z.object({ tabId: z.string().describe('Tab ID'), body: z.string().describe('Request body') }),
        execute: updateBody,
    }),
    tool({
        name: 'updateHeader',
        description: `Update the header for a specific tab. 
        The tabId must correspond to an existing tab. 
        The header should be a string representing the request headers.`,
        parameters: z.object({ tabId: z.string().describe('Tab ID'), header: z.string().describe('Request header') }),
        execute: updateHeader,
    }),
    tool({
        name: 'updateVariable',
        description: `Update the global variables for the API editor. 
        Variables should be provided as a JSON string. 
        This will overwrite all existing variables.`,
        parameters: z.object({ variables: z.string().describe('Variables as JSON string') }),
        execute: updateVariable,
    }),
    tool({
        name: 'updateEndpoint',
        description: `Update the endpoint for a specific tab. 
        The tabId must correspond to an existing tab. 
        The endpoint should be a valid API endpoint string.`,
        parameters: z.object({ tabId: z.string().describe('Tab ID'), endpoint: z.string().describe('API endpoint') }),
        execute: updateEndpoint,
    }),
    tool({
        name: 'updateMethod',
        description: `Update the HTTP method for a specific tab. 
        The tabId must correspond to an existing tab. 
        The method should be a valid HTTP method string (e.g., GET, POST, PUT, DELETE).`,
        parameters: z.object({ tabId: z.string().describe('Tab ID'), method: z.string().describe('HTTP method') }),
        execute: updateMethod,
    }),
    // --- New Tools ---
    tool({
        name: 'navigateToApiEditor',
        description: `Navigate the user interface to the API editor. 
        Use this to programmatically switch the application view to the API editor. 
        No parameters are required. Returns { success: true } if navigation is triggered.`,
        parameters: z.object({}),
        async execute() {
            const { application } = getState();
            if (application.isLoading) await waitForLoaded();
            await wrappedNavigate({ applicationName: 'api' });
            return { success: true };
        },
    }),
    tool({
        name: 'getApplicationContext',
        description: `Get the current application context for the API editor. 
        Returns information about the current editor state. 
        No parameters are required.`,
        parameters: z.object({}),
        async execute() {
            const state = store.getState();
            const apiState = state.api || {};
            return {
                editor: 'api',
                currentTab: apiState.currentTab || null,
                tabs: apiState.tabs || [],
                currentBody: apiState.body || null,
                currentMethod: apiState.method || null,
                currentEndpoint: apiState.endpoint || null,
                currentHeader: apiState.header || null,
                globalVariables: apiState.variables || null,
            };
        },
    }),
];

export { apiAgentTools };