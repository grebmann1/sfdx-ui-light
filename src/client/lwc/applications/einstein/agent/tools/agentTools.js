import { z } from 'zod';
const { tool } = window.OpenAIAgentsBundle?.Agents || {};

/**
 * Tool the agent calls when the user's goal is not yet achieved and it needs
 * to run more tools in a follow-up turn. Triggers an automatic continuation
 * of the run (stopAtToolNames). Do not use when the goal is achieved.
 */
const agentRequestContinue = tool({
    name: 'agent_request_continue',
    description:
        'Call this when the user\'s goal is not yet achieved and you need to run more tools in a follow-up turn. Do not call when you can give a final answer. After calling, the run will continue automatically with another turn.',
    parameters: z.object({
        reason: z
            .string()
            .optional()
            .nullable()
            .describe('Brief reason for continuing (e.g. "Need to run SOQL then Apex")'),
    }),
    execute: async ({ reason }) => {
        return reason && reason.trim()
            ? `Continue with the next steps: ${reason.trim()}`
            : 'Continue with the next steps.';
    },
});

export const agentTools = [agentRequestContinue];
