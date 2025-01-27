import LOGGER from 'shared/logger';
import { lowerCaseKey, guid, isUndefinedOrNull, isNotUndefinedOrNull, safeParseJson } from 'shared/utils';

export const ROLES = {
    USER: 'user',
    SYSTEM: 'system',
    TOOL: 'tool'
}

export const functionOutput = ({ tool_call_id, content }) => {
    return [{
        id: guid(),
        role: ROLES.TOOL,
        tool_call_id,
        content
    }];
}


export const fetchCompletion = ({ model, messages, instructions, tools, response_format }) => {
    const config = {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            //"Authorization": `Bearer ${openaiKey}`
        },
        body: JSON.stringify({
            model,
            messages,
            tools,
            response_format,
            instructions,
            // Options
            tool_choice: "auto",
            temperature: 1,
            max_completion_tokens: 2048,
            top_p: 1,
            frequency_penalty: 0,
            presence_penalty: 0
        }),

    };
    LOGGER.agent('config', JSON.parse(config.body));
    return fetch("/api/openai/completion", config);
}