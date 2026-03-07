/**
 * Default skill definitions per tool category for the AI Assistant.
 * Content is loaded from .SKILL.md files under applications/einstein/agent/tools/skills/.
 * After editing those files, run: node scripts/generate_default_skill_content.js
 */
import { SKILL_CONTENT } from './defaultToolSkillsContent.generated.js';

/** Ordered list of tool ids for stable display (matches default skills order). */
export const DEFAULT_TOOL_SKILL_IDS = [
    'soql', 'apex', 'api', 'connections', 'chrome', 'metadata', 'agent',
];

const DEFINITIONS = {
    soql: { id: 'soql', name: 'SOQL', description: 'Run and display SOQL queries in the toolkit.' },
    apex: { id: 'apex', name: 'Apex', description: 'Edit and execute anonymous Apex with confirmation.' },
    api: { id: 'api', name: 'API', description: 'Run REST calls and manage saved API scripts.' },
    connections: { id: 'connections', name: 'Connections', description: 'List, connect, disconnect, or open Salesforce orgs.' },
    chrome: { id: 'chrome', name: 'Chrome', description: 'Browser automation (screenshots, tabs).' },
    metadata: { id: 'metadata', name: 'Metadata', description: 'Navigate and inspect metadata types and records.' },
    agent: { id: 'agent', name: 'Agent continuation', description: 'Continue multi-step tool runs when the goal is not yet achieved.' },
};

export const DEFAULT_TOOL_SKILLS = Object.fromEntries(
    DEFAULT_TOOL_SKILL_IDS.map((id) => {
        const def = DEFINITIONS[id];
        const content = SKILL_CONTENT[id] ?? '';
        return [id, def ? { ...def, content } : null];
    }).filter(Boolean)
);
