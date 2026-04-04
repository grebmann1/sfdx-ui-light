import { Agent } from 'agent/Agent';
import { sharedInstructions } from 'agent/agents';
import {
    createUserModelMessage,
    MODELS,
    DEFAULT_MODEL,
    DEFAULT_REASONING,
} from 'agent/utils';
import { store } from 'core/store';
import { CACHE_CONFIG, loadExtensionConfigFromCache } from 'shared/cacheManager';
import { guid } from 'shared/utils';

const MAX_INLINE_TEXT_CHARS = 24000;
const MODEL_VENDOR = 'salesforce-workbench';
const MODEL_ID = 'workbench-agent';
const MODEL_FAMILY = 'salesforce-workbench-agent';
const MODEL_NAME = 'Workbench Agent';

const WORKBENCH_AGENT_INSTRUCTIONS = `${sharedInstructions}

## Embedded VS Code Workbench

You are operating inside an embedded VS Code workbench with access to the workspace file system.

- Prefer the existing workspace coding tools (\`readFile\`, \`writeFile\`, \`bash\`) for multi-file work.
- Use \`getActiveEditorContext\` when you need the latest active file path, selection, or current editor text.
- Use \`applyActiveEditorEdit\` for precise edits to the file currently open in the editor.
- Prefer targeted edits over broad rewrites.
- If a user asks you to update the current file, inspect the active editor context before editing unless the prompt already includes the exact code span you need.
- Keep responses concise and practical for coding tasks.
`;

const conversationIdsByKey = new Map();
const conversationMessagesById = new Map();
const SUPPORTED_RUNTIME_MODEL_IDS = new Set(
    (Array.isArray(MODELS) ? MODELS : []).map(model => model?.value).filter(Boolean)
);

function truncateText(text, maxChars = MAX_INLINE_TEXT_CHARS) {
    const value = typeof text === 'string' ? text : String(text ?? '');
    if (value.length <= maxChars) {
        return value;
    }
    return `${value.slice(0, maxChars)}\n\n[Truncated ${value.length - maxChars} chars]`;
}

function stringifyUri(uri) {
    if (!uri) return '';
    return uri.fsPath || uri.path || uri.toString?.() || String(uri);
}

function normalizePrompt(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function getOrCreateConversationId(key, shouldReset = false) {
    if (shouldReset || !conversationIdsByKey.has(key)) {
        const previousId = conversationIdsByKey.get(key);
        const nextId = guid();
        conversationIdsByKey.set(key, nextId);
        if (shouldReset && previousId) {
            conversationMessagesById.delete(previousId);
        }
    }
    return conversationIdsByKey.get(key);
}

function getActiveEditor(vscode) {
    return vscode?.window?.activeTextEditor || null;
}

function buildActiveEditorContext(vscode, { includeFullText = true } = {}) {
    const editor = getActiveEditor(vscode);
    if (!editor?.document) {
        return {
            hasActiveEditor: false,
            text: 'No active editor is currently open.',
        };
    }

    const { document, selection } = editor;
    const selectedText = selection && !selection.isEmpty ? document.getText(selection) : '';

    const context = {
        hasActiveEditor: true,
        path: stringifyUri(document.uri),
        languageId: document.languageId || '',
        selection: selection
            ? {
                  startLine: selection.start.line,
                  startCharacter: selection.start.character,
                  endLine: selection.end.line,
                  endCharacter: selection.end.character,
                  isEmpty: selection.isEmpty,
              }
            : null,
        selectedText: truncateText(selectedText, 8000),
        fullText: includeFullText ? truncateText(document.getText()) : '',
    };

    context.text = formatActiveEditorContext(context);
    return context;
}

function formatActiveEditorContext(context) {
    if (!context?.hasActiveEditor) {
        return 'No active editor is currently open.';
    }

    const parts = [
        `Active file: ${context.path || '(unknown)'}`,
        `Language: ${context.languageId || '(unknown)'}`,
    ];

    if (context.selection) {
        parts.push(
            `Selection: ${context.selection.startLine}:${context.selection.startCharacter} -> ${context.selection.endLine}:${context.selection.endCharacter}`
        );
    }

    if (context.selectedText) {
        parts.push(`Selected text:\n${context.selectedText}`);
    }

    if (context.fullText) {
        parts.push(`Current file contents:\n${context.fullText}`);
    }

    return parts.join('\n\n');
}

async function collectReferencedFiles(vscode, vscodeApi, references = []) {
    const items = [];
    const UriCtor = vscodeApi?.Uri;
    for (const reference of Array.isArray(references) ? references : []) {
        const value = reference?.value;
        const isUri =
            (UriCtor && value instanceof UriCtor) ||
            (value && typeof value === 'object' && typeof value.scheme === 'string');
        if (!isUri) {
            continue;
        }
        try {
            const document = await vscode.workspace.openTextDocument(value);
            items.push({
                path: stringifyUri(document.uri),
                text: truncateText(document.getText(), 12000),
            });
        } catch {
            // Ignore unreadable references.
        }
    }
    return items;
}

function formatReferencedFiles(referencedFiles) {
    if (!Array.isArray(referencedFiles) || referencedFiles.length === 0) {
        return '';
    }
    return referencedFiles
        .map(file => `Referenced file: ${file.path}\n\n${file.text}`)
        .join('\n\n---\n\n');
}

function buildPromptText({ prompt, activeEditorContext, referencedFiles, source = 'chat' }) {
    const parts = [];
    const cleanPrompt = normalizePrompt(prompt);
    parts.push(cleanPrompt || 'Help with the current workspace task.');
    parts.push(`Request source: ${source}`);

    if (activeEditorContext?.text) {
        parts.push(`## Active Editor Context\n${activeEditorContext.text}`);
    }

    const referencedText = formatReferencedFiles(referencedFiles);
    if (referencedText) {
        parts.push(`## Referenced Files\n${referencedText}`);
    }

    return parts.join('\n\n');
}

function buildRange(vscode, document, input = {}, selection) {
    const hasExplicitRange =
        Number.isInteger(input.startLine) &&
        Number.isInteger(input.startCharacter) &&
        Number.isInteger(input.endLine) &&
        Number.isInteger(input.endCharacter);

    if (hasExplicitRange) {
        return new vscode.Range(
            new vscode.Position(input.startLine, input.startCharacter),
            new vscode.Position(input.endLine, input.endCharacter)
        );
    }

    if (input.replaceSelection !== false && selection && !selection.isEmpty) {
        return selection;
    }

    const lastLine = Math.max(0, document.lineCount - 1);
    const lastCharacter = document.lineAt(lastLine).text.length;
    return new vscode.Range(
        new vscode.Position(0, 0),
        new vscode.Position(lastLine, lastCharacter)
    );
}

function createEditorTools(vscode) {
    return [
        {
            name: 'getActiveEditorContext',
            description:
                'Get the current active editor path, selection, and text snapshot from VS Code.',
            parameters: {
                type: 'object',
                properties: {
                    includeFullText: {
                        type: 'boolean',
                        description:
                            'Include the current full text of the active editor when true.',
                    },
                },
                additionalProperties: false,
            },
            execute: async ({ includeFullText = true } = {}) => {
                const context = buildActiveEditorContext(vscode, { includeFullText });
                return {
                    ...context,
                    text: context.text,
                };
            },
        },
        {
            name: 'applyActiveEditorEdit',
            description: 'Apply a text edit to the active VS Code editor.',
            parameters: {
                type: 'object',
                properties: {
                    content: {
                        type: 'string',
                        description: 'Replacement text to write into the target range.',
                    },
                    replaceSelection: {
                        type: 'boolean',
                        description:
                            'Replace the current selection when true or when no explicit range is provided.',
                    },
                    startLine: { type: 'number' },
                    startCharacter: { type: 'number' },
                    endLine: { type: 'number' },
                    endCharacter: { type: 'number' },
                },
                required: ['content'],
                additionalProperties: false,
            },
            execute: async input => {
                const editor = getActiveEditor(vscode);
                if (!editor?.document) {
                    return {
                        isError: true,
                        text: 'No active editor is currently open.',
                    };
                }

                const range = buildRange(vscode, editor.document, input, editor.selection);
                const edit = new vscode.WorkspaceEdit();
                edit.replace(editor.document.uri, range, String(input?.content ?? ''));
                const applied = await vscode.workspace.applyEdit(edit);
                if (!applied) {
                    return {
                        isError: true,
                        text: `VS Code rejected the edit for ${stringifyUri(editor.document.uri)}.`,
                    };
                }

                try {
                    await editor.document.save?.();
                } catch {
                    // Best effort only.
                }

                return {
                    isError: false,
                    path: stringifyUri(editor.document.uri),
                    text: `Applied edit to ${stringifyUri(editor.document.uri)}.`,
                };
            },
        },
    ];
}

function resolveAgentRuntimeModelId(modelId, state) {
    const requestedModelId = typeof modelId === 'string' ? modelId.trim() : '';
    if (requestedModelId && SUPPORTED_RUNTIME_MODEL_IDS.has(requestedModelId)) {
        return requestedModelId;
    }
    return state.agent?.selectedModel || DEFAULT_MODEL;
}

async function createAgentSettings(vscode, modelId) {
    const state = store.getState();
    const cachedConfig = await loadExtensionConfigFromCache([
        CACHE_CONFIG.OPENAI_KEY.key,
        CACHE_CONFIG.OPENAI_URL.key,
    ]).catch(() => ({}));
    const cachedOpenaiKey = cachedConfig?.[CACHE_CONFIG.OPENAI_KEY.key];
    const cachedOpenaiUrl = cachedConfig?.[CACHE_CONFIG.OPENAI_URL.key];
    const openaiKey =
        typeof cachedOpenaiKey === 'string' && cachedOpenaiKey.trim()
            ? cachedOpenaiKey
            : state.application?.openaiKey ?? '';
    const openaiUrl =
        typeof cachedOpenaiUrl === 'string' && cachedOpenaiUrl.trim()
            ? cachedOpenaiUrl
            : state.application?.openaiUrl;
    const isInternal =
        typeof openaiUrl === 'string' && openaiUrl
            ? openaiUrl.includes('eng-ai-model-gateway')
            : state.application?.isInternal;

    return {
        openaiKey,
        openaiUrl,
        isInternal,
        selectedModel: resolveAgentRuntimeModelId(modelId, state),
        selectedReasoning: state.agent?.selectedReasoning ?? DEFAULT_REASONING,
        systemPrompt: WORKBENCH_AGENT_INSTRUCTIONS,
        isStoreEnabled: false,
        extraTools: createEditorTools(vscode),
        store,
    };
}

function reportToolCall(onText, toolCalls) {
    if (typeof onText !== 'function' || !Array.isArray(toolCalls) || toolCalls.length === 0) {
        return;
    }
    for (const toolCall of toolCalls) {
        const toolName = toolCall?.toolName || 'tool';
        onText(`\n\n_Using tool: \`${toolName}\`_`);
    }
}

function reportToolResult(onText, toolCall, toolResult) {
    if (typeof onText !== 'function') {
        return;
    }
    const toolName = toolCall?.toolName || 'tool';
    const value =
        toolResult?.value ||
        toolResult?.text ||
        (toolResult?.type === 'json' ? JSON.stringify(toolResult.value) : '');
    const summary = truncateText(typeof value === 'string' ? value : String(value ?? ''), 4000);
    onText(`\n\n_Tool \`${toolName}\` finished._\n\n${summary}`);
}

function attachCancellation(token, agent) {
    if (!token?.onCancellationRequested) {
        return () => {};
    }
    const disposable = token.onCancellationRequested(() => {
        try {
            agent.abort();
        } catch {
            // ignore
        }
    });
    return () => {
        try {
            disposable?.dispose?.();
        } catch {
            // ignore
        }
    };
}

function buildProviderPrompt(messages) {
    return (Array.isArray(messages) ? messages : [])
        .map(message => {
            const role = typeof message?.role === 'string' ? message.role : 'user';
            const content = extractTextContent(message?.content ?? message?.text ?? message?.parts);
            return content ? `[${role}] ${content}` : '';
        })
        .filter(Boolean)
        .join('\n\n');
}

function extractTextContent(value) {
    if (typeof value === 'string') {
        return value;
    }
    if (Array.isArray(value)) {
        return value.map(extractTextContent).filter(Boolean).join('\n');
    }
    if (!value || typeof value !== 'object') {
        return '';
    }
    if (typeof value.text === 'string') {
        return value.text;
    }
    if (typeof value.value === 'string') {
        return value.value;
    }
    if (Array.isArray(value.value)) {
        return value.value.map(extractTextContent).filter(Boolean).join('\n');
    }
    return '';
}

async function runAgentRequest({
    vscode,
    vscodeApi,
    prompt,
    modelId,
    conversationKey,
    resetConversation = false,
    references = [],
    onText,
    onThinking,
    token,
    source,
}) {
    const conversationId = getOrCreateConversationId(conversationKey, resetConversation);
    const previousMessages = conversationMessagesById.get(conversationId) || [];
    const activeEditorContext = buildActiveEditorContext(vscode);
    const referencedFiles = await collectReferencedFiles(vscode, vscodeApi, references);
    const promptText = buildPromptText({
        prompt,
        activeEditorContext,
        referencedFiles,
        source,
    });

    const agent = await Agent.create({
        messages: previousMessages,
        conversationId,
        settings: await createAgentSettings(vscode, modelId),
    });

    const disposeCancellation = attachCancellation(token, agent);
    try {
        const userMessages = [createUserModelMessage({ text: promptText, filesData: [] })];
        for await (const chunk of agent.processMessage(userMessages)) {
            if (chunk.type === 'content' && typeof onText === 'function') {
                onText(chunk.content);
            } else if (chunk.type === 'reasoning' && typeof onThinking === 'function') {
                onThinking(chunk.content);
            } else if (chunk.type === 'tool_calls') {
                reportToolCall(onText, chunk.toolCalls);
            } else if (chunk.type === 'tool_result') {
                reportToolResult(onText, chunk.toolCall, chunk.toolResult);
            } else if (chunk.type === 'error' && typeof onText === 'function') {
                onText(`\n\n${chunk.content}`);
            }
        }
    } finally {
        conversationMessagesById.set(conversationId, agent.getMessages());
        disposeCancellation();
    }
}

export function createWorkbenchAgentBridge(vscodeBundle, vscodeApi) {
    const vscode = vscodeBundle?.vscode;

    return {
        participantId: 'salesforce.workbench.agent',
        modelVendor: MODEL_VENDOR,
        modelId: MODEL_ID,
        createModelInfo() {
            return {
                id: MODEL_ID,
                name: MODEL_NAME,
                family: MODEL_FAMILY,
                version: '1.0.0',
                maxInputTokens: 128000,
                maxOutputTokens: 8192,
                isDefault: true,
                isUserSelectable: true,
                capabilities: {
                    toolCalling: true,
                },
            };
        },
        async handleChatRequest(request, context, response, token) {
            const historyLength = Array.isArray(context?.history) ? context.history.length : 0;
            await runAgentRequest({
                vscode,
                vscodeApi,
                prompt: request?.prompt || '',
                modelId: request?.model?.id,
                conversationKey: 'chat-participant',
                resetConversation: historyLength === 0,
                references: request?.references || [],
                token,
                source: 'vscode-chat-participant',
                onText: text => {
                    if (text) {
                        response.markdown(text);
                    }
                },
                onThinking: text => {
                    if (text) {
                        response.thinkingProgress({
                            id: 'workbench-agent-thinking',
                            text,
                            metadata: { source: 'workbench-agent' },
                        });
                    }
                },
            });
        },
        async handleProviderRequest(model, messages, progress, token) {
            await runAgentRequest({
                vscode,
                vscodeApi,
                prompt: buildProviderPrompt(messages),
                modelId: model?.id || MODEL_ID,
                conversationKey: `provider:${model?.id || MODEL_ID}`,
                resetConversation: true,
                token,
                source: 'vscode-language-model-provider',
                onText: text => {
                    if (text) {
                        progress.report(new vscode.LanguageModelTextPart(text));
                    }
                },
                onThinking: text => {
                    if (text) {
                        progress.report(
                            new vscode.LanguageModelThinkingPart(text, 'workbench-agent-thinking')
                        );
                    }
                },
            });
        },
        async provideTokenCount(_model, value) {
            const text = typeof value === 'string' ? value : buildProviderPrompt([value]);
            return Math.ceil(String(text || '').length / 4);
        },
        createRegisteredTools() {
            return createEditorTools(vscode).map(tool => ({
                definition: tool,
                createInstance() {
                    return {
                        async invoke(options) {
                            const result = await tool.execute(options?.input || {});
                            return new vscode.LanguageModelToolResult([
                                new vscode.LanguageModelTextPart(result?.text || ''),
                            ]);
                        },
                        async prepareInvocation() {
                            return {
                                invocationMessage: new vscode.MarkdownString(
                                    `Running \`${tool.name}\``
                                ),
                                confirmationMessages:
                                    tool.name === 'applyActiveEditorEdit'
                                        ? {
                                              title: vscode.l10n.t('Apply editor edit'),
                                              message: new vscode.MarkdownString(
                                                  `AI wants to update the active editor using \`${tool.name}\`.`
                                              ),
                                          }
                                        : undefined,
                            };
                        },
                    };
                },
            }));
        },
    };
}
