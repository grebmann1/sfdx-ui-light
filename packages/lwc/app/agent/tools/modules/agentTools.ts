import { z } from 'zod';
import { AGENT_TOOL_CONFIG } from '../constants';
import { createQuestion } from './askUserBridge';

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

/**
 * Plain-object tool definition compatible with Agent.create() extraTools.
 * Fires a window event so the UI can render a question prompt, then suspends
 * execution until the user answers (or skips).
 */
export const askUserTool = {
    type: 'function' as const,
    name: AGENT_TOOL_CONFIG.askUser.name,
    description: AGENT_TOOL_CONFIG.askUser.description,
    parameters: z.object({
        description: z.string().describe(AGENT_TOOL_CONFIG.askUser.descriptionDescription),
        question: z.string().describe(AGENT_TOOL_CONFIG.askUser.questionDescription),
        options: z
            .array(z.string())
            .min(2)
            .describe(AGENT_TOOL_CONFIG.askUser.optionsDescription),
    }),
    execute: async ({
        question,
        options,
    }: {
        description: string;
        question: string;
        options: string[];
    }) => {
        const id = `ask-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        const normalizedOptions = Array.isArray(options) ? options.filter(Boolean) : [];
        const questionPromise = createQuestion(id);
        if (typeof window !== 'undefined') {
            window.dispatchEvent(
                new CustomEvent('agent:ask_user', {
                    detail: { id, question, options: normalizedOptions },
                })
            );
        }
        try {
            const answer = await questionPromise;
            return answer
                ? `${AGENT_TOOL_CONFIG.askUser.answerPrefix}${answer}`
                : AGENT_TOOL_CONFIG.askUser.skippedAnswer;
        } catch {
            return AGENT_TOOL_CONFIG.askUser.skippedAnswer;
        }
    },
};
