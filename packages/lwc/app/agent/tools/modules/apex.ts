import { store, APEX, DOCUMENT, SELECTORS, ERROR } from 'core/store';
import LOGGER from 'shared/logger';
import { z } from 'zod';

import { APEX_TOOL_DESCRIPTIONS, TOOL_APP_NAMES } from '../constants';
import { waitForLoaded, wrappedNavigate, formatTabId } from '../utils/utils';

const { tool } = window.OpenAIAgentsBundle?.Agents || {};
// Execute anonymous Apex and return the result
async function navigateToApex() {
    return await store.dispatch(async (dispatch, getState) => {
        const { application } = getState();
        if (application.isLoading) await waitForLoaded();
        await wrappedNavigate({ applicationName: TOOL_APP_NAMES.apex });
        return { success: true };
    });
}

async function openApexTab({ tabId }) {
    return await store.dispatch(async (dispatch, getState) => {
        const { application } = getState();
        if (application.isLoading) await waitForLoaded();
        await wrappedNavigate({ applicationName: TOOL_APP_NAMES.apex });
        // We are setting the current tab to the one we want to execute
        await dispatch(APEX.reduxSlice.actions.selectionTab({ id: tabId }));
        return { success: true, tabId };
    });
}

async function executeAnonymousApex({ tabId }) {
    return store
        .dispatch(async (dispatch, getState) => {
            const { application } = getState();
            if (application.isLoading) await waitForLoaded();
            await wrappedNavigate({ applicationName: TOOL_APP_NAMES.apex });
            // We are setting the current tab to the one we want to execute
            await dispatch(APEX.reduxSlice.actions.selectionTab({ id: tabId }));
            // fetch the body from the current tab
            const body = getState().apex?.currentTab?.body;
            const apexPromise = store.dispatch(
                APEX.executeApexAnonymous({
                    connector: application.connector,
                    body,
                    tabId,
                    createdDate: Date.now(),
                })
            );
            store.dispatch(
                APEX.reduxSlice.actions.setAbortingPromise({
                    tabId,
                    promise: apexPromise,
                })
            );
            const res = await apexPromise;
            await dispatch(APEX.reduxSlice.actions.selectionTab({ id: tabId }));
            let _output = { ...(res.payload?.response || {}), tabId };
            if (res.error) {
                _output.error = res.error;
            }
            return _output;
        })
        .then(data => {
            LOGGER.log('executeAnonymousApex script 2', data);
            return { success: true, output: data };
        })
        .catch(err => {
            store.dispatch(
                ERROR.reduxSlice.actions.addError({
                    message: 'Failed to execute Apex script',
                    details: err.message,
                })
            );
            return { success: false, error: err.message };
        });
}

// Create or update an Apex tab for editing code (does not execute)
async function editApexTab({ body, tabId }) {
    return store
        .dispatch(async (dispatch, getState) => {
            const { application, apex } = getState();
            const { tabId: realTabId, isNewTab } = formatTabId(tabId, apex.tabs);
            if (application.isLoading) await waitForLoaded();
            await wrappedNavigate({ applicationName: TOOL_APP_NAMES.apex });
            if (isNewTab) {
                await dispatch(APEX.reduxSlice.actions.addTab({ tab: { id: realTabId, body } }));
            } else {
                await dispatch(APEX.reduxSlice.actions.selectionTab({ id: realTabId }));
                await dispatch(APEX.reduxSlice.actions.updateBody({ body }));
            }
            // No execution, just editing/creating the tab
            return { tabId: realTabId, body };
        })
        .then(data => {
            LOGGER.log('editApexTab script 2', data);
            return { success: true, output: data };
        })
        .catch(err => {
            store.dispatch(
                ERROR.reduxSlice.actions.addError({
                    message: 'Failed to edit Apex tab',
                    details: err.message,
                })
            );
            return { success: false, error: err.message };
        });
}

// Fetch saved Apex scripts for the current alias
async function fetchApexSavedScripts({ alias }) {
    return store
        .dispatch(async (dispatch, getState) => {
            await dispatch(DOCUMENT.reduxSlices.APEXFILE.actions.loadFromStorage({ alias }));
            const { apexFiles } = getState();
            const entities = SELECTORS.apexFiles.selectAll({ apexFiles });
            LOGGER.log('fetchApexSavedScripts script 1', entities);
            return entities.filter(item => item.isGlobal || item.alias === alias);
        })
        .then(data => {
            LOGGER.log('fetchApexSavedScripts script 2', data);
            return { success: true, script: data };
        })
        .catch(err => {
            store.dispatch(
                ERROR.reduxSlice.actions.addError({
                    message: 'Failed to save Apex script',
                    details: err.message,
                })
            );
            return { success: false, error: err.message };
        });
}

// Save an Apex script globally or for a specific org
async function saveApexScript({ body, name, isGlobal, alias }) {
    return store
        .dispatch(async (dispatch, getState) => {
            const { application } = getState();
            if (application.isLoading) await waitForLoaded();
            await wrappedNavigate({ applicationName: TOOL_APP_NAMES.apex });
            // Compose the script object
            const _alias = isGlobal
                ? null
                : alias || store.getState().application.connector?.conn?.alias;
            const script = {
                id: Date.now().toString(),
                name,
                content: body,
                isGlobal: !!isGlobal,
                alias: _alias,
                createdDate: Date.now(),
            };
            // Save using the DOCUMENT slice for APEXFILE
            await dispatch(DOCUMENT.reduxSlices.APEXFILE.actions.upsertOne(script));
            await dispatch(
                APEX.reduxSlice.actions.linkFileToTab({
                    fileId: name,
                    alias: _alias,
                    apexFiles: getState().apexFiles,
                })
            );
            LOGGER.log('Saved Apex script', script);
            return script;
        })
        .then(data => {
            LOGGER.log('Saved Apex script 2', data);
            return { success: true, script: data };
        })
        .catch(err => {
            store.dispatch(
                ERROR.reduxSlice.actions.addError({
                    message: 'Failed to save Apex script',
                    details: err.message,
                })
            );
            return { success: false, error: err.message };
        });
}

function getApexCurrentTab() {
    const state = store.getState();
    const currentTab = state.apex?.currentTab || null;
    return currentTab ? { ...currentTab } : null;
}

const apexNavigate = tool({
    name: 'apex_navigate',
    description: APEX_TOOL_DESCRIPTIONS.navigate,
    parameters: z.object({}),
    execute: async () => {
        return await navigateToApex();
    },
});

const apexOpenTab = tool({
    name: 'apex_open_tab',
    description: APEX_TOOL_DESCRIPTIONS.openTab,
    parameters: z.object({
        tabId: z.string().describe('The ID of the Apex tab to open'),
    }),
    execute: async ({ tabId }) => {
        return await openApexTab({ tabId });
    },
});

const apexExecute = tool({
    name: 'apex_execute',
    description: APEX_TOOL_DESCRIPTIONS.execute,
    parameters: z.object({
        tabId: z
            .string()
            .describe(APEX_TOOL_DESCRIPTIONS.executeTabId),
    }),
    execute: async ({ tabId }) => {
        return await executeAnonymousApex({ tabId });
    },
});

const apexEdit = tool({
    name: 'apex_edit',
    description: APEX_TOOL_DESCRIPTIONS.edit,
    parameters: z.object({
        body: z.string().describe('The Apex code to edit or create'),
        tabId: z
            .string()
            .optional()
            .nullable()
            .describe(APEX_TOOL_DESCRIPTIONS.editTabId),
    }),
    execute: async ({ body, tabId }) => {
        return await editApexTab({ body, tabId });
    },
});

const apexSavedScripts = tool({
    name: 'apex_saved_scripts',
    description: APEX_TOOL_DESCRIPTIONS.savedScripts,
    parameters: z.object({
        alias: z
            .string()
            .optional()
            .nullable()
            .describe(APEX_TOOL_DESCRIPTIONS.savedScriptsAlias),
    }),
    execute: async ({ alias }) => {
        alias = alias || store.getState().application.connector?.conn?.alias;
        return await fetchApexSavedScripts({ alias });
    },
});

const apexSaveScript = tool({
    name: 'apex_save_script',
    description: APEX_TOOL_DESCRIPTIONS.saveScript,
    parameters: z.object({
        body: z.string().describe('The Apex code to save'),
        name: z.string().describe('The name for the script'),
        isGlobal: z.boolean().describe('Whether to save globally or for the current org'),
        alias: z.string().optional().nullable().describe('Org alias if not global'),
    }),
    execute: async ({ body, name, isGlobal, alias }) => {
        const result = await saveApexScript({ body, name, isGlobal, alias });
        LOGGER.log('saveApexScript result', result);
        return result;
    },
    errorFunction: err => {
        LOGGER.error('saveApexScript error', err);
    },
});

const apexGetCurrentTab = tool({
    name: 'apex_get_current_tab',
    description: APEX_TOOL_DESCRIPTIONS.getCurrentTab,
    parameters: z.object({}),
    execute: async () => {
        return getApexCurrentTab();
    },
});

export const apexTools = [
    apexNavigate,
    apexOpenTab,
    apexExecute,
    apexEdit,
    apexSavedScripts,
    apexSaveScript,
    apexGetCurrentTab,
];
