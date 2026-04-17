import {
    getPublicConfigurations,
    getConfiguration,
    credentialStrategies,
    OAUTH_TYPES,
    saveSession,
} from 'core/connector';
import type { ConnectorLike } from 'core/connector';
import { store, APPLICATION } from 'core/store';
import LOGGER from 'shared/logger';
import { z } from 'zod';

import {
    CONNECTION_TOOL_DESCRIPTIONS,
    GENERAL_TOOL_DESCRIPTIONS,
    TOOL_APP_NAMES,
} from '../constants';
import { waitForLoaded, wrappedNavigate } from '../utils/utils';

/**
 * Plain-object tool definitions compatible with the Vercel AI SDK execution path
 * (Agent.ts extraTools / toAiSdkTools). These mirror the OpenAI-bundle domain tool
 * modules but do not depend on window.OpenAIAgentsBundle.
 */

export const getCurrentConnectionTool = {
    name: 'get_current_connection',
    description: GENERAL_TOOL_DESCRIPTIONS.currentConnection,
    parameters: z.object({}),
    execute: async () => {
        const state = store.getState();
        const connector: ConnectorLike | null = state.application?.connector || null;
        return { connector: connector?.toPublic?.() || null };
    },
};

export const checkUserLoggedInTool = {
    name: 'check_user_logged_in',
    description: GENERAL_TOOL_DESCRIPTIONS.checkLoggedIn,
    parameters: z.object({}),
    execute: async () => {
        const state = store.getState();
        const connector: ConnectorLike | null = state.application?.connector || null;
        return { isLoggedIn: connector != null };
    },
};

export const getCurrentApplicationTool = {
    name: 'get_current_application',
    description: GENERAL_TOOL_DESCRIPTIONS.currentApplication,
    parameters: z.object({}),
    execute: async () => {
        const state = store.getState();
        return { currentApplication: state.application?.currentApplication || null };
    },
};

export const listConnectionsTool = {
    name: 'list_connections',
    description: CONNECTION_TOOL_DESCRIPTIONS.listConnections,
    parameters: z.object({}),
    execute: async () => {
        try {
            const configs = await getPublicConfigurations();
            return { connections: configs };
        } catch (err) {
            LOGGER.error('[list_connections] Error:', err);
            return { connections: [], error: err instanceof Error ? err.message : String(err) };
        }
    },
};

export const connectOrgTool = {
    name: 'connect_org',
    description: CONNECTION_TOOL_DESCRIPTIONS.connectOrg,
    parameters: z.object({
        alias: z.string().describe('The alias of the org to connect to'),
        sessionId: z.string().optional().nullable().describe('The sessionId of the org'),
        instanceUrl: z.string().optional().nullable().describe('The instanceUrl of the org'),
        redirect: z
            .string()
            .optional()
            .nullable()
            .describe(CONNECTION_TOOL_DESCRIPTIONS.connectRedirect),
    }),
    execute: async ({
        alias,
        sessionId,
        instanceUrl,
    }: {
        alias: string;
        sessionId?: string | null;
        instanceUrl?: string | null;
        redirect?: string | null;
    }) => {
        try {
            let connector: ConnectorLike | null = null;
            if (alias) {
                const config = await getConfiguration(alias);
                const strategy = credentialStrategies[config.credentialType || OAUTH_TYPES.OAUTH];
                if (!strategy)
                    throw new Error(`No strategy for credential type: ${config.credentialType}`);
                connector = await strategy.connect({ ...config, alias, disableEvent: false });
            } else if (sessionId && instanceUrl) {
                connector = await (credentialStrategies as any).SESSION?.createConnector?.({
                    sessionId,
                    instanceUrl,
                });
            }
            if (!connector)
                throw new Error('Either alias or sessionId + instanceUrl must be provided.');
            await saveSession(connector.configuration);
            store.dispatch(APPLICATION.reduxSlice.actions.login({ connector }));
            return { success: true, alias };
        } catch (err) {
            LOGGER.error('[connect_org] Error:', err);
            return { success: false, error: err instanceof Error ? err.message : String(err) };
        }
    },
};

export const navigateWorkbenchTool = {
    name: 'navigate_workbench_app',
    description: `Navigate the SF Toolkit workbench UI to a specific application.
Available apps: ${Object.entries(TOOL_APP_NAMES)
        .map(([k, v]) => `${k} (${v})`)
        .join(', ')}.
Use this to switch the active view without browser automation.`,
    parameters: z.object({
        applicationName: z
            .string()
            .describe(
                `The application to navigate to. One of: ${Object.values(TOOL_APP_NAMES).join(', ')}`
            ),
    }),
    execute: async ({ applicationName }: { applicationName: string }) => {
        try {
            const state = store.getState();
            if (state.application?.isLoading) await waitForLoaded();
            await wrappedNavigate({ applicationName });
            return { success: true, applicationName };
        } catch (err) {
            LOGGER.error('[navigate_workbench_app] Error:', err);
            return { success: false, error: err instanceof Error ? err.message : String(err) };
        }
    },
};

/** All workbench context tools — add to Agent extraTools. */
export const workbenchContextTools = [
    getCurrentConnectionTool,
    checkUserLoggedInTool,
    getCurrentApplicationTool,
    listConnectionsTool,
    connectOrgTool,
    navigateWorkbenchTool,
];
