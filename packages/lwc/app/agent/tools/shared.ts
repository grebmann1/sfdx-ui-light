import { z } from 'zod';
import LOGGER from 'shared/logger';
import { compressImage } from 'shared/utils';
import { ToolResultPart } from 'ai';
import { BashToolOptions, generateBashDescription, registerShellCommands } from './shell';
import { saveSkillToFs } from './skillUtils';
import { discoverSkills, fetchSkillByName } from 'agent/utils';
// -----------------------------------------------------------------------------
// createBashTools: enrich tools when you have shell + fs (e.g. bash instance)
// -----------------------------------------------------------------------------

function createTool(definition) {
    return {
        type: 'function',
        ...definition,
    };
}

function sanitizePathSegment(value, fallback = 'item') {
    const text = String(value || '')
        .trim()
        .replace(/[^a-zA-Z0-9._-]/g, '_');
    return text.length > 0 ? text : fallback;
}

function extensionForMimeType(mimeType, fallback = 'bin') {
    switch (mimeType) {
        case 'image/jpeg':
            return 'jpg';
        case 'image/png':
            return 'png';
        case 'image/webp':
            return 'webp';
        case 'image/gif':
            return 'gif';
        default:
            return fallback;
    }
}

const MAX_TOOL_OUTPUT_CHARS = 30000;
const TAIL_CHARS = 2000;
const TOOL_OUTPUT_DIR = '/tmp/tool-outputs';
const TOOL_OUTPUT_TRUNCATED_MARKER = '[OUTPUT TRUNCATED]';
const PAGE_SIZE = 200;
const SECTION_SEPARATOR = '\n\n';
const SECTION_CONTENT_SEPARATOR = '\n';
const EXISTING_CAP_OUTPUT_SLACK_CHARS = 1024;

function sanitizeToolName(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, '-') || 'tool';
}

function buildCapNotice(path, totalChars) {
    return [
        `${TOOL_OUTPUT_TRUNCATED_MARKER} Full output (${totalChars} chars) saved to ${path}.`,
        'Page through it with bash:',
        `sed -n '1,${PAGE_SIZE}p' "${path}"`,
        `sed -n '${PAGE_SIZE + 1},${PAGE_SIZE * 2}p' "${path}"`,
        `rg "pattern" "${path}"`,
    ].join('\n');
}

function buildHeadSectionHeader(chars) {
    return `[HEAD: first ${chars} chars of output]`;
}

function buildTailSectionHeader() {
    return `[TAIL: last ${TAIL_CHARS} chars of output]`;
}

function buildTruncationSummary(path, totalChars) {
    return `[... TRUNCATED (${totalChars} chars total, saved to ${path}) ...]`;
}

function buildTruncatedText(text, savedPath, notice) {
    const totalLength = text.length;
    const tail = text.slice(-TAIL_CHARS);
    const tailHeader = buildTailSectionHeader();
    const truncationSummary = buildTruncationSummary(savedPath, totalLength);
    const maxHeadLength = headHeaderLength =>
        Math.max(
            0,
            MAX_TOOL_OUTPUT_CHARS -
                tail.length -
                notice.length -
                truncationSummary.length -
                headHeaderLength -
                tailHeader.length -
                SECTION_CONTENT_SEPARATOR.length * 2 -
                SECTION_SEPARATOR.length * 3
        );
    let headLength = maxHeadLength(buildHeadSectionHeader(0));
    for (;;) {
        const next = maxHeadLength(buildHeadSectionHeader(headLength));
        if (next === headLength) break;
        headLength = next;
    }
    let head = text.slice(0, headLength);
    let combined = [
        `${buildHeadSectionHeader(head.length)}${SECTION_CONTENT_SEPARATOR}${head}`,
        truncationSummary,
        `${tailHeader}${SECTION_CONTENT_SEPARATOR}${tail}`,
        notice,
    ].join(SECTION_SEPARATOR);
    if (combined.length > MAX_TOOL_OUTPUT_CHARS) {
        head = head.slice(0, Math.max(0, head.length - (combined.length - MAX_TOOL_OUTPUT_CHARS)));
        combined = [
            `${buildHeadSectionHeader(head.length)}${SECTION_CONTENT_SEPARATOR}${head}`,
            truncationSummary,
            `${tailHeader}${SECTION_CONTENT_SEPARATOR}${tail}`,
            notice,
        ].join(SECTION_SEPARATOR);
    }
    return combined;
}

function containsToolOutputCapNotice(text) {
    return text.includes(TOOL_OUTPUT_TRUNCATED_MARKER);
}

async function capToolOutput(text, toolName, fs) {
    if (text.length <= MAX_TOOL_OUTPUT_CHARS) {
        return { text, wasCapped: false };
    }
    const fileName = `${sanitizeToolName(toolName)}-${Date.now()}.txt`;
    const savedPath = `${TOOL_OUTPUT_DIR}/${fileName}`;
    await fs.mkdir(TOOL_OUTPUT_DIR, { recursive: true });
    await fs.writeFile(savedPath, text, { encoding: 'utf-8' });
    const notice = buildCapNotice(savedPath, text.length);
    return {
        text: buildTruncatedText(text, savedPath, notice),
        wasCapped: true,
        savedPath,
    };
}

export function parseDataUrl(dataUrl) {
    if (typeof dataUrl !== 'string') return null;
    const match = dataUrl.match(/^data:([^;,]+)(;[^,]*)?,(.*)$/);
    if (!match) return null;
    const mediaType = match[1] || 'application/octet-stream';
    const metadata = match[2] || '';
    const payload = match[3] || '';
    const isBase64 = metadata.toLowerCase().includes(';base64');
    if (!isBase64 || !payload) return null;
    return { mediaType, base64: payload };
}

async function persistToolImageDataUrl(fs, dataUrl, conversationId, index) {
    const parsed = parseDataUrl(dataUrl);
    if (!parsed) return null;
    const safeConversationId = sanitizePathSegment(conversationId || 'default');
    const baseDir = `/workspace/.agent-images/${safeConversationId}`;
    try {
        await fs.mkdir(baseDir, { recursive: true });
    } catch (_) {
        // Best effort only.
    }
    const ext = extensionForMimeType(parsed.mediaType, 'bin');
    const filePath = `${baseDir}/${Date.now()}-${index}.${ext}`;
    await fs.writeFile(filePath, parsed.base64, { encoding: 'base64' });
    return filePath;
}
/**
 * Creates enriched bash + readFile + writeFile tools for use when you have a shell and fs.
 * Registers "js" (and optionally "read-pdf") on the shell when opts.execInSandbox / opts.readPdf are provided.
 * @param {{ getCwd: () => string, exec: (cmd: string) => Promise<{ stdout: string, stderr: string, exitCode: number }>, registerCommand: (cmd: { name: string, run: (argv: string[], ctx: object) => Promise<{ stdout: string, stderr: string, exitCode: number }> }) => void }} shell
 * @param {{ readFile: (path: string, encoding?: string) => Promise<string>, writeFile: (path: string, content: string) => Promise<void>, mkdir: (path: string, opts?: { recursive?: boolean }) => Promise<void>, resolvePath: (cwd: string, path: string) => string }} fs
 * @param {{ execInSandbox?: (code: string, timeoutMs?: number) => Promise<{ output: string, hasError: boolean, images: Array<{ data: string, mediaType: string }> }>, readPdf?: (input: { query: string, url?: string, tabId?: number }) => Promise<object>, files?: string[], toolPrompt?: string, extraInstructions?: string }} [opts]
 * @returns {Array<{ name: string, description: string, parameters: object, execute: (args: object) => Promise<object> }>}
 */
export function createBashTools(shell, fs, opts: BashToolOptions = {}) {
    const cwd = shell.getCwd();
    const images = [];
    const consumePendingImages = () => {
        if (images.length === 0) return [];
        const pending = images.splice(0, images.length);
        return pending;
    };

    registerShellCommands({ shell, opts, images });

    const bashDescription = generateBashDescription(cwd, opts);
    const bashParams = z.object({
        command: z.string().describe('The bash command to execute'),
        description: z
            .string()
            .describe('What this command does in max 5 words (e.g., "Listing open browser tabs")'),
    });

    const readFileParams = z.object({ path: z.string().describe('The path to the file to read') });
    const writeFileParams = z.object({
        path: z.string().describe('The path where the file should be written'),
        content: z.string().describe('The content to write'),
    });
    const loadSkillParams = z.object({
        name: z.string().describe('The name of the skill to load (e.g., "flight-booking")'),
    });
    const saveSkillParams = z.object({
        name: z.string().describe('The skill name (folder-safe id, e.g., "flight-booking")'),
        description: z.string().describe('Short summary for the skill frontmatter'),
        content: z.string().describe('Skill body content (without frontmatter)'),
        scope: z.enum(['project', 'user']).optional().describe('Save scope: project or user'),
        overwrite: z.boolean().optional().describe('Overwrite existing skill if true'),
    });
    const discoverSkillsParams = z.object({});
    const fetchSkillParams = z.object({
        name: z.string().describe('The skill name to fetch (e.g., "flight-booking")'),
    });

    return [
        createTool({
            name: 'bash',
            description: bashDescription,
            parameters: bashParams,
            execute: async args => {
                try {
                    LOGGER.debug('[agent:tool:bash] executing command', {
                        command: args.command,
                    });
                    const res = await shell.exec(args.command);
                    const text = [
                        res.stdout ? `stdout:\n${res.stdout}` : '',
                        res.stderr ? `stderr:\n${res.stderr}` : '',
                        `exit code: ${res.exitCode}`,
                    ].filter(Boolean).join('\n\n');
                    const cappedText =
                        containsToolOutputCapNotice(text) &&
                        text.length <= MAX_TOOL_OUTPUT_CHARS + EXISTING_CAP_OUTPUT_SLACK_CHARS
                            ? text
                            : (await capToolOutput(text, 'bash', fs)).text;
                    const pendingImages = consumePendingImages();
                    const compressedImages = (
                        await Promise.all(
                            pendingImages.map(async (image, index) => {
                                try {
                                    const compressedImage = await compressImage(
                                        `data:${image.mediaType || 'image/png'};base64,${image.data}`,
                                        {
                                            scale: 0.7,
                                            quality: 0.8,
                                            format: 'image/jpeg',
                                        }
                                    );
                                    console.log('### compressedImage', compressedImage);
                                    const filePath = await persistToolImageDataUrl(
                                        fs,
                                        compressedImage.dataUrl,
                                        args.conversationId,
                                        index
                                    ).catch(error => {
                                        LOGGER.warn('[agent:tool:bash] failed to persist screenshot', {
                                            conversationId: args.conversationId || null,
                                            message:
                                                error instanceof Error
                                                    ? error.message
                                                    : String(error),
                                        });
                                        return null;
                                    });
                                    return {
                                        type: 'image',
                                        dataUrl: compressedImage.dataUrl,
                                        mediaType: compressedImage.mimeType || 'image/jpeg',
                                        path: filePath,
                                        key: `bash-image-${Date.now()}-${index}`,
                                    };
                                } catch (error) {
                                    LOGGER.warn('[agent:tool:bash] failed to compress screenshot', {
                                        conversationId: args.conversationId || null,
                                        message:
                                            error instanceof Error ? error.message : String(error),
                                    });
                                    return null;
                                }
                            })
                        )
                    ).filter(Boolean);
                    if (pendingImages.length === 0) {
                        return {
                            kind: 'bash_result',
                            isError: false,
                            text: cappedText,
                            stdout: res.stdout || '',
                            stderr: res.stderr || '',
                            exitCode: res.exitCode,
                            images: [],
                            pendingImages: 0,
                        };
                    }
                    return {
                        kind: 'bash_result',
                        isError: false,
                        text: cappedText,
                        stdout: res.stdout || '',
                        stderr: res.stderr || '',
                        exitCode: res.exitCode,
                        images: compressedImages,
                        pendingImages: compressedImages.length,
                    };
                } catch (err) {
                    consumePendingImages();
                    const message = err instanceof Error ? err.message : String(err);
                    LOGGER.debug('[agent:tool:bash] command failed', { message });
                    return {
                        kind: 'bash_result',
                        isError: true,
                        text: `Error: ${message}`,
                        error: message,
                        images: [],
                        pendingImages: 0,
                    };
                }
            },
            toModelOutput:({toolCallId, output, input}) => {
                const toolOutput = {
                    type: 'content',
                    value:[
                        {
                            type: 'text',
                            text: output.text || output.output || output.content || ''
                        },
                        ...(output.images && Array.isArray(output.images) && output.images.length > 0 ? output.images.map(image => ({
                            type: 'image-data',
                            data: parseDataUrl(image.dataUrl)?.base64 || '',
                            mediaType: image.mediaType,
                        })) : []) 
                    ] as ToolResultPart[]
                };
                LOGGER.debug('[agent:tool:bash] tool output', { toolCallId, toolOutput });
                return toolOutput;
            },
        }),
        createTool({
            name: 'readFile',
            description: 'Read the contents of a file from the sandbox.',
            parameters: readFileParams,
            execute: async args => {
                try {
                    const content = await fs.readFile(args.path, 'utf-8');
                    return {
                        kind: 'read_file_result',
                        isError: false,
                        path: args.path,
                        text: content,
                        content,
                    };
                } catch (err) {
                    const message = err instanceof Error ? err.message : String(err);
                    return {
                        kind: 'read_file_result',
                        isError: true,
                        path: args.path,
                        text: `Error reading file: ${message}`,
                        error: message,
                    };
                }
            },
        }),
        createTool({
            name: 'writeFile',
            description:
                'Write content to a file in the sandbox. Creates parent directories if needed.',
            parameters: writeFileParams,
            execute: async args => {
                try {
                    const parent = args.path.substring(0, args.path.lastIndexOf('/'));
                    if (parent) {
                        try {
                            await fs.mkdir(parent, { recursive: true });
                        } catch {
                            // best-effort
                        }
                    }
                    await fs.writeFile(args.path, args.content);
                    return {
                        kind: 'write_file_result',
                        isError: false,
                        path: args.path,
                        text: `Successfully wrote to ${args.path}`,
                    };
                } catch (err) {
                    const message = err instanceof Error ? err.message : String(err);
                    return {
                        kind: 'write_file_result',
                        isError: true,
                        path: args.path,
                        text: `Error writing file: ${message}`,
                        error: message,
                    };
                }
            },
        }),
        createTool({
            name: 'loadSkill',
            description:
                "Load a skill to gain its specialized capabilities. Use this when the task matches a skill's description from the <available_skills> list. Returns the skill instructions and its working directory path.",
            parameters: loadSkillParams,
            execute: async args => {
                const requestedName = args?.name?.trim();
                if (!requestedName) {
                    return {
                        kind: 'load_skill_result',
                        isError: true,
                        skillName: null,
                        text: 'Error: Skill name is required.',
                        error: 'Skill name is required.',
                    };
                }

                const candidatePaths = [
                    `/workspace/skills/custom-skills/${requestedName}/SKILL.md`,
                    `/workspace/.cursor/skills/${requestedName}/SKILL.md`,
                    `/workspace/skills/${requestedName}/SKILL.md`,
                    `/workspace/skills/professional/${requestedName}/SKILL.md`,
                    `/workspace/skills/general/${requestedName}.SKILL.md`,
                ];

                for (const skillPath of candidatePaths) {
                    try {
                        const content = await fs.readFile(skillPath, 'utf-8');
                        const workingDirectory = skillPath.replace(/\/SKILL\.md$/, '');
                        return {
                            kind: 'load_skill_result',
                            isError: false,
                            skillName: requestedName,
                            workingDirectory,
                            content,
                            text: `# Skill Loaded: ${requestedName}\nWorking Directory: ${workingDirectory}\n\n${content}`,
                        };
                    } catch (_) {
                        // Try next candidate path.
                    }
                }

                return {
                    kind: 'load_skill_result',
                    isError: true,
                    skillName: requestedName,
                    text: `Error loading skill "${requestedName}": Skill not found in workspace skills.`,
                    error: 'Skill not found',
                };
            },
        }),
        createTool({
            name: 'saveSkill',
            description:
                'Save a skill as /workspace/skills/custom-skills/<name>/SKILL.md (or /workspace/.cursor/skills for user scope).',
            parameters: saveSkillParams,
            execute: async args => {
                const result = await saveSkillToFs(fs, {
                    name: args?.name,
                    description: args?.description,
                    content: args?.content,
                    scope: args?.scope,
                    overwrite: args?.overwrite,
                });
                if (!result.ok) {
                    return {
                        kind: 'save_skill_result',
                        isError: true,
                        skillName: args?.name || null,
                        text: `Error saving skill: ${result.error}`,
                        error: result.error,
                    };
                }
                return {
                    kind: 'save_skill_result',
                    isError: false,
                    skillName: args?.name,
                    scope: result.scope,
                    path: result.skillPath,
                    text: `Saved skill "${args?.name}" to ${result.skillPath}`,
                };
            },
        }),
        createTool({
            name: 'discoverSkills',
            description:
                'Discover available skills stored under the workspace skills directories.',
            parameters: discoverSkillsParams,
            execute: async () => {
                try {
                    const skills = await discoverSkills();
                    return {
                        kind: 'discover_skills_result',
                        isError: false,
                        skills,
                        text: skills.length
                            ? `Discovered ${skills.length} skills.`
                            : 'No skills discovered.',
                    };
                } catch (err) {
                    const message = err instanceof Error ? err.message : String(err);
                    return {
                        kind: 'discover_skills_result',
                        isError: true,
                        skills: [],
                        text: `Error discovering skills: ${message}`,
                        error: message,
                    };
                }
            },
        }),
        createTool({
            name: 'fetchSkill',
            description:
                'Fetch a specific skill by name, returning its metadata and content.',
            parameters: fetchSkillParams,
            execute: async args => {
                const requestedName = args?.name?.trim();
                if (!requestedName) {
                    return {
                        kind: 'fetch_skill_result',
                        isError: true,
                        skillName: null,
                        text: 'Error: Skill name is required.',
                        error: 'Skill name is required.',
                    };
                }
                const skill = await fetchSkillByName(requestedName);
                if (!skill) {
                    return {
                        kind: 'fetch_skill_result',
                        isError: true,
                        skillName: requestedName,
                        text: `Error fetching skill "${requestedName}": Skill not found.`,
                        error: 'Skill not found',
                    };
                }
                return {
                    kind: 'fetch_skill_result',
                    isError: false,
                    skillName: skill.name,
                    skill,
                    text: `Fetched skill "${skill.name}" from ${skill.skillMdPath}`,
                };
            },
        }),
    ];
}

export const sharedTools = [];
