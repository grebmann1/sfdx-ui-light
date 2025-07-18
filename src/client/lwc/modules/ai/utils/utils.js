import { store } from 'core/store';
import LOGGER from 'shared/logger';
import { guid, isNotUndefinedOrNull } from 'shared/utils';
import { loadExtensionConfigFromCache, CACHE_CONFIG } from 'shared/cacheManager';

export const PROVIDER_OPTIONS = [
    { label: 'OpenAI', value: 'openai' },
    { label: 'Apex (Salesforce)', value: 'apex' },
];

export const ROLES = {
    USER: 'user',
    SYSTEM: 'system',
    TOOL: 'tool',
};

export const MODEL_OPTIONS = [
    { label: 'gpt-4.1', value: 'gpt-4.1-2025-04-14' },
    { label: 'gpt-4.o', value: 'gpt-4o-2024-08-06' },
    { label: 'gpt-4.1.mini', value: 'gpt-4.1-mini-2025-04-14' },
    { label: 'o3.mini', value: 'o3-mini-2025-01-31' },
    { label: 'o1.mini', value: 'o1-mini-2024-09-12' },
    { label: 'gpt-4o.mini', value: 'gpt-4o-mini-2024-07-18' },
    { label: 'o4.mini', value: 'o4-mini-2025-04-16' },
];

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

export const fetchCompletion = async ({
    model,
    messages,
    instructions,
    tools,
    response_format,
    // Optionally allow provider override
    provider,
    openaiKey,
}) => {
    const state = store.getState().application;
    const authorization = `Bearer ${openaiKey || state.openaiKey}`;
    const aiProvider = provider || state.aiProvider || 'openai';
    if (aiProvider === 'openai') {
        const tool_choice = isNotUndefinedOrNull(tools) ? 'auto' : undefined;
        const config = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: authorization,
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
        return fetch('https://api.openai.com/v1/chat/completions', config);
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
    const authorization = `Bearer ${openaiKey || state.openaiKey}`;
    const aiProvider = provider || state.aiProvider || 'openai';
    if (aiProvider === 'openai') {
        const tool_choice = isNotUndefinedOrNull(tools) ? 'auto' : undefined;
        const controller = new AbortController();
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: authorization,
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
            throw new Error(`HTTP error! status: ${response.status}`);
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
