import { getIndexedDbFileSystem } from 'core/fs';
import LOGGER from 'shared/logger';
import { SKILLS_ROOT, SKILLS_INSTRUCTIONS } from './constants';

export type SkillScope = 'project' | 'user';

export interface DiscoveredSkill {
    name: string;
    description: string;
    skillMdPath: string;
    rootDir: string;
    scope: SkillScope;
}

function escapeXml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function stripQuotes(input: string): string {
    const value = input.trim();
    if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
    ) {
        return value.slice(1, -1).replace(/\\n/g, '\n');
    }
    return value;
}

function parseSkillFrontmatter(raw: string): { name?: string; description?: string } {
    const lines = raw.split(/\r?\n/);
    const out: { name?: string; description?: string } = {};
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const nameMatch = line.match(/^name:\s*(.*)$/);
        if (nameMatch) {
            out.name = stripQuotes(nameMatch[1].trim());
            continue;
        }
        const descMatch = line.match(/^description:\s*(.*)$/);
        if (descMatch) {
            const rest = descMatch[1].trim();
            if (rest === '|' || rest === '>' || rest === '|-' || rest === '>-') {
                i++;
                const block: string[] = [];
                while (i < lines.length) {
                    const current = lines[i];
                    if (current.match(/^[a-zA-Z0-9_-]+:\s/) && !/^\s/.test(current)) break;
                    if (/^\s/.test(current) || (block.length > 0 && current === '')) {
                        block.push(current.replace(/^\s+/, ''));
                        i++;
                    } else if (block.length > 0) {
                        break;
                    } else {
                        break;
                    }
                }
                i--;
                out.description = block.join('\n').trim();
            } else {
                out.description = stripQuotes(rest);
            }
        }
    }
    return out;
}

function extractFrontmatter(fileContent: string): { frontmatter: string; ok: boolean } {
    const trimmed = fileContent.trimStart();
    if (!trimmed.startsWith('---')) return { frontmatter: '', ok: false };
    const afterFirst = trimmed.slice(3).split(/\r?\n/);
    const restLines = afterFirst.slice(1);
    const end = restLines.findIndex(line => line.trim() === '---');
    if (end < 0) return { frontmatter: '', ok: false };
    return { frontmatter: restLines.slice(0, end).join('\n'), ok: true };
}

function joinPath(root: string, child: string): string {
    const base = root.endsWith('/') ? root.slice(0, -1) : root;
    const next = child.startsWith('/') ? child.slice(1) : child;
    return `${base}/${next}`;
}

// Recursively collects every file whose name ends with "SKILL.md" under dir.
async function findAllSkillFiles(dir: string): Promise<string[]> {
    const fs = getIndexedDbFileSystem();
    const results: string[] = [];
    try {
        const entries = await fs.readdirWithFileTypes(dir).catch(() => []);
        for (const entry of entries) {
            if (entry.name.startsWith('.')) continue;
            const fullPath = joinPath(dir, entry.name);
            if (entry.isDirectory) {
                const nested = await findAllSkillFiles(fullPath);
                results.push(...nested);
            } else if (entry.name.endsWith('SKILL.md')) {
                results.push(fullPath);
            }
        }
    } catch {
        // Directory may not exist yet; silently return empty.
    }
    return results.sort();
}

// Loads skill metadata from any *SKILL.md file path.
async function loadSkillFile(filePath: string, scope: SkillScope): Promise<DiscoveredSkill | null> {
    const fs = getIndexedDbFileSystem();
    try {
        const content = await fs.readFile(filePath, 'utf-8');
        const { frontmatter, ok } = extractFrontmatter(content);
        if (!ok) return null;
        const meta = parseSkillFrontmatter(frontmatter);
        const name = meta.name?.trim();
        const description = meta.description?.trim();
        if (!name || !description) return null;
        const lastSlash = filePath.lastIndexOf('/');
        const rootDir = lastSlash > 0 ? filePath.slice(0, lastSlash) : filePath;
        return { name, description, skillMdPath: filePath, rootDir, scope };
    } catch {
        return null;
    }
}

export async function discoverSkills(): Promise<DiscoveredSkill[]> {
    const byName = new Map<string, DiscoveredSkill>();
    const files = await findAllSkillFiles(SKILLS_ROOT);
    for (const filePath of files) {
        const skill = await loadSkillFile(filePath, 'project');
        if (skill) byName.set(skill.name, skill);
    }
    LOGGER.debug('[agent] discovered skills', { skills: [...byName.values()] });
    return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export async function fetchSkillByName(
    name: string
): Promise<(DiscoveredSkill & { content: string }) | null> {
    const requestedName = String(name || '').trim();
    if (!requestedName) return null;
    const skills = await discoverSkills();
    const found = skills.find(s => s.name === requestedName);
    if (!found) return null;
    const fs = getIndexedDbFileSystem();
    try {
        const content = await fs.readFile(found.skillMdPath, 'utf-8');
        return { ...found, content };
    } catch {
        return null;
    }
}

export function formatSkillsForPrompt(skills: DiscoveredSkill[]): string | null {
    if (skills.length === 0) return null;
    const parts = skills.map(
        skill =>
            `  <skill>\n    <name>${escapeXml(skill.name)}</name>\n    <description>${escapeXml(
                skill.description
            )}</description>\n    <location>${escapeXml(
                skill.skillMdPath
            )}</location>\n  </skill>`
    );
    return `${SKILLS_INSTRUCTIONS}\n\n<available_skills>\n${parts.join('\n')}\n</available_skills>`;
}

