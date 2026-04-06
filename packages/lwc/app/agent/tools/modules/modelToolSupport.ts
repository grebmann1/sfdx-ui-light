/**
 * Model-to-built-in-tool support for the OpenAI Responses API (frontend).
 * Used to filter built-in tools by selected model before sending to the API.
 *
 * Source: OpenAI model docs (Responses API tools section per model)
 * - https://developers.openai.com/api/docs/models/gpt-5-mini
 * - https://developers.openai.com/api/docs/models/gpt-5
 * - https://developers.openai.com/api/docs/models/gpt-5.4
 */

import { MODEL_FAMILY_TOOL_TYPES } from '../constants';

function getModelFamily(modelId: string) {
    if (!modelId || typeof modelId !== 'string') return null;
    const id = modelId.trim().toLowerCase();
    if (MODEL_FAMILY_TOOL_TYPES[id]) return id;
    for (const family of Object.keys(MODEL_FAMILY_TOOL_TYPES)) {
        if (id.startsWith(family + '-') || id === family) return family;
    }
    return null;
}

/**
 * Returns the set of built-in tool types allowed for the given model.
 * @param {string} model - Model id (e.g. 'gpt-5-mini', 'gpt-5.2', 'gpt-5.4-2026-03-05')
 * @returns {Set<string>} Allowed built-in tool types
 */
export function getSupportedBuiltInToolTypes(model: string) {
    const family = getModelFamily(model);
    const list =
        family && family in MODEL_FAMILY_TOOL_TYPES
            ? MODEL_FAMILY_TOOL_TYPES[family]
            : MODEL_FAMILY_TOOL_TYPES['gpt-5-mini'];
    return new Set(list);
}

/**
 * Filters an agent's tools array to only include tools supported by the model.
 * Function tools are always kept; built-in tools are filtered by model support.
 * @param {Array} tools - Agent tools array
 * @param {string} model - Model id
 * @returns {Array} Filtered tools array
 */
export function filterToolsByModel(tools, model: string) {
    if (!Array.isArray(tools) || tools.length === 0) return tools;
    const allowed = getSupportedBuiltInToolTypes(model);
    return tools.filter(tool => {
        if (!tool || typeof tool !== 'object') return false;
        if (tool.type === 'function') return true;
        const builtInType = tool.providerData?.type || tool.type;
        if (!builtInType) return false;
        return allowed.has(builtInType);
    });
}
