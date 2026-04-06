import { store, API, DOCUMENT, SELECTORS } from 'core/store';
import { z } from 'zod';

import { API_TOOL_DESCRIPTIONS, TOOL_APP_NAMES } from '../constants';
import { waitForLoaded, wrappedNavigate, formatTabId } from '../utils/utils';

const { tool } = window.OpenAIAgentsBundle?.Agents || {};

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
        await store.dispatch(
            API.reduxSlice.actions.updateRequest({
                ...tab,
                tabId: tab.id,
            })
        );
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
    await store.dispatch(
        API.reduxSlice.actions.updateRequest({
            body,
            tabId,
        })
    );
    return { success: true };
}
async function updateHeader({ tabId, header }) {
    await store.dispatch(
        API.reduxSlice.actions.updateRequest({
            header,
            tabId,
        })
    );
    return { success: true };
}
async function updateVariable({ variables }) {
    await store.dispatch(API.reduxSlice.actions.updateVariables({ variables }));
    return { success: true };
}
async function updateEndpoint({ tabId, endpoint }) {
    await store.dispatch(
        API.reduxSlice.actions.updateRequest({
            endpoint,
            tabId,
        })
    );
    return { success: true };
}
async function updateMethod({ tabId, method }) {
    await store.dispatch(
        API.reduxSlice.actions.updateRequest({
            method,
            tabId,
        })
    );
    return { success: true };
}

// --- Agent Tool Objects ---
const apiAgentTools = [
    tool({
        name: 'getTabs',
        description: API_TOOL_DESCRIPTIONS.getTabs,
        parameters: z.object({}),
        execute: getTabs,
    }),
    tool({
        name: 'selectTab',
        description: API_TOOL_DESCRIPTIONS.selectTab,
        parameters: z.object({ tabId: z.string().describe('Tab ID to select') }),
        execute: selectTab,
    }),
    tool({
        name: 'upsertTab',
        description: API_TOOL_DESCRIPTIONS.upsertTab,
        parameters: z.object({
            tab: z
                .object({
                    id: z.string(),
                    body: z.string().optional().nullable(),
                    header: z.string().optional().nullable(),
                    method: z.string().optional().nullable(),
                    endpoint: z.string().optional().nullable(),
                })
                .describe('Tab object to upsert'),
        }),
        execute: upsertTab,
    }),
    tool({
        name: 'getRecentApiCalls',
        description: API_TOOL_DESCRIPTIONS.recentCalls,
        parameters: z.object({}),
        execute: getRecentApiCalls,
    }),
    tool({
        name: 'getSavedApiScripts',
        description: API_TOOL_DESCRIPTIONS.savedScripts,
        parameters: z.object({}),
        execute: getSavedApiScripts,
    }),
    tool({
        name: 'getOpenAPISavedScripts',
        description: API_TOOL_DESCRIPTIONS.openApiSavedScripts,
        parameters: z.object({}),
        execute: getOpenAPISavedScripts,
    }),
    tool({
        name: 'getOpenAPIMethodForScript',
        description: API_TOOL_DESCRIPTIONS.openApiMethodForScript,
        parameters: z.object({
            scriptId: z.string().describe('OpenAPI schema file ID'),
            method: z.string().describe('HTTP method (GET, POST, etc.)'),
        }),
        execute: getOpenAPIMethodForScript,
    }),
    tool({
        name: 'updateBody',
        description: API_TOOL_DESCRIPTIONS.updateBody,
        parameters: z.object({
            tabId: z.string().describe('Tab ID'),
            body: z.string().describe('Request body'),
        }),
        execute: updateBody,
    }),
    tool({
        name: 'updateHeader',
        description: API_TOOL_DESCRIPTIONS.updateHeader,
        parameters: z.object({
            tabId: z.string().describe('Tab ID'),
            header: z.string().describe('Request header'),
        }),
        execute: updateHeader,
    }),
    tool({
        name: 'updateVariable',
        description: API_TOOL_DESCRIPTIONS.updateVariable,
        parameters: z.object({ variables: z.string().describe('Variables as JSON string') }),
        execute: updateVariable,
    }),
    tool({
        name: 'updateEndpoint',
        description: API_TOOL_DESCRIPTIONS.updateEndpoint,
        parameters: z.object({
            tabId: z.string().describe('Tab ID'),
            endpoint: z.string().describe('API endpoint'),
        }),
        execute: updateEndpoint,
    }),
    tool({
        name: 'updateMethod',
        description: API_TOOL_DESCRIPTIONS.updateMethod,
        parameters: z.object({
            tabId: z.string().describe('Tab ID'),
            method: z.string().describe('HTTP method'),
        }),
        execute: updateMethod,
    }),
    // --- New Tools ---
    tool({
        name: 'navigateToApiEditor',
        description: API_TOOL_DESCRIPTIONS.navigateToEditor,
        parameters: z.object({}),
        async execute() {
            const { application } = store.getState();
            if (application.isLoading) await waitForLoaded();
            await wrappedNavigate({ applicationName: TOOL_APP_NAMES.api });
            return { success: true };
        },
    }),
    tool({
        name: 'getApplicationContext',
        description: API_TOOL_DESCRIPTIONS.applicationContext,
        parameters: z.object({}),
        async execute() {
            const state = store.getState();
            const apiState = state.api || {};
            return {
                editor: TOOL_APP_NAMES.api,
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
