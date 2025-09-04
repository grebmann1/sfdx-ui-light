import { z } from 'zod';
import { store, METADATA } from 'core/store';
import { waitForLoaded, wrappedNavigate, formatTabId } from './utils/utils.js';
const { tool } = window.OpenAIAgentsBundle.Agents;
// Navigate to Metadata Explorer
async function navigateToMetadata() {
    return await store.dispatch(async (dispatch, getState) => {
        const { application } = getState();
        if (application.isLoading) await waitForLoaded();
        await wrappedNavigate({ applicationName: 'metadata' });
        return { success: true };
    });
}

// Open a specific metadata tab
async function openMetadataTab({ tabId }) {
    return await store.dispatch(async (dispatch, getState) => {
        const { application } = getState();
        if (application.isLoading) await waitForLoaded();
        await wrappedNavigate({ applicationName: 'metadata' });
        // We are setting the current tab to the one we want to execute
        await dispatch(METADATA.reduxSlice.actions.selectionTab({ id: tabId }));
        return { success: true, tabId };
    });
}

// List all available metadata types
async function listMetadataTypes() {
    const result = await store.dispatch(METADATA.reduxSlice.actions.fetchGlobalMetadata());
    return { success: true, types: result.payload.records };
}

// List all records for a metadata type
async function listMetadataRecords({ sobject }) {
    const result = await store.dispatch(METADATA.reduxSlice.actions.fetchSpecificMetadata({ sobject }));
    return { success: true, records: result.payload.metadata.records };
}

// Get details/files for a specific metadata record
async function getMetadataRecord({ sobject, recordId }) {
    const result = await store.dispatch(METADATA.reduxSlice.actions.fetchMetadataRecord({ sobject, param1: recordId }));
    return { success: true, ...result.payload };
}

// Fetch SObject describe/objectInfo for a given SObject name
async function describeSObject({ sobject }) {
    // This assumes a Redux action or API exists to fetch describe info. Replace with actual implementation if needed.
    // Example: METADATA.reduxSlice.actions.fetchSObjectDescribe({ sobject })
    const result = await store.dispatch(METADATA.reduxSlice.actions.fetchSObjectDescribe({ sobject }));
    return { success: true, describe: result.payload.describe };
}

// Tool: Navigate to Metadata Explorer
const metadataNavigate = tool({
    name: 'metadata_navigate',
    description: 'Navigate to the Metadata Explorer application.',
    parameters: z.object({}),
    execute: async () => {
        return await navigateToMetadata();
    },
});

// Tool: Open a specific metadata tab
const metadataOpenTab = tool({
    name: 'metadata_open_tab',
    description: 'Open a specific metadata tab in the Metadata Explorer.',
    parameters: z.object({
        tabId: z.string().describe('The ID of the metadata tab to open'),
    }),
    execute: async ({ tabId }) => {
        return await openMetadataTab({ tabId });
    },
});

// Tool: List all available metadata types
const metadataListTypes = tool({
    name: 'metadata_list_types',
    description: '[Incognito] List all available metadata types in the org.',
    parameters: z.object({}),
    execute: async () => {
        return await listMetadataTypes();
    },
});

// Tool: List all records for a metadata type
const metadataListRecords = tool({
    name: 'metadata_list_records',
    description: '[Incognito] List all records for a given metadata type.',
    parameters: z.object({
        sobject: z.string().describe('The metadata type to list records for'),
    }),
    execute: async ({ sobject }) => {
        return await listMetadataRecords({ sobject });
    },
});

// Tool: Get details/files for a specific metadata record
const metadataGetRecord = tool({
    name: 'metadata_get_record',
    description: '[Incognito] Get details and files for a specific metadata record.',
    parameters: z.object({
        sobject: z.string().describe('The metadata type'),
        recordId: z.string().describe('The record ID or fullName'),
    }),
    execute: async ({ sobject, recordId }) => {
        return await getMetadataRecord({ sobject, recordId });
    },
});

// Tool: Describe SObject (fields, types, etc.)
const metadataDescribeObject = tool({
    name: 'metadata_describe_object',
    description: 'Fetch describe/objectInfo (fields, types, etc.) for a given SObject name.',
    parameters: z.object({
        sobject: z.string().describe('The API name of the SObject to describe'),
    }),
    execute: async ({ sobject }) => {
        return await describeSObject({ sobject });
    },
});

export const metadataTools = [
    metadataNavigate,
    metadataOpenTab,
    metadataListTypes,
    metadataListRecords,
    metadataGetRecord,
    metadataDescribeObject,
];