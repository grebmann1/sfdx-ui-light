/**
 * OpenAI Responses API built-in tools (see https://developers.openai.com/docs/guides/tools?api-mode=responses).
 * These are merged with the agent's function tools when making API requests.
 * When using openAIGate, the backend filters this list by model (e.g. apply_patch only for supported models).
 * Omitted: File search (needs vector_store_ids), MCP (needs server_url).
 */

const WEB_SEARCH = {
    type: 'hosted_tool',
    name: 'web_search_preview',
    providerData: {
        type: 'web_search',
        search_context_size: 'medium',
    },
};

const CODE_INTERPRETER = {
    type: 'hosted_tool',
    name: 'code_interpreter',
    providerData: {
        type: 'code_interpreter',
        container: { type: 'auto' },
    },
};

const IMAGE_GENERATION = {
    type: 'hosted_tool',
    name: 'image_generation',
    providerData: {
        type: 'image_generation',
    },
};

const SHELL = {
    type: 'hosted_tool',
    name: 'shell',
    providerData: {
        type: 'shell',
    },
};

const COMPUTER_USE = {
    type: 'hosted_tool',
    name: 'computer_use_preview',
    providerData: {
        type: 'computer_use_preview',
        environment: 'browser',
        display_width: 1280,
        display_height: 720,
    },
};

const TOOL_SEARCH = {
    type: 'hosted_tool',
    name: 'tool_search',
    providerData: {
        type: 'tool_search',
    },
};

const APPLY_PATCH = {
    type: 'hosted_tool',
    name: 'apply_patch',
    providerData: {
        type: 'apply_patch',
    },
};

export const openaiBuiltInTools = [
    WEB_SEARCH,
    CODE_INTERPRETER,
    IMAGE_GENERATION,
    SHELL,
    COMPUTER_USE,
    TOOL_SEARCH,
    APPLY_PATCH,
];
