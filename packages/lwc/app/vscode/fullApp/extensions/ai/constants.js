export const CHAT_PARTICIPANT_ID = 'salesforce.workbench.agent';
export const MODEL_VENDOR = 'copilot';
export const MAX_INLINE_TEXT_CHARS = 24000;
export const MAX_TOOL_STATUS_CHARS = 240;
export const MODEL_ID = 'workbench-agent';
export const MODEL_FAMILY = 'salesforce-workbench-agent';
export const MODEL_NAME = 'Workbench Agent';
export const THINKING_PROGRESS_ID = 'workbench-agent-thinking';
export const MAX_STORED_MESSAGES = 24;
export const MAX_BASH_OUTPUT_CHARS = 30000;
export const MAX_READ_CHARACTERS = 40000;
export const MAX_TRUNCATED_READ_BYTES = 100000;
export const MAX_FULL_READABLE_FILE_BYTES = 1000000;
export const MAX_DIRECTORY_ENTRIES = 200;
export const MAX_GLOB_RESULTS = 200;
export const MAX_GREP_RESULTS = 100;
export const MAX_GREP_PREVIEW_CHARS = 240;
import {
    OPENAI_MODEL_OPTIONS,
    INTERNAL_OPENAI_MODEL_OPTIONS,
    getDefaultModelForProvider,
} from 'shared/llm';

export const WORKBENCH_RUNTIME_MODELS = OPENAI_MODEL_OPTIONS.map(model => ({
    label: model.label,
    value: model.value,
}));
export const WORKBENCH_INTERNAL_MODELS = INTERNAL_OPENAI_MODEL_OPTIONS.map(model => ({
    label: model.label,
    value: model.value,
}));
export const WORKBENCH_REASONING_OPTIONS = [
    { value: 'none', label: 'None' },
    { value: 'minimal', label: 'Minimal' },
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'xhigh', label: 'X-High' },
];
export const DEFAULT_WORKBENCH_MODEL =
    getDefaultModelForProvider('openai') || WORKBENCH_RUNTIME_MODELS[0].value;
export const DEFAULT_WORKBENCH_INTERNAL_MODEL = WORKBENCH_INTERNAL_MODELS[0].value;
export const DEFAULT_WORKBENCH_REASONING = WORKBENCH_REASONING_OPTIONS[2].value;
export const WORKBENCH_MODEL_CONTEXT_WINDOW = 128000;
export const WORKBENCH_MAX_TOOL_ROUNDS = 400;
export const WORKBENCH_AGENT_SYSTEM_PROMPT = `You are a dedicated coding agent operating inside an embedded VS Code workbench.

You have access to VS Code-native tools for reading, editing, creating, saving, opening, and deleting files in the current workspace.

- Prefer workspace discovery tools before guessing file paths.
- Prefer targeted edits over broad rewrites.
- Prefer range reads for large files.
- Use create tools only for new files and edit tools for existing files.
- Explain errors clearly when a tool reports failure.
- Keep responses concise and practical for coding tasks.`;

export const ACTIVE_EDITOR_TOOL_DEFINITIONS = [
    {
        name: 'getActiveEditorContext',
        toolReferenceName: 'getActiveEditorContext',
        displayName: 'Get Active Editor Context',
        userDescription: 'Read the active editor path, selection, and text snapshot.',
        modelDescription: 'Use this tool to inspect the current active VS Code editor context.',
        canBeReferencedInPrompt: true,
        inputSchema: {
            type: 'object',
            properties: {
                includeFullText: {
                    type: 'boolean',
                },
            },
            additionalProperties: false,
        },
    },
    {
        name: 'applyActiveEditorEdit',
        toolReferenceName: 'applyActiveEditorEdit',
        displayName: 'Apply Active Editor Edit',
        userDescription: 'Apply a text edit to the current active editor.',
        modelDescription: 'Use this tool to update the active VS Code editor.',
        canBeReferencedInPrompt: true,
        inputSchema: {
            type: 'object',
            properties: {
                content: {
                    type: 'string',
                },
                replaceSelection: {
                    type: 'boolean',
                },
                startLine: {
                    type: 'number',
                },
                startCharacter: {
                    type: 'number',
                },
                endLine: {
                    type: 'number',
                },
                endCharacter: {
                    type: 'number',
                },
            },
            required: ['content'],
            additionalProperties: false,
        },
    },
];

export const AI_EXTENSION_API_PROPOSALS = [
    'aiRelatedInformation',
    'mappedEditsProvider',
    'chatSessionsProvider',
    'defaultChatParticipant',
    'chatParticipantAdditions',
    'chatParticipantPrivate',
    'languageModelThinkingPart',
    'chatProvider',
];
