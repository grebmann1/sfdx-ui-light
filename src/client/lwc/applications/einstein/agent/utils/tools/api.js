import { z } from 'zod';
import { store, API, UI, DOCUMENT, SELECTORS } from 'core/store';
import { formatApiRequest, generateDefaultTab, DEFAULT as API_DEFAULT } from 'api/utils';
import { formatTabId, waitForLoaded, wrappedNavigate } from './utils';
import LOGGER from 'shared/logger';

const { tool } = window.OpenAIAgentsBundle.Agents;

async function navigateToApi() {
    return await store.dispatch(async (dispatch, getState) => {
        const { application } = getState();
        if (application.isLoading) await waitForLoaded();
        await wrappedNavigate({ applicationName: 'api' });
        return { success: true };
    });
}

async function openApiTab({ tabId }) {
    return await store.dispatch(async (dispatch, getState) => {
        const { application } = getState();
        if (application.isLoading) await waitForLoaded();
        await wrappedNavigate({ applicationName: 'api' });
        // We are setting the current tab to the one we want to execute
        await dispatch(API.reduxSlice.actions.selectionTab({ id: tabId }));
        return { success: true, tabId };
    });
}

// Execute an API request and return the result
async function executeApiRequest({ tabId }) {
    return await store.dispatch(async (dispatch, getState) => {
        const { application } = getState();
        if (application.isLoading) await waitForLoaded();
        await wrappedNavigate({ applicationName: 'api' });
        await dispatch(API.reduxSlice.actions.selectionTab({ id: tabId }));
        const currentTab = getState().api.currentTab;
        LOGGER.log('currentTab',currentTab);
        const { request, error } = formatApiRequest({
            endpoint: currentTab.endpoint,
            method: currentTab.method,
            body: currentTab.body,
            header: currentTab.header,
            connector:application.connector,
        });
        const apiPromise = store.dispatch(
            API.executeApiRequest({
                connector:application.connector,
                request: {
                    endpoint: request.endpoint,
                    method: request.method,
                    body: request.body,
                    header: request.header,
                },
                formattedRequest: request,
                tabId: tabId,
                createdDate: Date.now(),
            })
        );
        store.dispatch(
            API.reduxSlice.actions.setAbortingPromise({
                tabId,
                promise: apiPromise,
            })
        );
        const res = await apiPromise;
        await dispatch(UI.reduxSlice.actions.selectionTab({ id: tabId }));
        let _output = { ...res.payload?.response || {}, tabId };
        if (res.error) {
            _output.error = res.error;
        }
        return _output;
    });
}

async function editApiScript({ method, endpoint, body, headers, tabId, currentApiVersion }) {
    return await store.dispatch(async (dispatch, getState) => {
        try {
            LOGGER.log('editApiScript',{ method, endpoint, body, headers, tabId, currentApiVersion });
            const { application, api } = getState();
            const { tabId: realTabId, isNewTab } = formatTabId(tabId,api.tabs);
            if (application.isLoading) await waitForLoaded();
            await wrappedNavigate({ applicationName: 'api' });
            const headerString = headers ? Object.keys(headers).map(key => `${key}: ${headers[key]}`).join('\n') : API_DEFAULT.HEADER;
            const { request, error } = formatApiRequest({
                endpoint,
                method,
                body,
                header: headerString,
                connector:application.connector,
            });
            LOGGER.log('request',request);
            if (isNewTab) {
                const tab = generateDefaultTab(currentApiVersion, realTabId);
                tab.body = request.body;
                tab.header = headerString;
                tab.method = request.method;
                tab.endpoint = request.endpoint;
                tab.fileId = null;
                await dispatch(API.reduxSlice.actions.addTab({ tab }));
            } else {
                await dispatch(API.reduxSlice.actions.selectionTab({ id: realTabId }));
                await dispatch(API.reduxSlice.actions.updateRequest({
                    header: headerString,
                    method: request.method,
                    endpoint: request.endpoint,
                    body: request.body,
                    tabId: realTabId,
                }));
            }
            LOGGER.log('tabId',realTabId);
            return { tabId: realTabId };
        } catch (error) {
            LOGGER.error('editApiScript',error);
            return { error: error.message };
        }
    });
}

// Save an API script globally or for a specific org
async function saveApiScript({ method, endpoint, body, headers, name, isGlobal, alias }) {
    return await store.dispatch(async (dispatch, getState) => {
        const { application } = getState();
        if (application.isLoading) await waitForLoaded();
        await wrappedNavigate({ applicationName: 'api' });
        // Compose the script object
        const script = {
            id: Date.now().toString(),
            name,
            method,
            endpoint,
            body,
            headers,
            isGlobal: !!isGlobal,
            alias: isGlobal ? null : (alias || store.getState().application.connector?.conn?.alias),
            createdDate: Date.now(),
        };
        // Save using the DOCUMENT slice for APIFILE
        await dispatch(DOCUMENT.reduxSlices.APIFILE.actions.saveScript({ script }));
        return { success: true, script };
    });
}

// Fetch saved API scripts for the current alias
async function fetchApiSavedScripts({ alias }) {
    LOGGER.log('fetchApiSavedScripts',alias);
    await store.dispatch(DOCUMENT.reduxSlices.APIFILE.actions.loadFromStorage({ alias }));
    const { apiFiles } = store.getState();
    const entities = SELECTORS.apiFiles.selectAll({ apiFiles });
    return entities.filter(item => item.isGlobal || item.alias === alias);
}

const apiNavigate = tool({
    name: 'api_navigate',
    description: 'Navigate to the API Editor application.',
    parameters: z.object({}),
    execute: async () => {
        return await navigateToApi();
    },
});

const apiOpenTab = tool({
    name: 'api_open_tab',
    description: 'Open a specific API tab in the API Editor.',
    parameters: z.object({
        tabId: z.string().describe('The ID of the API tab to open'),
    }),
    execute: async ({ tabId }) => {
        return await openApiTab({ tabId });
    },
});

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
    description: '[Incognito] Fetch saved API scripts for the current org/alias.',
    parameters: z.object({
        alias: z.string().optional().nullable().describe('Optional org alias to fetch saved API scripts for'),
    }),
    execute: async ({ alias }) => {
        alias = alias || store.getState().application.connector?.conn?.alias;
        return await fetchApiSavedScripts({ alias });
    },
});

const apiSaveScript = tool({
    name: 'api_save_script',
    description: 'Save an API script as a reusable asset, either globally or for a specific org.',
    parameters: z.object({
        method: z.string().describe('HTTP method (GET, POST, etc.)'),
        endpoint: z.string().describe('API endpoint'),
        body: z.string().optional().nullable().describe('Request body'),
        headers: z.record(z.string()).optional().nullable().describe('Request headers'),
        name: z.string().describe('The name for the script'),
        isGlobal: z.boolean().describe('Whether to save globally or for the current org'),
        alias: z.string().optional().nullable().describe('Org alias if not global'),
    }),
    execute: async ({ method, endpoint, body, headers, name, isGlobal, alias }) => {
        return await saveApiScript({ method, endpoint, body, headers, name, isGlobal, alias });
    },
});

export const apiTools = [apiNavigate, apiOpenTab, apiEdit, apiExecute, apiSavedScripts, apiSaveScript];