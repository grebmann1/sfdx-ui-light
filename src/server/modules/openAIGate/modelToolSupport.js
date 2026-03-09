/**
 * Model-to-built-in-tool support for the OpenAI Responses API.
 * Built-in tools are not all supported by every model. Function tools are never filtered.
 *
 * Source: OpenAI model docs (Responses API tools section per model)
 * - https://developers.openai.com/api/docs/models/gpt-5-mini
 * - https://developers.openai.com/api/docs/models/gpt-5
 * - https://developers.openai.com/api/docs/models/gpt-5.4
 *
 * API tool types used in requests: web_search, web_search_preview, code_interpreter,
 * image_generation, shell, computer_use_preview, tool_search, apply_patch, file_search, skills, mcp.
 */

// GPT-5 mini: Web search ✓, File search ✓, Code interpreter ✓, MCP ✓. Rest: Not supported.
const TOOLS_GPT_5_MINI = [
    'web_search',
    'web_search_preview',
    'code_interpreter',
    'file_search',
    'mcp',
];

// GPT-5: + Image generation ✓. Still no Hosted shell, Apply patch, Skills, Computer use, Tool search.
const TOOLS_GPT_5 = [
    'web_search',
    'web_search_preview',
    'code_interpreter',
    'image_generation',
    'file_search',
    'mcp',
];

// GPT-5.4: All tools supported.
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
    'gpt-5.4': TOOLS_GPT_5_4,
    'gpt-4.1': TOOLS_GPT_5,
    'gpt-4.1-mini': TOOLS_GPT_5_MINI,
    'gpt-4.1-nano': TOOLS_GPT_5_MINI,
    'gpt-4o': TOOLS_GPT_5,
    o1: TOOLS_GPT_5,
    'o1-mini': TOOLS_GPT_5_MINI,
    'o1-pro': TOOLS_GPT_5_4,
    o3: TOOLS_GPT_5_4,
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
 * Used to filter the request's tools array before calling the API.
 *
 * @param {string} model - Model id (e.g. 'gpt-5-mini', 'gpt-5.4-2026-03-05')
 * @returns {Set<string>} Allowed built-in tool types
 */
function getSupportedBuiltInToolTypes(model) {
    const family = getModelFamily(model);
    const list = family ? MODEL_FAMILIES[family] : TOOLS_GPT_5_MINI;
    return new Set(list);
}

module.exports = {
    getSupportedBuiltInToolTypes,
    getModelFamily,
};
