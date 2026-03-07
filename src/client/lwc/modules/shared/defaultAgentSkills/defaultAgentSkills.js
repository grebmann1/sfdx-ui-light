import { guid } from 'shared/utils';
import { DEFAULT_TOOL_SKILLS, DEFAULT_TOOL_SKILL_IDS } from './defaultToolSkills';

export { DEFAULT_TOOL_SKILLS, DEFAULT_TOOL_SKILL_IDS };

/**
 * Merges cached skills with default skills from files.
 * - Default skills: content always from files (DEFAULT_TOOL_SKILLS); enabled from cache or true.
 * - Custom skills: full object from cache (no defaultToolId).
 */
export function getEffectiveAgentSkills(cachedSkills) {
    const cached = Array.isArray(cachedSkills) ? cachedSkills : [];
    const defaultSkills = DEFAULT_TOOL_SKILL_IDS.map((id) => {
        const def = DEFAULT_TOOL_SKILLS[id];
        if (!def) return null;
        const fromCache = cached.find((s) => s && s.defaultToolId === id);
        return {
            ...def,
            id,
            defaultToolId: id,
            enabled: fromCache !== undefined ? fromCache.enabled !== false : true,
        };
    }).filter(Boolean);
    const customSkills = cached
        .filter((s) => s && s.defaultToolId == null)
        .map((s) => ({
            id: s.id || guid(),
            name: s.name ?? '',
            content: s.content ?? '',
            enabled: s.enabled !== false,
        }));
    return [...defaultSkills, ...customSkills];
}

/**
 * Returns the predefined default skills (content from files, all enabled).
 * Used when cache is empty (first load) or when the user resets to default.
 * Default skills use stable id = defaultToolId so they match getEffectiveAgentSkills.
 */
export function getDefaultAgentSkills() {
    return DEFAULT_TOOL_SKILL_IDS.map((id) => {
        const skill = DEFAULT_TOOL_SKILLS[id];
        return skill
            ? { id, defaultToolId: id, name: skill.name, content: skill.content, enabled: true }
            : null;
    }).filter(Boolean);
}
