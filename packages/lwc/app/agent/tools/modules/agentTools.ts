import { z } from 'zod';
import { AGENT_TOOL_CONFIG } from '../constants';
const { tool } = window.OpenAIAgentsBundle?.Agents || {};

/**
 * Tool the agent calls when the user's goal is not yet achieved and it needs
 * to run more tools in a follow-up turn. Triggers an automatic continuation
 * of the run (stopAtToolNames). Do not use when the goal is achieved.
 */
const agentRequestContinue = tool({
    name: AGENT_TOOL_CONFIG.requestContinue.name,
    description: AGENT_TOOL_CONFIG.requestContinue.description,
    parameters: z.object({
        reason: z
            .string()
            .optional()
            .nullable()
            .describe(AGENT_TOOL_CONFIG.requestContinue.reasonDescription),
    }),
    execute: async ({ reason }) => {
        return reason && reason.trim()
            ? `${AGENT_TOOL_CONFIG.requestContinue.continueWithReasonPrefix}${reason.trim()}`
            : AGENT_TOOL_CONFIG.requestContinue.continueWithoutReason;
    },
});

export const agentTools = [agentRequestContinue];
