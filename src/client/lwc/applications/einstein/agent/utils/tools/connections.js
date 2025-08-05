import { z } from 'zod';
import { connectToOrg, disconnectFromOrg } from '../logic/connectionLogic';
import { getPublicConfigurations } from 'connection/utils';
const { tool } = window.OpenAIAgentsBundle.Agents;

const listConnections = tool({
    name: 'list_connections',
    description: 'List all Salesforce org connections (aliases, usernames, etc.) available in the toolkit.',
    parameters: z.object({}),
    execute: async () => {
        const publicConfigurations = await getPublicConfigurations();
        return JSON.stringify(publicConfigurations);
    },
});

const connectOrg = tool({
    name: 'connect_org',
    description: 'Connect to a Salesforce org.',
    parameters: z.object({
        alias: z.string().describe('The alias of the org to connect to'),
        sessionId: z.string().optional().nullable().describe('The sessionId of the org to connect to'),
        instanceUrl: z.string().optional().nullable().describe('The instanceUrl of the org to connect to'),
    }),
    execute: async ({ alias, sessionId, instanceUrl }) => {
        return await connectToOrg({ alias, sessionId, instanceUrl });
    },
});

const disconnectOrg = tool({
    name: 'disconnect_org',
    description: 'Disconnect from the current Salesforce org (removes session).',
    parameters: z.object({}),
    execute: async () => {
        return await disconnectFromOrg();
    },
});

export const connectionTools = [listConnections, connectOrg, disconnectOrg];