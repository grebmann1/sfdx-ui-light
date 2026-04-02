import { functionOutput } from 'ai/utils';

export const globalActions = {
    default: async (parameters, { messages, tool_call_id, dispatch }) => {
        return functionOutput({
            tool_call_id,
            content: 'Method not found. Keep the conversation/process going',
        });
    },
};
