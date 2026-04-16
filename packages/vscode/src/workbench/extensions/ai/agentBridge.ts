import {
    WORKBENCH_CHAT_FAMILY_PREFIX,
    WORKBENCH_CHAT_MODEL_FAMILY,
    WORKBENCH_CHAT_MODEL_ID,
    WORKBENCH_CHAT_MODEL_NAME,
    WORKBENCH_CHAT_MODEL_VENDOR,
    WORKBENCH_CHAT_PARTICIPANT_ID,
} from '../../constants';

import { stringifyUri, truncateText } from './agentFormatting';
import { createWorkbenchAgentRequest } from './agentRuntime';
import { createWorkbenchBashTools } from './tools/bashTools';
import { createWorkspaceFileTools } from './tools/vscodeFileTools';
import { getWorkbenchAiBridgeClient } from '../../bridge/bridgeConnection';

const THINKING_PROGRESS_ID = 'workbench-agent-thinking';
const MAX_INLINE_TEXT_CHARS = 24000;
const MAX_TOOL_STATUS_CHARS = 240;

function resolveModelId(rawId: string | undefined): string {
    if (!rawId) return WORKBENCH_CHAT_MODEL_ID;
    if (rawId.startsWith(WORKBENCH_CHAT_FAMILY_PREFIX)) {
        return rawId.slice(WORKBENCH_CHAT_FAMILY_PREFIX.length);
    }
    return rawId;
}

type WorkbenchEditorEditInput = {
    content?: string;
    replaceSelection?: boolean;
    startLine?: number;
    startCharacter?: number;
    endLine?: number;
    endCharacter?: number;
};

function normalizePrompt(value) {
    return typeof value === 'string' ? value.trim() : '';
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
        fullText: includeFullText ? truncateText(document.getText(), MAX_INLINE_TEXT_CHARS) : '',
        text: '',
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

function buildRange(vscode, document, input: WorkbenchEditorEditInput = {}, selection) {
    const safeInput: WorkbenchEditorEditInput = input || {};
    const hasExplicitRange =
        Number.isInteger(safeInput.startLine) &&
        Number.isInteger(safeInput.startCharacter) &&
        Number.isInteger(safeInput.endLine) &&
        Number.isInteger(safeInput.endCharacter);

    if (hasExplicitRange) {
        return new vscode.Range(
            new vscode.Position(safeInput.startLine, safeInput.startCharacter),
            new vscode.Position(safeInput.endLine, safeInput.endCharacter)
        );
    }

    if (safeInput.replaceSelection !== false && selection && !selection.isEmpty) {
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
            execute: async (input: WorkbenchEditorEditInput = {}) => {
                const safeInput: WorkbenchEditorEditInput = input || {};
                const editor = getActiveEditor(vscode);
                if (!editor?.document) {
                    return {
                        isError: true,
                        applied: false,
                        saved: false,
                        text: 'No active editor is currently open.',
                    };
                }

                const range = buildRange(vscode, editor.document, safeInput, editor.selection);
                const edit = new vscode.WorkspaceEdit();
                edit.replace(editor.document.uri, range, String(safeInput.content ?? ''));
                const applied = await vscode.workspace.applyEdit(edit);
                if (!applied) {
                    return {
                        isError: true,
                        applied: false,
                        saved: false,
                        text: `VS Code rejected the edit for ${stringifyUri(editor.document.uri)}.`,
                    };
                }

                let saved = false;
                let saveError = null;
                try {
                    saved = (await editor.document.save?.()) === true;
                } catch (error) {
                    saveError = error instanceof Error ? error.message : String(error);
                }

                return {
                    isError: false,
                    applied: true,
                    saved,
                    saveError,
                    path: stringifyUri(editor.document.uri),
                    text:
                        saveError || !saved
                            ? `Applied an edit to ${stringifyUri(editor.document.uri)}, but VS Code did not confirm a save.${saveError ? ` ${saveError}` : ''}`
                            : `Applied an edit to ${stringifyUri(editor.document.uri)} and saved the file.`,
                };
            },
            shouldConfirm: () => true,
            buildConfirmation: vscodeApi => ({
                title: vscodeApi.l10n.t('Apply editor edit'),
                message: new vscodeApi.MarkdownString(
                    'AI wants to update the active editor using `applyActiveEditorEdit`.'
                ),
            }),
        },
    ];
}

function createWorkbenchTools(vscode) {
    return [
        ...createEditorTools(vscode),
        ...createWorkspaceFileTools(vscode),
        ...createWorkbenchBashTools(),
    ];
}

function compactToolStatusText(value, maxChars = MAX_TOOL_STATUS_CHARS) {
    return truncateText(
        String(value ?? '')
            .replace(/\s+/g, ' ')
            .trim(),
        maxChars
    );
}

function summarizeToolResult(toolResult) {
    const structuredResult =
        toolResult?.type === 'json' && toolResult?.value && typeof toolResult.value === 'object'
            ? toolResult.value
            : null;

    if (structuredResult?.isError) {
        return {
            status: 'failed',
            details: compactToolStatusText(
                structuredResult.error || structuredResult.text || 'The tool reported an error.'
            ),
        };
    }

    const value =
        structuredResult?.text ||
        toolResult?.value ||
        toolResult?.text ||
        (toolResult?.type === 'json' ? JSON.stringify(toolResult.value ?? '') : '');
    const summary = compactToolStatusText(value);
    if (!summary) {
        return { status: 'completed', details: '' };
    }
    if (/^(unable to|error:)/i.test(summary)) {
        return {
            status: 'failed',
            details: summary.replace(/^error:\s*/i, ''),
        };
    }
    return { status: 'completed', details: summary };
}

function formatToolResultMessage(toolCall, toolResult) {
    const toolName = toolCall?.toolName || 'tool';
    const { status, details } = summarizeToolResult(toolResult);
    if (!details) {
        return `\n\nTool ${toolName} ${status}.`;
    }
    return `\n\nTool ${toolName} ${status}: ${details}`;
}

function formatLanguageModelToolResult(result) {
    if (result && typeof result === 'object' && typeof result.text === 'string' && result.text) {
        return result.text;
    }
    if (typeof result === 'string') {
        return result;
    }
    if (result === null || result === undefined) {
        return '';
    }
    try {
        return JSON.stringify(result, null, 2);
    } catch {
        return String(result);
    }
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
    onToolCall,
    onToolResult,
    token,
    source,
}) {
    const promptText = await buildWorkbenchPromptText({
        vscode,
        vscodeApi,
        prompt,
        references,
        source,
    });

    let agentRequest;
    try {
        agentRequest = await createWorkbenchAgentRequest({
            conversationKey,
            resetConversation,
            modelId,
            promptText,
            tools: createWorkbenchTools(vscode),
            aiBridgeClient: getWorkbenchAiBridgeClient(),
        });
    } catch (setupError) {
        if (typeof onText === 'function') {
            onText(`\n\n${setupError instanceof Error ? setupError.message : String(setupError)}`);
        }
        return;
    }

    const disposeCancellation = attachCancellation(token, agentRequest);
    try {
        for await (const chunk of agentRequest.stream()) {
            if (chunk.type === 'content' && typeof onText === 'function') {
                onText(chunk.content);
            } else if (chunk.type === 'reasoning' && typeof onThinking === 'function') {
                onThinking(chunk.content);
            } else if (chunk.type === 'tool_calls' && typeof onToolCall === 'function') {
                const toolCalls = Array.isArray(chunk.toolCalls) ? chunk.toolCalls : [];
                for (const tc of toolCalls) {
                    onToolCall(tc);
                }
            } else if (chunk.type === 'tool_result') {
                if (typeof onToolResult === 'function') {
                    onToolResult(chunk.toolCall, chunk.toolResult);
                } else if (typeof onText === 'function') {
                    onText(formatToolResultMessage(chunk.toolCall, chunk.toolResult));
                }
            } else if (chunk.type === 'error' && typeof onText === 'function') {
                onText(`\n\n${chunk.content}`);
            }
        }
    } finally {
        disposeCancellation();
    }
}

async function buildWorkbenchPromptText({
    vscode,
    vscodeApi,
    prompt,
    references = [],
    source = 'chat',
}) {
    const activeEditorContext = buildActiveEditorContext(vscode);
    const referencedFiles = await collectReferencedFiles(vscode, vscodeApi, references);
    return buildPromptText({
        prompt,
        activeEditorContext,
        referencedFiles,
        source,
    });
}

function createChatResponseHandlers(response) {
    return {
        onText(text) {
            if (text) {
                response.markdown(text);
            }
        },
        onThinking(text) {
            if (text) {
                response.thinkingProgress({
                    id: THINKING_PROGRESS_ID,
                    text,
                    metadata: { source: 'workbench-agent' },
                });
            }
        },
        onToolCall(toolCall) {
            const name = toolCall?.toolName || 'tool';
            response.progress(`Running \`${name}\`…`);
        },
        onToolResult(toolCall, toolResult) {
            const { status, details } = summarizeToolResult(toolResult);
            const name = toolCall?.toolName || 'tool';
            const icon = status === 'failed' ? '$(error)' : '$(check)';
            const label = details ? `${icon} \`${name}\`: ${details}` : `${icon} \`${name}\` ${status}`;
            response.progress(label);
        },
    };
}

function createProviderResponseHandlers(vscode, progress) {
    return {
        onText(text) {
            if (text) {
                progress.report(new vscode.LanguageModelTextPart(text));
            }
        },
        onThinking(text) {
            if (text) {
                progress.report(new vscode.LanguageModelThinkingPart(text, THINKING_PROGRESS_ID));
            }
        },
        onToolCall(toolCall) {
            const name = toolCall?.toolName || 'tool';
            progress.report(new vscode.LanguageModelTextPart(`\n[tool: ${name}]\n`));
        },
        onToolResult(toolCall, toolResult) {
            const { status, details } = summarizeToolResult(toolResult);
            const name = toolCall?.toolName || 'tool';
            const line = details ? `[${name} ${status}: ${details}]\n` : `[${name} ${status}]\n`;
            progress.report(new vscode.LanguageModelTextPart(line));
        },
    };
}

export function createWorkbenchModelInfo() {
    return {
        id: WORKBENCH_CHAT_MODEL_ID,
        name: WORKBENCH_CHAT_MODEL_NAME,
        family: WORKBENCH_CHAT_MODEL_FAMILY,
        version: '1.0.0',
        maxInputTokens: 128000,
        maxOutputTokens: 8192,
        isDefault: true,
        isUserSelectable: true,
        capabilities: {
            toolCalling: true,
        },
    };
}

export function createWorkbenchAgentBridge(vscodeBundle, vscodeApi) {
    const vscode = vscodeBundle?.vscode;
    const forwardAgentRequest = async requestPayload =>
        runAgentRequest({
            vscode,
            vscodeApi,
            ...requestPayload,
        });

    return {
        participantId: WORKBENCH_CHAT_PARTICIPANT_ID,
        modelVendor: WORKBENCH_CHAT_MODEL_VENDOR,
        modelId: WORKBENCH_CHAT_MODEL_ID,
        createModelInfo() {
            return createWorkbenchModelInfo();
        },
        async handleChatRequest(request, context, response, token) {
            const historyLength = Array.isArray(context?.history) ? context.history.length : 0;
            const requestPayload = {
                prompt: request?.prompt || '',
                modelId: resolveModelId(request?.model?.id),
                conversationKey: 'chat-participant',
                resetConversation: historyLength === 0,
                references: request?.references || [],
                token,
                source: 'vscode-chat-participant',
                ...createChatResponseHandlers(response),
            };
            console.log('[workbench-agent] handleChatRequest payload', {
                prompt: requestPayload.prompt,
                modelId: requestPayload.modelId,
                conversationKey: requestPayload.conversationKey,
                resetConversation: requestPayload.resetConversation,
                referencesCount: Array.isArray(requestPayload.references)
                    ? requestPayload.references.length
                    : 0,
                historyLength,
                source: requestPayload.source,
            });
            await forwardAgentRequest(requestPayload);
        },
        async handleProviderRequest(model, messages, progress, token) {
            const resolvedModelId = resolveModelId(model?.id);
            const requestPayload = {
                prompt: buildProviderPrompt(messages),
                modelId: resolvedModelId,
                conversationKey: `provider:${resolvedModelId}`,
                resetConversation: true,
                token,
                source: 'vscode-language-model-provider',
                ...createProviderResponseHandlers(vscode, progress),
            };
            console.log('[workbench-agent] handleProviderRequest payload', {
                prompt: requestPayload.prompt,
                modelId: requestPayload.modelId,
                conversationKey: requestPayload.conversationKey,
                resetConversation: requestPayload.resetConversation,
                messagesCount: Array.isArray(messages) ? messages.length : 0,
                source: requestPayload.source,
            });
            await forwardAgentRequest(requestPayload);
        },
        async provideTokenCount(_model, value) {
            const text = typeof value === 'string' ? value : buildProviderPrompt([value]);
            return Math.ceil(String(text || '').length / 4);
        },
        createRegisteredTools() {
            return createWorkbenchTools(vscode).map(tool => ({
                definition: tool,
                createInstance() {
                    const executableTool: any = tool;
                    return {
                        async invoke(options) {
                            const result = await executableTool.execute(options?.input || {});
                            return new vscode.LanguageModelToolResult([
                                new vscode.LanguageModelTextPart(
                                    formatLanguageModelToolResult(result)
                                ),
                            ]);
                        },
                        async prepareInvocation(options) {
                            let confirmationMessages;
                            if (typeof executableTool.prepareInvocation === 'function') {
                                confirmationMessages =
                                    await executableTool.prepareInvocation(options);
                            } else if (
                                typeof executableTool.buildConfirmation === 'function' &&
                                executableTool.shouldConfirm?.(options)
                            ) {
                                confirmationMessages = executableTool.buildConfirmation(
                                    vscode,
                                    options
                                );
                            }
                            return {
                                invocationMessage: new vscode.MarkdownString(
                                    `Running \`${executableTool.name}\``
                                ),
                                confirmationMessages,
                            };
                        },
                    };
                },
            }));
        },
    };
}

export const __testables = {
    buildPromptText,
    buildProviderPrompt,
    createWorkbenchModelInfo,
    extractTextContent,
    formatLanguageModelToolResult,
    formatToolResultMessage,
    summarizeToolResult,
};
