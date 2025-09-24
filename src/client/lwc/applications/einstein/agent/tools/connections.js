import { z } from 'zod';
import { getConfiguration, getPublicConfigurations, saveSession, credentialStrategies, OAUTH_TYPES } from 'connection/utils';
import LOGGER from 'shared/logger';
import { store, APPLICATION } from 'core/store';
const { tool } = window.OpenAIAgentsBundle.Agents;
import { openToolkit, openBrowser } from './utils/utils.js';

async function _getConnector({ alias, sessionId, instanceUrl, redirect }) {
    let connector;
    if (alias) {
        // Fetch configuration for the alias
        const config = await getConfiguration(alias);
        const strategy = credentialStrategies[config.credentialType || 'OAUTH'];
        if (!strategy)
            throw new Error(`No strategy for credential type: ${config.credentialType}`);

        // Connect using the strategy
        connector = await strategy.connect({ ...config, alias, disableEvent: false });
    }

    // Connect by sessionId + instanceUrl
    if (sessionId && instanceUrl) {
        connector = await credentialStrategies.SESSION.createConnector({
            sessionId,
            instanceUrl,
        });
    }
    return connector;
}

async function connectToOrg({ alias, sessionId, instanceUrl, redirect }) {
    try {

        const { isSidePanel } = store.getState().application;
        LOGGER.log('isSidePanel',isSidePanel);
        let connector = await _getConnector({ alias, sessionId, instanceUrl });
        if(!connector){
            throw new Error('Either alias or sessionId + instanceUrl must be provided.');
        }
        if(isSidePanel){
            await openToolkit({connector,redirect});
        }else{
            // Optionally save session
            await saveSession(connector?.configuration || config);
            store.dispatch(APPLICATION.reduxSlice.actions.login({ connector }));
        }

        return { status: 'connected'};
    } catch (error) {
        LOGGER.error('[connectToOrg] Error connecting:', error);
        return { status: 'error', error: error.message || error };
    }
}

async function disconnectOrg() {
    await removeSession();
    await store.dispatch(APPLICATION.reduxSlice.actions.logout());
    return { status: 'disconnected' };
}

async function navigateToOrg({ alias, sessionId, instanceUrl, redirect }) {
    try{
        const connector = await _getConnector({ alias, sessionId, instanceUrl });
        if(!connector){
            throw new Error('Either alias or sessionId + instanceUrl must be provided.');
        }
        let _alias = alias || connector.conn.alias;
        await openBrowser({url:connector.frontDoorUrl,alias:_alias});
    }catch(e){
        LOGGER.error('[openOrg] Error opening org:', e);
        return { status: 'error', error: e.message || e };
    }
}

const listConnectionTool = tool({
    name: 'list_connections',
    description: 'List all Salesforce org connections (aliases, usernames, etc.) available in the toolkit.',
    parameters: z.object({}),
    execute: async () => {
        try{
            const publicConfigurations = await getPublicConfigurations();
            return JSON.stringify(publicConfigurations);
        }catch(e){
            LOGGER.error('[listConnectionTool] Error listing connections:', e);
            return { status: 'error', error: e.message || e };
        }
    },
});

const connectToOrgTool = tool({
    name: 'connect_org',
    description: `Connect to a Salesforce org. 

    ## Instructions:
    - Set Redirect to a specific application (applicationName=api) to open a specific application but by default you can keep it null

    ## Applications available:
        - api: Open the API Explorer
        - soql: Open the SOQL Editor
        - anonymousApex: Open the Anonymous Apex Editor
        - agent: Open the Agent
        - connections: Open the Connections
        - settings: Open the Settings
        - accessAnalyzer: Open the Access Analyzer
        - org: Open the Org. Overview
        - code: Open the Code Toolkit
        - metadata: Open the Metadata Explorer
        - object: Open the SObject Explorer
        - doc: Open the Documentation
        - recordViewer: Open the Record Viewer
        - platformevent: Open the Event Explorer
        - package: Open the Deploy/Retrieve
        - assistant: Open the AI Assistant
        - settings: Open the Settings
        - release: Open the Release Notes
    `,
    parameters: z.object({
        alias: z.string().describe('The alias of the org to connect to'),
        sessionId: z.string().optional().nullable().describe('The sessionId of the org to connect to'),
        instanceUrl: z.string().optional().nullable().describe('The instanceUrl of the org to connect to'),
        redirect: z.string().optional().nullable().describe('The redirect url to open (applicationName=api)'),
    }),
    execute: async ({ alias, sessionId, instanceUrl, redirect }) => {
        try{
            return await connectToOrg({ alias, sessionId, instanceUrl, redirect });
        }catch(e){
            LOGGER.error('[connectToOrg] Error connecting:', e);
            return { status: 'error', error: e.message || e };
        }
    },
});

const disconnectOrgTool = tool({
    name: 'disconnect_org',
    description: 'Disconnect from the current Salesforce org (removes session).',
    parameters: z.object({}),
    execute: async () => {
        try{
            return await disconnectOrg();
        }catch(e){
            LOGGER.error('[disconnectOrg] Error disconnecting:', e);
            return { status: 'error', error: e.message || e };
        }
    },
});

const navigateToOrgTool = tool({
    name: 'navigate_to_org',
    description: `Navigate to a Salesforce org. Redirect is optional and can be used to open a specific page/application specific to salesforce.`,
    parameters: z.object({
        alias: z.string().describe('The alias of the org to open (different from username)'),
        username: z.string().optional().nullable().describe('The username of the org to open'),
        sessionId: z.string().optional().nullable().describe('The sessionId of the org to open'),
        instanceUrl: z.string().optional().nullable().describe('The instanceUrl of the org to open'),
        redirect: z.string().optional().nullable().describe('The redirect url to open'),
    }),
    execute: async ({ alias, sessionId, instanceUrl, redirect }) => {
        try{
            return await navigateToOrg({ alias, sessionId, instanceUrl, redirect });
        }catch(e){
            LOGGER.error('[navigateToOrg] Error navigating to org:', e);
            return { status: 'error', error: e.message || e };
        }
    },
});




export const connectionTools = [listConnectionTool, connectToOrgTool, disconnectOrgTool, navigateToOrgTool];