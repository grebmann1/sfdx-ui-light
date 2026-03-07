/**
 * Model-to-built-in-tool support for the OpenAI Responses API (frontend).
 * Used to filter built-in tools by selected model before sending to the API.
 *
 * Source: OpenAI model docs (Responses API tools section per model)
 * - https://developers.openai.com/api/docs/models/gpt-5-mini
 * - https://developers.openai.com/api/docs/models/gpt-5
 * - https://developers.openai.com/api/docs/models/gpt-5.4
 */

const TOOLS_GPT_5_MINI = [
    'web_search',
    'web_search_preview',
    'code_interpreter',
    'file_search',
    'mcp',
];

const TOOLS_GPT_5 = [
    'web_search',
    'web_search_preview',
    'code_interpreter',
    'image_generation',
    'file_search',
    'mcp',
];

const TOOLS_GPT_5_4 = [
    'web_search',
    'web_search_preview',
    'code_interpreter',
    'image_generation',
    'shell',
    'computer_use_preview',
    'tool_search',
    'apply_patch',
    'file_search',
    'skills',
    'mcp',
];

const MODEL_FAMILIES = {
    'gpt-5-mini': TOOLS_GPT_5_MINI,
    'gpt-5-nano': TOOLS_GPT_5_MINI,
    'gpt-5': TOOLS_GPT_5,
    'gpt-5.3': TOOLS_GPT_5,
    'gpt-5.4': TOOLS_GPT_5_4,
    'gpt-4.1': TOOLS_GPT_5,
    'gpt-4.1-mini': TOOLS_GPT_5_MINI,
    'gpt-4.1-nano': TOOLS_GPT_5_MINI,
    'gpt-4o': TOOLS_GPT_5,
    'o1': TOOLS_GPT_5,
    'o1-mini': TOOLS_GPT_5_MINI,
    'o1-pro': TOOLS_GPT_5_4,
    'o3': TOOLS_GPT_5_4,
    'o3-mini': TOOLS_GPT_5,
    'o3-pro': TOOLS_GPT_5_4,
    'o4-mini': TOOLS_GPT_5,
};

function getModelFamily(modelId) {
    if (!modelId || typeof modelId !== 'string') return null;
    const id = modelId.trim().toLowerCase();
    if (MODEL_FAMILIES[id]) return id;
    for (const family of Object.keys(MODEL_FAMILIES)) {
        if (id.startsWith(family + '-') || id === family) return family;
    }
    return null;
}

/**
 * Returns the set of built-in tool types allowed for the given model.
 * @param {string} model - Model id (e.g. 'gpt-5-mini', 'gpt-5.3', 'gpt-5.4-2026-03-05')
 * @returns {Set<string>} Allowed built-in tool types
 */
export function getSupportedBuiltInToolTypes(model) {
    const family = getModelFamily(model);
    const list = family ? MODEL_FAMILIES[family] : TOOLS_GPT_5_MINI;
    return new Set(list);
}

/**
 * Filters an agent's tools array to only include tools supported by the model.
 * Function tools are always kept; built-in tools are filtered by model support.
 * @param {Array} tools - Agent tools array
 * @param {string} model - Model id
 * @returns {Array} Filtered tools array
 */
export function filterToolsByModel(tools, model) {
    if (!Array.isArray(tools) || tools.length === 0) return tools;
    const allowed = getSupportedBuiltInToolTypes(model);
    return tools.filter(tool => {
        if (!tool || typeof tool !== 'object') return false;
        if (tool.type === 'function') return true;
        const builtInType = tool.type || tool.providerData?.type;
        if (!builtInType) return false;
        return allowed.has(builtInType);
    });
}
