export type SkillScope = 'project' | 'user';
import { SKILL_NAME_PATTERN, SKILL_ROOT_DIR_BY_SCOPE } from '../constants';

type SkillFileSystem = {
    readFile?: (path: string, encoding?: string) => Promise<string>;
    writeFile?: (path: string, content: string, options?: { encoding?: string }) => Promise<void>;
    mkdir?: (path: string, opts?: { recursive?: boolean }) => Promise<void>;
    exists?: (path: string) => Promise<boolean>;
};

type SaveSkillInput = {
    name: string;
    description: string;
    content: string;
    scope?: SkillScope;
    overwrite?: boolean;
};

export function normalizeSkillName(value: string): string {
    return String(value || '').trim();
}

export function getSkillNameError(name: string): string | null {
    if (!name) return 'Skill name is required.';
    if (!SKILL_NAME_PATTERN.test(name)) {
        return 'Skill name must use letters, numbers, hyphens, or underscores.';
    }
    return null;
}

export function resolveSkillRoot(scope?: SkillScope) {
    const resolvedScope: SkillScope = scope === 'user' ? 'user' : 'project';
    const rootDir = SKILL_ROOT_DIR_BY_SCOPE[resolvedScope];
    return { scope: resolvedScope, rootDir };
}

function normalizeText(value: string): string {
    return String(value || '').replace(/\r\n/g, '\n').trim();
}

function formatYamlValue(value: string): string {
    const trimmed = normalizeText(value);
    if (!trimmed) return '""';
    if (trimmed.includes('\n')) {
        const indented = trimmed
            .split('\n')
            .map(line => `  ${line}`)
            .join('\n');
        return `|\n${indented}`;
    }
    if (/[:#]|^\s|\s$/.test(trimmed)) {
        const escaped = trimmed.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        return `"${escaped}"`;
    }
    return trimmed;
}

export function buildSkillMarkdown({ name, description, content }: SaveSkillInput): string {
    const normalizedContent = normalizeText(content);
    const frontmatter = [
        '---',
        `name: ${normalizeText(name)}`,
        `description: ${formatYamlValue(description)}`,
        '---',
        '',
    ].join('\n');
    return `${frontmatter}${normalizedContent}\n`;
}

async function fileExists(fs: SkillFileSystem, path: string): Promise<boolean> {
    if (fs.exists) {
        try {
            return await fs.exists(path);
        } catch {
            return false;
        }
    }
    if (!fs.readFile) return false;
    try {
        await fs.readFile(path, 'utf-8');
        return true;
    } catch {
        return false;
    }
}

export async function saveSkillToFs(fs: SkillFileSystem, input: SaveSkillInput) {
    if (!fs.writeFile || !fs.mkdir) {
        return {
            ok: false,
            error: 'Filesystem does not support write operations.',
        };
    }
    const name = normalizeSkillName(input.name);
    const nameError = getSkillNameError(name);
    if (nameError) {
        return { ok: false, error: nameError };
    }
    const description = normalizeText(input.description);
    if (!description) {
        return { ok: false, error: 'Skill description is required.' };
    }
    const content = normalizeText(input.content);
    if (!content) {
        return { ok: false, error: 'Skill content is required.' };
    }
    const { scope, rootDir } = resolveSkillRoot(input.scope);
    const rootPath = `${rootDir}/${name}`;
    const skillPath = `${rootPath}/SKILL.md`;
    const exists = await fileExists(fs, skillPath);
    if (exists && !input.overwrite) {
        return {
            ok: false,
            error: `Skill already exists: ${skillPath}. Use --overwrite to replace it.`,
        };
    }
    await fs.mkdir(rootPath, { recursive: true });
    await fs.writeFile(skillPath, buildSkillMarkdown({ ...input, name, description, content }));
    return {
        ok: true,
        scope,
        rootDir,
        skillPath,
    };
}
