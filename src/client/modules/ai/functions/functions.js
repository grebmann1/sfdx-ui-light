import { ROLES, functionOutput } from 'ai/utils';
import LOGGER from 'shared/logger';
import { lowerCaseKey, guid, isNotUndefinedOrNull, isUndefinedOrNull } from 'shared/utils';

export const globalActions = {
    default: async (parameters, { messages, tool_call_id, dispatch }) => {
        return functionOutput({
            tool_call_id,
            content: 'Method not found. Keep the conversation/process going',
        });
    },
};
