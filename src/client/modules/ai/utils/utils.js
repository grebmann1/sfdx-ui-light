import LOGGER from 'shared/logger';
import {  guid,isNotUndefinedOrNull } from 'shared/utils';

import { store } from 'core/store';

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

export const fetchCompletion = async ({ model, messages, instructions, tools, response_format }) => {
    const openaiKey = store.getState().application.openaiKey;
    const tool_choice = isNotUndefinedOrNull(tools) ? "auto" : undefined;
    const config = {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${openaiKey}`
        },
        body: JSON.stringify({
            model,
            messages,
            tools,
            response_format,
            instructions,
            // Options
            tool_choice,
            temperature: 1,
            max_completion_tokens: 2048,
            top_p: 1,
            frequency_penalty: 0,
            presence_penalty: 0
        }),
    };

    LOGGER.debug('config', config,JSON.parse(config.body));
    return fetch("https://api.openai.com/v1/chat/completions", config);
}

