import { getIndexedDbFileSystem } from 'core/fs';
import LOGGER from 'shared/logger';
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

function joinPath(root: string, child: string) {
    const base = root.endsWith('/') ? root.slice(0, -1) : root;
    const next = child.startsWith('/') ? child.slice(1) : child;
    return `${base}/${next}`;
}

async function loadSkillFromDir(rootDir: string, scope: SkillScope): Promise<DiscoveredSkill | null> {
    const fs = getIndexedDbFileSystem();
    const skillMdPath = joinPath(rootDir, 'SKILL.md');
    try {
        const entry = await fs.getEntry(skillMdPath).catch(() => null);
        if (!entry || entry.type !== 'file') return null;
        const content = await fs.readFile(skillMdPath, 'utf-8');
        const { frontmatter, ok } = extractFrontmatter(content);
        if (!ok) return null;
        const meta = parseSkillFrontmatter(frontmatter);
        const name = meta.name?.trim();
        const description = meta.description?.trim();
        if (!name || !description) return null;
        return {
            name,
            description,
            skillMdPath,
            rootDir,
            scope,
        };
    } catch {
        return null;
    }
}

async function listSkillDirectories(skillsRoot: string): Promise<string[]> {
    const fs = getIndexedDbFileSystem();
    try {
        const entries = await fs.readdirWithFileTypes(skillsRoot).catch(() => []);
        const dirs: string[] = [];
        for (const entry of entries) {
            if (!entry.isDirectory) continue;
            if (entry.name.startsWith('.')) continue;
            dirs.push(joinPath(skillsRoot, entry.name));
        }
        return dirs.sort();
    } catch {
        return [];
    }
}

export async function discoverSkills(): Promise<DiscoveredSkill[]> {
    const byName = new Map<string, DiscoveredSkill>();

    const roots = [
        '/workspace/skills/custom-skills',
        '/workspace/skills',
    ];

    for (const root of roots) {
        const dirs = await listSkillDirectories(root);
        for (const dir of dirs) {
            const scope = 'project';
            const skill = await loadSkillFromDir(dir, scope);
            if (skill) byName.set(skill.name, skill);
        }
    }
    LOGGER.debug('[agent] discovered skills', { skills: [...byName.values()] });

    return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function getSkillCandidatePaths(name: string): Array<{ path: string; scope: SkillScope }> {
    const normalizedName = String(name || '').trim();
    if (!normalizedName) return [];
    return [
        { path: `/workspace/skills/custom-skills/${normalizedName}/SKILL.md`, scope: 'project' },
        { path: `/workspace/skills/${normalizedName}/SKILL.md`, scope: 'project' },
        { path: `/workspace/skills/professional/${normalizedName}/SKILL.md`, scope: 'project' },
        { path: `/workspace/skills/general/${normalizedName}.SKILL.md`, scope: 'project' },
    ];
}

export async function fetchSkillByName(
    name: string
): Promise<(DiscoveredSkill & { content: string }) | null> {
    const fs = getIndexedDbFileSystem();
    const candidates = getSkillCandidatePaths(name);
    for (const candidate of candidates) {
        try {
            const entry = await fs.getEntry(candidate.path).catch(() => null);
            if (!entry || entry.type !== 'file') continue;
            const content = await fs.readFile(candidate.path, 'utf-8');
            const { frontmatter, ok } = extractFrontmatter(content);
            if (!ok) continue;
            const meta = parseSkillFrontmatter(frontmatter);
            const skillName = meta.name?.trim() || name;
            const description = meta.description?.trim() || '';
            const lastSlash = candidate.path.lastIndexOf('/');
            const rootDir = lastSlash > 0 ? candidate.path.slice(0, lastSlash) : candidate.path;
            return {
                name: skillName,
                description,
                skillMdPath: candidate.path,
                rootDir,
                scope: candidate.scope,
                content,
            };
        } catch {
            // Try next candidate.
        }
    }
    return null;
}

const SKILLS_INSTRUCTIONS = `AGENT SKILLS (optional):
The following <available_skills> list specialized workflows. Use them when they might help the user's request — not only on exact keyword matches.
If a skill's description fits the task or could improve consistency, read that skill's instructions first using read_file with the path from <location>, then follow the SKILL.md body.
Paths inside a skill (scripts/, references/, assets/) are relative to the skill directory (the folder containing SKILL.md); prefer absolute paths in tool calls.`;

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

