import {
    getConfiguration,
    getPublicConfigurations,
    saveSession,
    removeSession,
    credentialStrategies,
    OAUTH_TYPES,
} from 'core/connector';
import { store, APPLICATION } from 'core/store';
import LOGGER from 'shared/logger';
import { z } from 'zod';
import type { ConnectorLike } from 'core/connector';
import { CONNECTION_TOOL_DESCRIPTIONS } from '../constants';

const { tool } = window.OpenAIAgentsBundle?.Agents || {};
import { openToolkit, openBrowser } from '../utils/utils';

async function _getConnector({
    alias,
    sessionId,
    instanceUrl,
    redirect,
}: {
    alias?: string;
    sessionId?: string;
    instanceUrl?: string;
    redirect?: boolean;
}): Promise<ConnectorLike | null> {
    let connector: ConnectorLike | null = null;
    if (alias) {
        // Fetch configuration for the alias
        const config = await getConfiguration(alias);
        const strategy = credentialStrategies[config.credentialType || OAUTH_TYPES.OAUTH];
        if (!strategy) throw new Error(`No strategy for credential type: ${config.credentialType}`);

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

async function connectToOrg({
    alias,
    sessionId,
    instanceUrl,
    redirect,
}: {
    alias?: string;
    sessionId?: string;
    instanceUrl?: string;
    redirect?: boolean;
}) {
    try {
        const { isSidePanel } = store.getState().application;
        LOGGER.log('isSidePanel', isSidePanel);
        const connector: ConnectorLike | null = await _getConnector({
            alias,
            sessionId,
            instanceUrl,
        });
        if (!connector) {
            throw new Error('Either alias or sessionId + instanceUrl must be provided.');
        }
        if (isSidePanel) {
            await openToolkit({ connector, redirect });
        } else {
            // Optionally save session
            await saveSession(connector?.configuration);
            store.dispatch(APPLICATION.reduxSlice.actions.login({ connector }));
        }

        return { status: 'connected' };
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

async function navigateToOrg({
    alias,
    sessionId,
    instanceUrl,
    redirect,
}: {
    alias?: string;
    sessionId?: string;
    instanceUrl?: string;
    redirect?: boolean;
}) {
    try {
        const connector: ConnectorLike | null = await _getConnector({
            alias,
            sessionId,
            instanceUrl,
        });
        if (!connector) {
            throw new Error('Either alias or sessionId + instanceUrl must be provided.');
        }
        let _alias = alias || connector.conn.alias;
        await openBrowser({ url: connector.frontDoorUrl, alias: _alias });
    } catch (e) {
        LOGGER.error('[openOrg] Error opening org:', e);
        return { status: 'error', error: e.message || e };
    }
}

const listConnectionTool = tool({
    name: 'list_connections',
    description: CONNECTION_TOOL_DESCRIPTIONS.listConnections,
    parameters: z.object({}),
    execute: async () => {
        try {
            const publicConfigurations = await getPublicConfigurations();
            return JSON.stringify(publicConfigurations);
        } catch (e) {
            LOGGER.error('[listConnectionTool] Error listing connections:', e);
            return { status: 'error', error: e.message || e };
        }
    },
});

const connectToOrgTool = tool({
    name: 'connect_org',
    description: CONNECTION_TOOL_DESCRIPTIONS.connectOrg,
    parameters: z.object({
        alias: z.string().describe('The alias of the org to connect to'),
        sessionId: z
            .string()
            .optional()
            .nullable()
            .describe('The sessionId of the org to connect to'),
        instanceUrl: z
            .string()
            .optional()
            .nullable()
            .describe('The instanceUrl of the org to connect to'),
        redirect: z
            .string()
            .optional()
            .nullable()
            .describe(CONNECTION_TOOL_DESCRIPTIONS.connectRedirect),
    }),
    execute: async ({ alias, sessionId, instanceUrl, redirect }) => {
        try {
            return await connectToOrg({ alias, sessionId, instanceUrl, redirect });
        } catch (e) {
            LOGGER.error('[connectToOrg] Error connecting:', e);
            return { status: 'error', error: e.message || e };
        }
    },
});

const disconnectOrgTool = tool({
    name: 'disconnect_org',
    description: CONNECTION_TOOL_DESCRIPTIONS.disconnectOrg,
    parameters: z.object({}),
    execute: async () => {
        try {
            return await disconnectOrg();
        } catch (e) {
            LOGGER.error('[disconnectOrg] Error disconnecting:', e);
            return { status: 'error', error: e.message || e };
        }
    },
});

const navigateToOrgTool = tool({
    name: 'navigate_to_org',
    description: CONNECTION_TOOL_DESCRIPTIONS.navigateToOrg,
    parameters: z.object({
        alias: z.string().describe('The alias of the org to open (different from username)'),
        username: z.string().optional().nullable().describe('The username of the org to open'),
        sessionId: z.string().optional().nullable().describe('The sessionId of the org to open'),
        instanceUrl: z
            .string()
            .optional()
            .nullable()
            .describe('The instanceUrl of the org to open'),
        redirect: z.string().optional().nullable().describe('The redirect url to open'),
    }),
    execute: async ({ alias, sessionId, instanceUrl, redirect }) => {
        try {
            return await navigateToOrg({ alias, sessionId, instanceUrl, redirect });
        } catch (e) {
            LOGGER.error('[navigateToOrg] Error navigating to org:', e);
            return { status: 'error', error: e.message || e };
        }
    },
});

export const connectionTools = [
    listConnectionTool,
    connectToOrgTool,
    disconnectOrgTool,
    navigateToOrgTool,
];
