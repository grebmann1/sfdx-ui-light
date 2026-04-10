const MAX_READ_CHARACTERS = 40000;
const MAX_TRUNCATED_READ_BYTES = 100000;
const MAX_FULL_READABLE_FILE_BYTES = 1000000;
const MAX_DIRECTORY_ENTRIES = 200;
const MAX_GLOB_RESULTS = 200;
const MAX_GREP_RESULTS = 100;
const MAX_GREP_PREVIEW_CHARS = 240;
import { stringifyUri } from '../core/agentFormatting';

let openDocumentQueue = Promise.resolve();

function encodeText(text) {
    return new TextEncoder().encode(String(text ?? ''));
}

function getWorkspaceFolders(vscode) {
    return Array.isArray(vscode?.workspace?.workspaceFolders)
        ? vscode.workspace.workspaceFolders
        : [];
}

function getWorkspaceRootUri(vscode) {
    return getWorkspaceFolders(vscode)[0]?.uri || null;
}

function normalizeInputPath(path) {
    return typeof path === 'string' ? path.trim() : '';
}

function expandHomePath(rawPath) {
    // The workbench tools run in a web context, so there is no reliable user
    // home directory to expand. Treat "~" paths as-is.
    return rawPath;
}

function isFileUriPath(rawPath) {
    return rawPath.startsWith('file://');
}

function isAbsoluteFilePath(rawPath) {
    return rawPath.startsWith('/') || rawPath.startsWith('\\\\') || /^[a-zA-Z]:[\\/]/.test(rawPath);
}

function toPathSegments(rawPath) {
    return rawPath.replace(/\\/g, '/').split('/').filter(Boolean);
}

function getDisplayPath(value) {
    if (!value) return '';
    return value.fsPath || value.path || value.toString?.() || String(value);
}

function getWorkspaceFolderForUri(vscode, uri) {
    try {
        return vscode.workspace.getWorkspaceFolder(uri) || null;
    } catch {
        return null;
    }
}

function isNotFoundError(error) {
    if (!error) return false;
    const message = error instanceof Error ? error.message : String(error);
    return /FileNotFound|ENOENT|not found|does not exist/i.test(message);
}

async function safeStat(vscode, uri) {
    try {
        return await vscode.workspace.fs.stat(uri);
    } catch (error) {
        if (isNotFoundError(error)) {
            return null;
        }
        throw error;
    }
}

function getResolvedFileType(vscode, stat) {
    if (!stat) {
        return 'missing';
    }
    if (stat.type === vscode.FileType.Directory) {
        return 'directory';
    }
    if (stat.type === vscode.FileType.File) {
        return 'file';
    }
    if (stat.type === vscode.FileType.SymbolicLink) {
        return 'symbolicLink';
    }
    return 'unknown';
}

async function resolveWorkspacePath(vscode, inputPath, { allowMissing = false } = {}) {
    const rawPath = normalizeInputPath(inputPath);
    if (!rawPath) {
        throw new Error('A file or directory path is required.');
    }

    const expandedPath = expandHomePath(rawPath);
    const workspaceFolders = getWorkspaceFolders(vscode);
    const normalizedSegments = toPathSegments(expandedPath);

    const buildResolvedPath = async (uri, displayPath, isAbsolute) => {
        const stat = await safeStat(vscode, uri);
        const workspaceFolder = getWorkspaceFolderForUri(vscode, uri);
        return {
            rawPath,
            displayPath,
            uri,
            exists: Boolean(stat),
            fileType: getResolvedFileType(vscode, stat),
            stat,
            isDirectory: stat?.type === vscode.FileType.Directory,
            isFile: stat?.type === vscode.FileType.File,
            isWithinWorkspace: Boolean(workspaceFolder),
            workspaceFolderName: workspaceFolder?.name || null,
            workspaceFolderUri: workspaceFolder?.uri || null,
            isAbsolute,
        };
    };

    if (isFileUriPath(expandedPath)) {
        const uri = vscode.Uri.parse(expandedPath);
        return buildResolvedPath(uri, getDisplayPath(uri), true);
    }

    if (isAbsoluteFilePath(expandedPath)) {
        const uri = vscode.Uri.file(expandedPath);
        return buildResolvedPath(uri, expandedPath, true);
    }

    if (workspaceFolders.length === 0) {
        throw new Error('Relative paths require an open workspace folder.');
    }

    const candidates = workspaceFolders.map(folder => ({
        folder,
        uri:
            normalizedSegments.length > 0
                ? vscode.Uri.joinPath(folder.uri, ...normalizedSegments)
                : folder.uri,
    }));

    for (const candidate of candidates) {
        const stat = await safeStat(vscode, candidate.uri);
        if (stat) {
            return {
                rawPath,
                displayPath: rawPath,
                uri: candidate.uri,
                exists: true,
                fileType: getResolvedFileType(vscode, stat),
                stat,
                isDirectory: stat.type === vscode.FileType.Directory,
                isFile: stat.type === vscode.FileType.File,
                isWithinWorkspace: true,
                workspaceFolderName: candidate.folder.name || null,
                workspaceFolderUri: candidate.folder.uri,
                isAbsolute: false,
            };
        }
    }

    if (!allowMissing) {
        return {
            rawPath,
            displayPath: rawPath,
            uri: candidates[0]?.uri || getWorkspaceRootUri(vscode),
            exists: false,
            fileType: 'missing',
            stat: null,
            isDirectory: false,
            isFile: false,
            isWithinWorkspace: true,
            workspaceFolderName: candidates[0]?.folder?.name || null,
            workspaceFolderUri: candidates[0]?.folder?.uri || null,
            isAbsolute: false,
        };
    }

    return {
        rawPath,
        displayPath: rawPath,
        uri: candidates[0]?.uri || getWorkspaceRootUri(vscode),
        exists: false,
        fileType: 'missing',
        stat: null,
        isDirectory: false,
        isFile: false,
        isWithinWorkspace: true,
        workspaceFolderName: candidates[0]?.folder?.name || null,
        workspaceFolderUri: candidates[0]?.folder?.uri || null,
        isAbsolute: false,
    };
}

function requireExistingPath(resolvedPath, label = 'Path') {
    if (!resolvedPath?.exists) {
        throw new Error(
            `${label} "${resolvedPath?.displayPath || resolvedPath?.rawPath || ''}" was not found.`
        );
    }
}

function requireFilePath(resolvedPath) {
    requireExistingPath(resolvedPath, 'File');
    if (!resolvedPath.isFile) {
        throw new Error(`"${resolvedPath.displayPath}" is not a file.`);
    }
}

function requireDirectoryPath(resolvedPath) {
    requireExistingPath(resolvedPath, 'Directory');
    if (!resolvedPath.isDirectory) {
        throw new Error(`"${resolvedPath.displayPath}" is not a directory.`);
    }
}

function findOpenDocument(vscode, uri) {
    return (
        vscode.workspace.textDocuments.find(
            document => document.uri.toString() === uri.toString()
        ) || null
    );
}

async function openResolvedTextDocument(vscode, resolvedPath) {
    const openDocument = findOpenDocument(vscode, resolvedPath.uri);
    if (openDocument) {
        return { document: openDocument, source: 'editor' };
    }
    const document = await vscode.workspace.openTextDocument(resolvedPath.uri);
    return { document, source: 'disk' };
}

function hasExplicitEditRange(input = {}) {
    return (
        Number.isInteger(input.startLine) &&
        Number.isInteger(input.startCharacter) &&
        Number.isInteger(input.endLine) &&
        Number.isInteger(input.endCharacter)
    );
}

function hasPartialEditRange(input = {}) {
    return (
        input.startLine !== undefined ||
        input.startCharacter !== undefined ||
        input.endLine !== undefined ||
        input.endCharacter !== undefined
    );
}

function validateLineNumber(document, line, label) {
    if (!Number.isInteger(line) || line < 0) {
        throw new Error(`${label} must be a zero-based integer greater than or equal to 0.`);
    }
    if (line >= document.lineCount) {
        throw new Error(
            `${label} ${line} is outside the document. Last available line is ${Math.max(
                0,
                document.lineCount - 1
            )}.`
        );
    }
}

function validateCharacter(document, line, character, label) {
    if (!Number.isInteger(character) || character < 0) {
        throw new Error(`${label} must be a zero-based integer greater than or equal to 0.`);
    }
    const maxCharacter = document.lineAt(line).text.length;
    if (character > maxCharacter) {
        throw new Error(
            `${label} ${character} is outside line ${line}. Last available character is ${maxCharacter}.`
        );
    }
}

function buildFullDocumentRange(vscode, document) {
    const lastLine = Math.max(0, document.lineCount - 1);
    const lastCharacter = document.lineAt(lastLine).text.length;
    return new vscode.Range(
        new vscode.Position(0, 0),
        new vscode.Position(lastLine, lastCharacter)
    );
}

function resolveReadLineRange(document, input = {}, options = {}) {
    const hasStart = input.startLine !== undefined;
    const hasEnd = input.endLine !== undefined;
    if (!hasStart && !hasEnd) {
        return null;
    }
    if (!hasStart || !hasEnd) {
        throw new Error('Both startLine and endLine are required when reading a range.');
    }
    validateLineNumber(document, input.startLine, 'startLine');
    const lastLine = Math.max(0, document.lineCount - 1);
    const endLine =
        options.clampEndLineToDocumentEnd === true && Number.isInteger(input.endLine)
            ? Math.min(input.endLine, lastLine)
            : input.endLine;
    validateLineNumber(document, endLine, 'endLine');
    if (endLine < input.startLine) {
        throw new Error(
            `endLine (${endLine}) must be greater than or equal to startLine (${input.startLine}).`
        );
    }
    return {
        startLine: input.startLine,
        endLine,
    };
}

function readDocumentRange(vscode, document, lineRange) {
    if (!lineRange) {
        return document.getText();
    }
    const start = document.lineAt(lineRange.startLine).range.start;
    const end = document.lineAt(lineRange.endLine).rangeIncludingLineBreak.end;
    return document.getText(new vscode.Range(start, end));
}

function buildWorkspaceEditRange(vscode, document, input = {}) {
    if (!hasPartialEditRange(input)) {
        return buildFullDocumentRange(vscode, document);
    }
    if (!hasExplicitEditRange(input)) {
        throw new Error(
            'Explicit workspace edits require startLine, startCharacter, endLine, and endCharacter.'
        );
    }
    validateLineNumber(document, input.startLine, 'startLine');
    validateLineNumber(document, input.endLine, 'endLine');
    validateCharacter(document, input.startLine, input.startCharacter, 'startCharacter');
    validateCharacter(document, input.endLine, input.endCharacter, 'endCharacter');
    if (
        input.endLine < input.startLine ||
        (input.endLine === input.startLine && input.endCharacter < input.startCharacter)
    ) {
        throw new Error(
            'The edit end position must be greater than or equal to the start position.'
        );
    }
    return new vscode.Range(
        new vscode.Position(input.startLine, input.startCharacter),
        new vscode.Position(input.endLine, input.endCharacter)
    );
}

function buildRevealRange(vscode, document, input = {}) {
    const lineRange = resolveReadLineRange(document, input);
    if (!lineRange) {
        return null;
    }
    const endCharacter = document.lineAt(lineRange.endLine).text.length;
    return new vscode.Range(
        new vscode.Position(lineRange.startLine, 0),
        new vscode.Position(lineRange.endLine, endCharacter)
    );
}

function formatReadResultText({ path, lineRange, text, truncated, size, returnedChars, source }) {
    const scope = lineRange ? `lines ${lineRange.startLine}-${lineRange.endLine}` : 'the full file';
    const lines = [`Read ${scope} from ${path}.`, `Source: ${source}.`];
    if (typeof size === 'number') {
        lines.push(`File size: ${size} bytes.`);
    }
    lines.push(`Returned ${returnedChars} characters.`);
    if (truncated) {
        lines.push('The content was truncated. Read a narrower range for more detail.');
    }
    return `${lines.join('\n')}\n\n${text}`;
}

function formatEntries(entries = []) {
    return entries.map(entry => entry.path).join('\n');
}

function formatListResultText(path, entries, truncated) {
    const header = truncated
        ? `Listed the first ${entries.length} entries in ${path}. The result was truncated.`
        : `Listed ${entries.length} entries in ${path}.`;
    const body = entries.length > 0 ? formatEntries(entries) : '(empty directory)';
    return `${header}\n\n${body}`;
}

function formatMatchResultText(toolLabel, matches, truncated) {
    const header = truncated
        ? `${toolLabel} returned the first ${matches.length} matches. The result was truncated.`
        : `${toolLabel} returned ${matches.length} matches.`;
    const body =
        matches.length > 0
            ? matches
                  .map(match =>
                      match.line !== undefined && match.line !== null
                          ? `${match.path}:${match.line}: ${match.preview || ''}`
                          : match.path
                  )
                  .join('\n')
            : '(no matches)';
    return `${header}\n\n${body}`;
}

function getParentUri(uri) {
    const parts = (uri.path || '').split('/');
    parts.pop();
    const nextPath = parts.join('/') || '/';
    return uri.with({ path: nextPath });
}

function getExistingViewColumn(vscode, uri) {
    for (const editor of vscode.window.visibleTextEditors || []) {
        if (editor?.document?.uri?.toString() === uri.toString()) {
            return editor.viewColumn;
        }
    }
    return vscode.ViewColumn.One;
}

async function showTextDocument(vscode, uri, range, preview = false) {
    const run = async () => {
        const document = await vscode.workspace.openTextDocument(uri);
        const editor = await vscode.window.showTextDocument(document, {
            viewColumn: getExistingViewColumn(vscode, uri),
            preview,
        });
        if (range) {
            editor.selection = new vscode.Selection(range.start, range.end);
            editor.revealRange(range);
        }
        return editor;
    };
    const pending = openDocumentQueue.then(run, run);
    openDocumentQueue = pending.then(
        () => undefined,
        () => undefined
    );
    return pending;
}

function coerceMaxResults(value, fallback, maxAllowed) {
    if (!Number.isInteger(value) || value <= 0) {
        return fallback;
    }
    return Math.min(value, maxAllowed);
}

async function walkDirectory(
    vscode,
    rootUri,
    { recursive = false, maxResults = MAX_DIRECTORY_ENTRIES }
) {
    const results = [];
    const queue = [{ uri: rootUri, relativePath: '' }];
    let truncated = false;

    while (queue.length > 0) {
        const current = queue.shift();
        const entries = await vscode.workspace.fs.readDirectory(current.uri);
        entries.sort((left, right) => left[0].localeCompare(right[0]));

        for (const [name, type] of entries) {
            const relativePath = current.relativePath ? `${current.relativePath}/${name}` : name;
            const isDirectory = type === vscode.FileType.Directory;
            results.push({
                name,
                path: isDirectory ? `${relativePath}/` : relativePath,
                fileType: isDirectory ? 'directory' : 'file',
            });

            if (results.length >= maxResults) {
                truncated = true;
                break;
            }

            if (recursive && isDirectory) {
                queue.push({
                    uri: vscode.Uri.joinPath(current.uri, name),
                    relativePath,
                });
            }
        }

        if (truncated) {
            break;
        }
    }

    return {
        entries: results,
        truncated,
    };
}

function toArray(value) {
    if (Array.isArray(value)) {
        return value;
    }
    return value ? [value] : [];
}

function trimPreviewText(value) {
    const text = typeof value === 'string' ? value : String(value ?? '');
    if (text.length <= MAX_GREP_PREVIEW_CHARS) {
        return text;
    }
    return `${text.slice(0, MAX_GREP_PREVIEW_CHARS)}...`;
}

function buildSearchPattern(vscode, resolvedPath, fallbackPattern) {
    if (!resolvedPath) {
        return fallbackPattern;
    }
    if (resolvedPath.isDirectory) {
        return new vscode.RelativePattern(resolvedPath.uri, fallbackPattern);
    }
    return new vscode.RelativePattern(
        getParentUri(resolvedPath.uri),
        resolvedPath.uri.path.split('/').pop()
    );
}

function describeResolvedPath(resolvedPath) {
    const location = resolvedPath?.isWithinWorkspace ? 'workspace' : 'outside the workspace';
    const fileType = resolvedPath?.fileType || 'path';
    return `${
        resolvedPath?.displayPath || resolvedPath?.rawPath || 'the target path'
    } (${fileType}, ${location})`;
}

async function buildPathAwareConfirmation(vscode, options, builder) {
    const input = options?.input || {};
    const rawPath = normalizeInputPath(input.path);
    if (!rawPath) {
        return undefined;
    }
    const resolvedPath = await resolveWorkspacePath(vscode, rawPath, { allowMissing: true }).catch(
        () => null
    );
    if (!resolvedPath) {
        return undefined;
    }
    return builder(resolvedPath, input);
}

function buildReadConfirmation(vscode, resolvedPath) {
    if (resolvedPath.isWithinWorkspace) {
        return undefined;
    }
    return {
        title: vscode.l10n.t('Read path outside workspace'),
        message: new vscode.MarkdownString(
            `AI wants to read ${describeResolvedPath(resolvedPath)}.`
        ),
    };
}

function buildEditConfirmation(vscode, resolvedPath, input) {
    const isFullReplacement = !hasPartialEditRange(input);
    if (!resolvedPath.isWithinWorkspace || isFullReplacement) {
        return {
            title: vscode.l10n.t('Edit workspace file'),
            message: new vscode.MarkdownString(
                !resolvedPath.isWithinWorkspace
                    ? `AI wants to edit ${describeResolvedPath(resolvedPath)}.`
                    : `AI wants to replace the full contents of \`${resolvedPath.displayPath}\`.`
            ),
        };
    }
    return undefined;
}

function buildCreateConfirmation(vscode, resolvedPath) {
    return {
        title: vscode.l10n.t('Create workspace file'),
        message: new vscode.MarkdownString(
            `AI wants to create \`${resolvedPath.displayPath}\`${
                resolvedPath.isWithinWorkspace ? '' : ' outside the workspace'
            }.`
        ),
    };
}

function buildDeleteConfirmation(vscode, resolvedPath, input) {
    const isRecursive = input?.recursive === true;
    const targetLabel = resolvedPath.isDirectory ? 'directory' : 'file';
    return {
        title: vscode.l10n.t('Delete workspace path'),
        message: new vscode.MarkdownString(
            isRecursive
                ? `AI wants to recursively delete the ${targetLabel} \`${resolvedPath.displayPath}\`.`
                : `AI wants to delete the ${targetLabel} \`${resolvedPath.displayPath}\`.`
        ),
    };
}

function createTool({ name, description, parameters, execute, prepareInvocation }) {
    return {
        name,
        description,
        parameters,
        execute,
        prepareInvocation,
    };
}

export const VSCODE_FILE_TOOL_DEFINITIONS = [
    {
        name: 'listWorkspaceDirectory',
        toolReferenceName: 'listWorkspaceDirectory',
        displayName: 'List Workspace Directory',
        userDescription: 'List files and folders in a workspace directory.',
        modelDescription:
            'Use this tool to inspect directories before reading or editing files. Supports recursive listing.',
        canBeReferencedInPrompt: true,
        inputSchema: {
            type: 'object',
            properties: {
                path: { type: 'string' },
                recursive: { type: 'boolean' },
                maxResults: { type: 'number' },
            },
            additionalProperties: false,
        },
    },
    {
        name: 'globWorkspaceFiles',
        toolReferenceName: 'globWorkspaceFiles',
        displayName: 'Glob Workspace Files',
        userDescription: 'Find workspace files by glob pattern.',
        modelDescription:
            'Use this tool to search the workspace by filename pattern before opening or editing files.',
        canBeReferencedInPrompt: true,
        inputSchema: {
            type: 'object',
            properties: {
                pattern: { type: 'string' },
                basePath: { type: 'string' },
                excludePattern: { type: 'string' },
                maxResults: { type: 'number' },
            },
            required: ['pattern'],
            additionalProperties: false,
        },
    },
    {
        name: 'grepWorkspaceFiles',
        toolReferenceName: 'grepWorkspaceFiles',
        displayName: 'Grep Workspace Files',
        userDescription: 'Search workspace files for matching text.',
        modelDescription:
            'Use this tool to find matching text before reading or editing a specific file.',
        canBeReferencedInPrompt: true,
        inputSchema: {
            type: 'object',
            properties: {
                query: { type: 'string' },
                basePath: { type: 'string' },
                includePattern: { type: 'string' },
                excludePattern: { type: 'string' },
                isCaseSensitive: { type: 'boolean' },
                isRegExp: { type: 'boolean' },
                isWordMatch: { type: 'boolean' },
                maxResults: { type: 'number' },
            },
            required: ['query'],
            additionalProperties: false,
        },
    },
    {
        name: 'workspacePathExists',
        toolReferenceName: 'workspacePathExists',
        displayName: 'Workspace Path Exists',
        userDescription: 'Check whether a file or directory exists.',
        modelDescription:
            'Use this tool to verify a path before creating, editing, or deleting it.',
        canBeReferencedInPrompt: true,
        inputSchema: {
            type: 'object',
            properties: {
                path: { type: 'string' },
            },
            required: ['path'],
            additionalProperties: false,
        },
    },
    {
        name: 'statWorkspacePath',
        toolReferenceName: 'statWorkspacePath',
        displayName: 'Stat Workspace Path',
        userDescription: 'Read metadata for a file or directory.',
        modelDescription:
            'Use this tool to inspect whether a path is a file or directory and get size metadata.',
        canBeReferencedInPrompt: true,
        inputSchema: {
            type: 'object',
            properties: {
                path: { type: 'string' },
            },
            required: ['path'],
            additionalProperties: false,
        },
    },
    {
        name: 'readWorkspaceFile',
        toolReferenceName: 'readWorkspaceFile',
        displayName: 'Read Workspace File',
        userDescription: 'Read a workspace file, optionally by zero-based line range.',
        modelDescription:
            'Use this tool to read a workspace file by path. Prefer line ranges for large files.',
        canBeReferencedInPrompt: true,
        inputSchema: {
            type: 'object',
            properties: {
                path: { type: 'string' },
                startLine: { type: 'number' },
                endLine: { type: 'number' },
            },
            required: ['path'],
            additionalProperties: false,
        },
    },
    {
        name: 'openWorkspaceFile',
        toolReferenceName: 'openWorkspaceFile',
        displayName: 'Open Workspace File',
        userDescription: 'Open a file in the editor and optionally reveal a line range.',
        modelDescription:
            'Use this tool to open a file in VS Code and optionally reveal a specific line range.',
        canBeReferencedInPrompt: true,
        inputSchema: {
            type: 'object',
            properties: {
                path: { type: 'string' },
                startLine: { type: 'number' },
                endLine: { type: 'number' },
                preview: { type: 'boolean' },
            },
            required: ['path'],
            additionalProperties: false,
        },
    },
    {
        name: 'showWorkspaceLines',
        toolReferenceName: 'showWorkspaceLines',
        displayName: 'Show Workspace Lines',
        userDescription: 'Open a file and reveal a specific zero-based line range.',
        modelDescription:
            'Use this tool to navigate the editor to a specific line range in a file.',
        canBeReferencedInPrompt: true,
        inputSchema: {
            type: 'object',
            properties: {
                path: { type: 'string' },
                startLine: { type: 'number' },
                endLine: { type: 'number' },
                preview: { type: 'boolean' },
            },
            required: ['path', 'startLine', 'endLine'],
            additionalProperties: false,
        },
    },
    {
        name: 'createWorkspaceFile',
        toolReferenceName: 'createWorkspaceFile',
        displayName: 'Create Workspace File',
        userDescription: 'Create a new file in the workspace or by absolute path.',
        modelDescription:
            'Use this tool when a new file should be created. Do not use it for editing an existing file.',
        canBeReferencedInPrompt: true,
        inputSchema: {
            type: 'object',
            properties: {
                path: { type: 'string' },
                content: { type: 'string' },
                overwrite: { type: 'boolean' },
            },
            required: ['path', 'content'],
            additionalProperties: false,
        },
    },
    {
        name: 'editWorkspaceFile',
        toolReferenceName: 'editWorkspaceFile',
        displayName: 'Edit Workspace File',
        userDescription: 'Edit a workspace file by path, optionally targeting an explicit range.',
        modelDescription:
            'Use this tool to edit an existing file. Provide a zero-based range to target a specific section, otherwise the whole file is replaced.',
        canBeReferencedInPrompt: true,
        inputSchema: {
            type: 'object',
            properties: {
                path: { type: 'string' },
                content: { type: 'string' },
                startLine: { type: 'number' },
                startCharacter: { type: 'number' },
                endLine: { type: 'number' },
                endCharacter: { type: 'number' },
                save: { type: 'boolean' },
            },
            required: ['path', 'content'],
            additionalProperties: false,
        },
    },
    {
        name: 'saveWorkspaceFile',
        toolReferenceName: 'saveWorkspaceFile',
        displayName: 'Save Workspace File',
        userDescription: 'Save a file in VS Code.',
        modelDescription:
            'Use this tool when you need to make sure a workspace file has been saved after editing.',
        canBeReferencedInPrompt: true,
        inputSchema: {
            type: 'object',
            properties: {
                path: { type: 'string' },
            },
            required: ['path'],
            additionalProperties: false,
        },
    },
    {
        name: 'deleteWorkspaceFile',
        toolReferenceName: 'deleteWorkspaceFile',
        displayName: 'Delete Workspace File',
        userDescription: 'Delete a workspace file or directory by path.',
        modelDescription:
            'Use this tool to delete a file or directory by path. Deleting directories requires recursive true.',
        canBeReferencedInPrompt: true,
        inputSchema: {
            type: 'object',
            properties: {
                path: { type: 'string' },
                recursive: { type: 'boolean' },
            },
            required: ['path'],
            additionalProperties: false,
        },
    },
];

export function createWorkspaceFileTools(vscode) {
    return [
        createTool({
            name: 'listWorkspaceDirectory',
            description: 'List files and folders in a directory. Supports recursive listing.',
            parameters: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description: 'Directory path to inspect. Defaults to the workspace root.',
                    },
                    recursive: {
                        type: 'boolean',
                        description: 'List nested directories recursively when true.',
                    },
                    maxResults: {
                        type: 'number',
                        description: `Maximum number of entries to return. Defaults to ${MAX_DIRECTORY_ENTRIES}.`,
                    },
                },
                additionalProperties: false,
            },
            execute: async input => {
                try {
                    const path = normalizeInputPath(input?.path) || '.';
                    if (
                        !normalizeInputPath(input?.path) &&
                        getWorkspaceFolders(vscode).length > 1
                    ) {
                        const entries = getWorkspaceFolders(vscode).map(folder => ({
                            name: folder.name,
                            path: `${folder.name}/`,
                            fileType: 'directory',
                        }));
                        return {
                            isError: false,
                            path: '.',
                            truncated: false,
                            entries,
                            text: formatListResultText('the workspace roots', entries, false),
                        };
                    }
                    const resolvedPath = await resolveWorkspacePath(vscode, path);
                    requireDirectoryPath(resolvedPath);
                    const maxResults = coerceMaxResults(
                        input?.maxResults,
                        MAX_DIRECTORY_ENTRIES,
                        MAX_DIRECTORY_ENTRIES
                    );
                    const result = await walkDirectory(vscode, resolvedPath.uri, {
                        recursive: input?.recursive === true,
                        maxResults,
                    });
                    return {
                        isError: false,
                        path: stringifyUri(resolvedPath.uri),
                        truncated: result.truncated,
                        entries: result.entries,
                        text: formatListResultText(
                            resolvedPath.displayPath,
                            result.entries,
                            result.truncated
                        ),
                    };
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    return {
                        isError: true,
                        error: message,
                        text: `Unable to list the directory: ${message}`,
                    };
                }
            },
        }),
        createTool({
            name: 'globWorkspaceFiles',
            description: 'Find files in the workspace by glob pattern.',
            parameters: {
                type: 'object',
                properties: {
                    pattern: {
                        type: 'string',
                        description: 'Glob pattern to search for, such as **/*.js.',
                    },
                    basePath: {
                        type: 'string',
                        description:
                            'Optional directory path used as the base for the glob search.',
                    },
                    excludePattern: {
                        type: 'string',
                        description: 'Optional exclusion glob pattern.',
                    },
                    maxResults: {
                        type: 'number',
                        description: `Maximum number of matches to return. Defaults to ${MAX_GLOB_RESULTS}.`,
                    },
                },
                required: ['pattern'],
                additionalProperties: false,
            },
            execute: async input => {
                try {
                    const pattern = normalizeInputPath(input?.pattern);
                    if (!pattern) {
                        throw new Error('A glob pattern is required.');
                    }
                    const maxResults = coerceMaxResults(
                        input?.maxResults,
                        MAX_GLOB_RESULTS,
                        MAX_GLOB_RESULTS
                    );
                    const basePath = normalizeInputPath(input?.basePath);
                    const resolvedBasePath = basePath
                        ? await resolveWorkspacePath(vscode, basePath)
                        : null;
                    if (resolvedBasePath) {
                        requireDirectoryPath(resolvedBasePath);
                    }
                    const includePattern = resolvedBasePath
                        ? new vscode.RelativePattern(resolvedBasePath.uri, pattern)
                        : pattern;
                    const matches = await vscode.workspace.findFiles(
                        includePattern,
                        normalizeInputPath(input?.excludePattern) || undefined,
                        maxResults
                    );
                    const entries = matches.map(uri => ({
                        path: stringifyUri(uri),
                    }));
                    return {
                        isError: false,
                        truncated: entries.length >= maxResults,
                        matches: entries,
                        text: formatMatchResultText(
                            'Glob search',
                            entries,
                            entries.length >= maxResults
                        ),
                    };
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    return {
                        isError: true,
                        error: message,
                        text: `Unable to glob workspace files: ${message}`,
                    };
                }
            },
        }),
        createTool({
            name: 'grepWorkspaceFiles',
            description: 'Search workspace files for matching text.',
            parameters: {
                type: 'object',
                properties: {
                    query: {
                        type: 'string',
                        description: 'Text or regular expression pattern to search for.',
                    },
                    basePath: {
                        type: 'string',
                        description: 'Optional base directory to narrow the search.',
                    },
                    includePattern: {
                        type: 'string',
                        description: 'Optional glob include pattern.',
                    },
                    excludePattern: {
                        type: 'string',
                        description: 'Optional glob exclude pattern.',
                    },
                    isCaseSensitive: {
                        type: 'boolean',
                    },
                    isRegExp: {
                        type: 'boolean',
                    },
                    isWordMatch: {
                        type: 'boolean',
                    },
                    maxResults: {
                        type: 'number',
                        description: `Maximum number of matches to return. Defaults to ${MAX_GREP_RESULTS}.`,
                    },
                },
                required: ['query'],
                additionalProperties: false,
            },
            execute: async input => {
                try {
                    const query = normalizeInputPath(input?.query);
                    if (!query) {
                        throw new Error('A search query is required.');
                    }
                    const maxResults = coerceMaxResults(
                        input?.maxResults,
                        MAX_GREP_RESULTS,
                        MAX_GREP_RESULTS
                    );
                    const basePath = normalizeInputPath(input?.basePath);
                    const resolvedBasePath = basePath
                        ? await resolveWorkspacePath(vscode, basePath)
                        : null;
                    if (resolvedBasePath) {
                        requireDirectoryPath(resolvedBasePath);
                    }
                    const matches = [];
                    await vscode.workspace.findTextInFiles(
                        {
                            pattern: query,
                            isCaseSensitive: input?.isCaseSensitive === true,
                            isRegExp: input?.isRegExp === true,
                            isWordMatch: input?.isWordMatch === true,
                        },
                        {
                            include: buildSearchPattern(
                                vscode,
                                resolvedBasePath,
                                normalizeInputPath(input?.includePattern) || '**/*'
                            ),
                            exclude: normalizeInputPath(input?.excludePattern) || undefined,
                            maxResults,
                        },
                        result => {
                            const range =
                                toArray(result?.ranges)[0] || toArray(result?.preview?.matches)[0];
                            matches.push({
                                path: stringifyUri(result?.uri),
                                line: range?.start?.line,
                                preview: trimPreviewText(result?.preview?.text || ''),
                            });
                        }
                    );
                    return {
                        isError: false,
                        truncated: matches.length >= maxResults,
                        matches,
                        text: formatMatchResultText(
                            'Text search',
                            matches,
                            matches.length >= maxResults
                        ),
                    };
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    return {
                        isError: true,
                        error: message,
                        text: `Unable to search workspace files: ${message}`,
                    };
                }
            },
        }),
        createTool({
            name: 'workspacePathExists',
            description: 'Check whether a file or directory exists.',
            parameters: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description: 'Path to verify.',
                    },
                },
                required: ['path'],
                additionalProperties: false,
            },
            execute: async input => {
                try {
                    const resolvedPath = await resolveWorkspacePath(vscode, input?.path, {
                        allowMissing: true,
                    });
                    return {
                        isError: false,
                        path: stringifyUri(resolvedPath.uri),
                        exists: resolvedPath.exists,
                        fileType: resolvedPath.fileType,
                        isWithinWorkspace: resolvedPath.isWithinWorkspace,
                        text: resolvedPath.exists
                            ? `${resolvedPath.displayPath} exists as a ${resolvedPath.fileType}.`
                            : `${resolvedPath.displayPath} does not exist.`,
                    };
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    return {
                        isError: true,
                        error: message,
                        text: `Unable to check the path: ${message}`,
                    };
                }
            },
        }),
        createTool({
            name: 'statWorkspacePath',
            description: 'Read metadata for a file or directory.',
            parameters: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description: 'Path to inspect.',
                    },
                },
                required: ['path'],
                additionalProperties: false,
            },
            execute: async input => {
                try {
                    const resolvedPath = await resolveWorkspacePath(vscode, input?.path, {
                        allowMissing: true,
                    });
                    return {
                        isError: false,
                        path: stringifyUri(resolvedPath.uri),
                        exists: resolvedPath.exists,
                        fileType: resolvedPath.fileType,
                        size: resolvedPath.stat?.size ?? null,
                        mtime: resolvedPath.stat?.mtime ?? null,
                        isWithinWorkspace: resolvedPath.isWithinWorkspace,
                        text: resolvedPath.exists
                            ? `${resolvedPath.displayPath} is a ${resolvedPath.fileType} with size ${
                                  resolvedPath.stat?.size ?? 0
                              } bytes.`
                            : `${resolvedPath.displayPath} does not exist.`,
                    };
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    return {
                        isError: true,
                        error: message,
                        text: `Unable to stat the path: ${message}`,
                    };
                }
            },
            prepareInvocation: async options =>
                buildPathAwareConfirmation(vscode, options, resolvedPath =>
                    buildReadConfirmation(vscode, resolvedPath)
                ),
        }),
        createTool({
            name: 'readWorkspaceFile',
            description:
                'Read a workspace file by path. Provide startLine and endLine for targeted reads.',
            parameters: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description:
                            'Absolute path, file URI, tilde path, or workspace-relative path.',
                    },
                    startLine: {
                        type: 'number',
                        description: 'Optional zero-based first line to read.',
                    },
                    endLine: {
                        type: 'number',
                        description: 'Optional zero-based last line to read.',
                    },
                },
                required: ['path'],
                additionalProperties: false,
            },
            execute: async input => {
                try {
                    const resolvedPath = await resolveWorkspacePath(vscode, input?.path);
                    requireFilePath(resolvedPath);
                    const { document, source } = await openResolvedTextDocument(
                        vscode,
                        resolvedPath
                    );
                    const lineRange = resolveReadLineRange(document, input, {
                        clampEndLineToDocumentEnd: true,
                    });
                    const fullText = readDocumentRange(vscode, document, lineRange);
                    const size = resolvedPath.stat?.size ?? encodeText(fullText).length;
                    if (!lineRange && size > MAX_FULL_READABLE_FILE_BYTES) {
                        throw new Error(
                            `"${resolvedPath.displayPath}" is too large to read fully (${size} bytes). Read a narrower line range instead.`
                        );
                    }
                    let text = fullText;
                    let truncated = false;
                    if (!lineRange) {
                        const byteLength = encodeText(fullText).length;
                        if (
                            byteLength > MAX_TRUNCATED_READ_BYTES ||
                            fullText.length > MAX_READ_CHARACTERS
                        ) {
                            text = fullText.slice(0, MAX_READ_CHARACTERS);
                            truncated = true;
                        }
                    }
                    return {
                        isError: false,
                        path: stringifyUri(document.uri),
                        startLine: lineRange?.startLine ?? null,
                        endLine: lineRange?.endLine ?? null,
                        size,
                        source,
                        truncated,
                        returnedChars: text.length,
                        text: formatReadResultText({
                            path: resolvedPath.displayPath,
                            lineRange,
                            text,
                            truncated,
                            size,
                            returnedChars: text.length,
                            source,
                        }),
                    };
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    return {
                        isError: true,
                        error: message,
                        text: `Unable to read the file: ${message}`,
                    };
                }
            },
            prepareInvocation: async options =>
                buildPathAwareConfirmation(vscode, options, resolvedPath =>
                    buildReadConfirmation(vscode, resolvedPath)
                ),
        }),
        createTool({
            name: 'openWorkspaceFile',
            description: 'Open a file in VS Code and optionally reveal a line range.',
            parameters: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description: 'Path to open.',
                    },
                    startLine: {
                        type: 'number',
                    },
                    endLine: {
                        type: 'number',
                    },
                    preview: {
                        type: 'boolean',
                    },
                },
                required: ['path'],
                additionalProperties: false,
            },
            execute: async input => {
                try {
                    const resolvedPath = await resolveWorkspacePath(vscode, input?.path);
                    requireFilePath(resolvedPath);
                    const { document } = await openResolvedTextDocument(vscode, resolvedPath);
                    const range = buildRevealRange(vscode, document, input);
                    await showTextDocument(
                        vscode,
                        resolvedPath.uri,
                        range,
                        input?.preview === true
                    );
                    return {
                        isError: false,
                        path: stringifyUri(resolvedPath.uri),
                        startLine: range?.start?.line ?? null,
                        endLine: range?.end?.line ?? null,
                        text: range
                            ? `Opened ${resolvedPath.displayPath} and revealed lines ${range.start.line}-${range.end.line}.`
                            : `Opened ${resolvedPath.displayPath}.`,
                    };
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    return {
                        isError: true,
                        error: message,
                        text: `Unable to open the file: ${message}`,
                    };
                }
            },
        }),
        createTool({
            name: 'showWorkspaceLines',
            description: 'Open a file and reveal a specific zero-based line range.',
            parameters: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description: 'Path to open.',
                    },
                    startLine: {
                        type: 'number',
                    },
                    endLine: {
                        type: 'number',
                    },
                    preview: {
                        type: 'boolean',
                    },
                },
                required: ['path', 'startLine', 'endLine'],
                additionalProperties: false,
            },
            execute: async input => {
                try {
                    const resolvedPath = await resolveWorkspacePath(vscode, input?.path);
                    requireFilePath(resolvedPath);
                    const { document } = await openResolvedTextDocument(vscode, resolvedPath);
                    const range = buildRevealRange(vscode, document, input);
                    if (!range) {
                        throw new Error('startLine and endLine are required.');
                    }
                    await showTextDocument(
                        vscode,
                        resolvedPath.uri,
                        range,
                        input?.preview === true
                    );
                    return {
                        isError: false,
                        path: stringifyUri(resolvedPath.uri),
                        startLine: range.start.line,
                        endLine: range.end.line,
                        text: `Opened ${resolvedPath.displayPath} and revealed lines ${range.start.line}-${range.end.line}.`,
                    };
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    return {
                        isError: true,
                        error: message,
                        text: `Unable to reveal the file range: ${message}`,
                    };
                }
            },
        }),
        createTool({
            name: 'createWorkspaceFile',
            description: 'Create a new file.',
            parameters: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description: 'Path where the new file should be written.',
                    },
                    content: {
                        type: 'string',
                        description: 'Contents for the new file.',
                    },
                    overwrite: {
                        type: 'boolean',
                        description: 'Overwrite the target when it already exists.',
                    },
                },
                required: ['path', 'content'],
                additionalProperties: false,
            },
            execute: async input => {
                try {
                    const resolvedPath = await resolveWorkspacePath(vscode, input?.path, {
                        allowMissing: true,
                    });
                    if (resolvedPath.exists && input?.overwrite !== true) {
                        throw new Error(
                            `"${resolvedPath.displayPath}" already exists. Set overwrite to true or edit the file instead.`
                        );
                    }
                    if (resolvedPath.exists && resolvedPath.isDirectory) {
                        throw new Error(`"${resolvedPath.displayPath}" is a directory.`);
                    }
                    await vscode.workspace.fs.createDirectory(getParentUri(resolvedPath.uri));
                    await vscode.workspace.fs.writeFile(
                        resolvedPath.uri,
                        encodeText(input?.content || '')
                    );
                    return {
                        isError: false,
                        path: stringifyUri(resolvedPath.uri),
                        created: true,
                        overwritten: resolvedPath.exists,
                        text: `Created ${resolvedPath.displayPath}${
                            resolvedPath.exists ? ' by overwriting the existing file' : ''
                        }.`,
                    };
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    return {
                        isError: true,
                        error: message,
                        text: `Unable to create the file: ${message}`,
                    };
                }
            },
            prepareInvocation: async options =>
                buildPathAwareConfirmation(vscode, options, resolvedPath =>
                    buildCreateConfirmation(vscode, resolvedPath)
                ),
        }),
        createTool({
            name: 'editWorkspaceFile',
            description:
                'Edit an existing file. Provide a zero-based range to target a section, otherwise the whole file is replaced.',
            parameters: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description: 'Path to edit.',
                    },
                    content: {
                        type: 'string',
                        description: 'Replacement text for the target range.',
                    },
                    startLine: { type: 'number' },
                    startCharacter: { type: 'number' },
                    endLine: { type: 'number' },
                    endCharacter: { type: 'number' },
                    save: {
                        type: 'boolean',
                        description: 'Save the document after editing. Defaults to true.',
                    },
                },
                required: ['path', 'content'],
                additionalProperties: false,
            },
            execute: async input => {
                try {
                    const resolvedPath = await resolveWorkspacePath(vscode, input?.path);
                    requireFilePath(resolvedPath);
                    const { document } = await openResolvedTextDocument(vscode, resolvedPath);
                    const range = buildWorkspaceEditRange(vscode, document, input);
                    const edit = new vscode.WorkspaceEdit();
                    edit.replace(resolvedPath.uri, range, String(input?.content ?? ''));
                    const applied = await vscode.workspace.applyEdit(edit);
                    if (!applied) {
                        return {
                            isError: true,
                            applied: false,
                            saved: false,
                            path: stringifyUri(resolvedPath.uri),
                            text: `VS Code rejected the edit for ${resolvedPath.displayPath}.`,
                        };
                    }

                    let saved = false;
                    let saveError = null;
                    if (input?.save !== false) {
                        try {
                            const updatedDocument =
                                findOpenDocument(vscode, resolvedPath.uri) || document;
                            saved = (await updatedDocument.save?.()) === true;
                        } catch (error) {
                            saveError = error instanceof Error ? error.message : String(error);
                        }
                    }

                    return {
                        isError: false,
                        applied: true,
                        saved,
                        saveError,
                        path: stringifyUri(resolvedPath.uri),
                        range: {
                            startLine: range.start.line,
                            startCharacter: range.start.character,
                            endLine: range.end.line,
                            endCharacter: range.end.character,
                        },
                        text:
                            saveError || (!saved && input?.save !== false)
                                ? `Applied an edit to ${resolvedPath.displayPath}, but VS Code could not save it automatically.${
                                      saveError ? ` ${saveError}` : ''
                                  }`
                                : `Applied an edit to ${resolvedPath.displayPath}${
                                      input?.save === false
                                          ? ' without saving the file'
                                          : ' and saved the file'
                                  }.`,
                    };
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    return {
                        isError: true,
                        applied: false,
                        saved: false,
                        error: message,
                        text: `Unable to edit the file: ${message}`,
                    };
                }
            },
            prepareInvocation: async options =>
                buildPathAwareConfirmation(vscode, options, (resolvedPath, input) =>
                    buildEditConfirmation(vscode, resolvedPath, input)
                ),
        }),
        createTool({
            name: 'saveWorkspaceFile',
            description: 'Save a file in VS Code.',
            parameters: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description: 'Path to save.',
                    },
                },
                required: ['path'],
                additionalProperties: false,
            },
            execute: async input => {
                try {
                    const resolvedPath = await resolveWorkspacePath(vscode, input?.path);
                    requireFilePath(resolvedPath);
                    const document =
                        findOpenDocument(vscode, resolvedPath.uri) ||
                        (await vscode.workspace.openTextDocument(resolvedPath.uri));
                    const saved = (await document.save?.()) === true;
                    return {
                        isError: false,
                        path: stringifyUri(resolvedPath.uri),
                        saved,
                        text: saved
                            ? `Saved ${resolvedPath.displayPath}.`
                            : `VS Code did not report a save for ${resolvedPath.displayPath}.`,
                    };
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    return {
                        isError: true,
                        error: message,
                        text: `Unable to save the file: ${message}`,
                    };
                }
            },
            prepareInvocation: async options =>
                buildPathAwareConfirmation(vscode, options, resolvedPath =>
                    !resolvedPath.isWithinWorkspace
                        ? {
                              title: vscode.l10n.t('Save path outside workspace'),
                              message: new vscode.MarkdownString(
                                  `AI wants to save ${describeResolvedPath(resolvedPath)}.`
                              ),
                          }
                        : undefined
                ),
        }),
        createTool({
            name: 'deleteWorkspaceFile',
            description: 'Delete a workspace file or directory by path.',
            parameters: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description: 'Path to delete.',
                    },
                    recursive: {
                        type: 'boolean',
                        description: 'Delete directories recursively when true.',
                    },
                },
                required: ['path'],
                additionalProperties: false,
            },
            execute: async input => {
                try {
                    const resolvedPath = await resolveWorkspacePath(vscode, input?.path);
                    requireExistingPath(resolvedPath, 'Path');
                    if (resolvedPath.isDirectory && input?.recursive !== true) {
                        throw new Error(
                            `"${resolvedPath.displayPath}" is a directory. Set recursive to true to delete directories.`
                        );
                    }
                    await vscode.workspace.fs.delete(resolvedPath.uri, {
                        recursive: input?.recursive === true,
                    });
                    return {
                        isError: false,
                        path: stringifyUri(resolvedPath.uri),
                        deleted: true,
                        recursive: input?.recursive === true,
                        text: `Deleted ${resolvedPath.displayPath}.`,
                    };
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    return {
                        isError: true,
                        error: message,
                        text: `Unable to delete the path: ${message}`,
                    };
                }
            },
            prepareInvocation: async options =>
                buildPathAwareConfirmation(vscode, options, (resolvedPath, input) =>
                    buildDeleteConfirmation(vscode, resolvedPath, input)
                ),
        }),
    ];
}
