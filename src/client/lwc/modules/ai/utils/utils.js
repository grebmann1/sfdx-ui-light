import { store } from 'core/store';
import LOGGER from 'shared/logger';
import { guid, isNotUndefinedOrNull } from 'shared/utils';
import { CACHE_CONFIG } from 'shared/cacheManager';

export const ROLES = {
    USER: 'user',
    SYSTEM: 'system',
    TOOL: 'tool',
};

export const functionOutput = ({ tool_call_id, content }) => {
    return [
        {
            id: guid(),
            role: ROLES.TOOL,
            tool_call_id,
            content,
        },
    ];
};

function buildOpenaiEndpoint(baseUrl, path) {
    if (!baseUrl) baseUrl = 'https://api.openai.com';
    let url = baseUrl.replace(/\/$/, '');
    if (!/\/v1$/.test(url)) url += '/v1';
    return url + path;
}

export const fetchCompletion = async ({
    model,
    messages,
    instructions,
    tools,
    response_format,
    provider,
    openaiKey,
}) => {
    const state = store.getState().application;
    const aiProvider = provider || state.aiProvider || 'openai';
    let openaiUrl = state.openaiUrl;
    openaiKey = openaiKey || state.openaiKey;
    if (!openaiKey) throw new Error('No OpenAI API key configured. Please set it in settings.');
    if (aiProvider === 'openai') {
        const tool_choice = isNotUndefinedOrNull(tools) ? 'auto' : undefined;
        const config = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${openaiKey}`,
            },
            body: JSON.stringify({
                model,
                messages,
                tools,
                response_format,
                instructions,
                tool_choice,
                temperature: 1,
                max_completion_tokens: 2048,
                top_p: 1,
                frequency_penalty: 0,
                presence_penalty: 0,
            }),
        };
        LOGGER.debug('config', config, JSON.parse(config.body));
        const endpoint = buildOpenaiEndpoint(openaiUrl, '/chat/completions');
        const response = await fetch(endpoint, config);
        const data = await response.json();
        if (data && data.error) throw new Error(data.error);
        return data;
    } else if (aiProvider === 'einstein') {
        throw new Error('Einstein provider is not yet implemented.');
    } else if (aiProvider === 'azure') {
        throw new Error('Azure OpenAI provider is not yet implemented.');
    } else {
        throw new Error(`Unknown AI provider: ${aiProvider}`);
    }
};

export const fetchCompletionStream = async ({
    model,
    messages,
    instructions,
    tools,
    response_format,
    provider,
    openaiKey,
}) => {
    const state = store.getState().application;
    const aiProvider = provider || state.aiProvider || 'openai';
    let endpoint = state.openaiUrl;
    let accessToken = openaiKey || state.openaiKey;
    if (!openaiKey) throw new Error('No OpenAI API key configured. Please set it in settings.');
    if (aiProvider === 'openai') {
        LOGGER.debug('endpoint --> ', endpoint);
        LOGGER.debug('accessToken --> ', accessToken);
        const tool_choice = isNotUndefinedOrNull(tools) ? 'auto' : undefined;
        const controller = new AbortController();
        const formattedEndpoint = buildOpenaiEndpoint(endpoint, '/chat/completions');
        const response = await fetch(formattedEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
                model,
                messages,
                tools,
                response_format,
                instructions,
                tool_choice,
                temperature: 1,
                max_completion_tokens: 2048,
                top_p: 1,
                frequency_penalty: 0,
                presence_penalty: 0,
                stream: true,
            }),
            signal: controller.signal,
        });
        if (!response.ok) {
            let errMsg = `HTTP error! status: ${response.status}`;
            try {
                const errData = await response.json();
                if (errData && errData.error){
                    errMsg = errData.error?.message || errData.error;
                }
            } catch {}
            throw new Error(errMsg);
        }
        return {
            body: response.body,
            abort: () => controller.abort(),
        };
    } else if (aiProvider === 'einstein') {
        throw new Error('Einstein provider is not yet implemented.');
    } else if (aiProvider === 'azure') {
        throw new Error('Azure OpenAI provider is not yet implemented.');
    } else {
        throw new Error(`Unknown AI provider: ${aiProvider}`);
    }
};
