import { guid } from 'shared/utils';

const DEFAULT_SKILL_DEFINITIONS = [
    {
        name: 'SOQL',
        content:
            'Use SOQL tools to run and display queries. Prefer soql_query_incognito when the user does not need to see the query in the UI.',
        enabled: true,
    },
    {
        name: 'Apex',
        content:
            'Use Apex tools to edit and execute anonymous Apex. Always ask for confirmation before executing scripts.',
        enabled: true,
    },
    {
        name: 'API',
        content: 'Use API tools to run REST calls and manage saved API scripts.',
        enabled: true,
    },
    {
        name: 'Connections',
        content: 'Use connection tools to list, connect, disconnect, or open Salesforce orgs.',
        enabled: true,
    },
    {
        name: 'Chrome',
        content:
            'Use Chrome tools only for browser automation (screenshots, tab management). Prefer Salesforce Toolkit tools for org and data actions.',
        enabled: true,
    },
    {
        name: 'Metadata',
        content: 'Use Metadata tools to navigate and inspect metadata types and records.',
        enabled: true,
    },
    {
        name: 'Agent continuation',
        content:
            'When the user\'s goal requires more tool steps, call agent_request_continue with a brief reason. When you can give a final answer, respond normally and do not call that tool.',
        enabled: true,
    },
];

/**
 * Returns the predefined default agent skills with generated ids.
 * Used when no skills exist in cache (first load) or when the user resets to default.
 */
export function getDefaultAgentSkills() {
    return DEFAULT_SKILL_DEFINITIONS.map(({ name, content, enabled }) => ({
        id: guid(),
        name,
        content,
        enabled,
    }));
}
