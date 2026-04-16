/* eslint-disable import/no-unresolved */
import { getWorkbenchAiBridgeConfig } from '../../bridge/bridgeConnection';

export const WORKBENCH_REASONING_OPTIONS = [
    { value: 'none', label: 'None' },
    { value: 'minimal', label: 'Minimal' },
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'xhigh', label: 'X-High' },
];
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

export function isAbortLikeError(error) {
    const name = error?.name || '';
    const message = error?.message || '';
    return name === 'AbortError' || String(message).toLowerCase().includes('aborted');
}

export function resolveWorkbenchReasoningSelection(selection) {
    const normalized = typeof selection === 'string' ? selection.trim() : '';
    const allowed = new Set(WORKBENCH_REASONING_OPTIONS.map(option => option.value));
    return allowed.has(normalized) ? normalized : DEFAULT_WORKBENCH_REASONING;
}

type WorkbenchAgentSettingsOptions = {
    modelId?: string;
    reasoning?: string;
};

export function resolveWorkbenchAgentSettings(options: WorkbenchAgentSettingsOptions = {}) {
    const { modelId, reasoning } = options;

    // Use the bridge config — loaded from the LWC app's storage when the bridge connected.
    // This is the only correct source of provider/model info in the VSCode iframe context
    // since the iframe's own localStorage is isolated from the LWC app's storage.
    const bridgeConfig = getWorkbenchAiBridgeConfig();
    const allModels = bridgeConfig?.models ?? [];
    const defaultProvider = bridgeConfig?.provider ?? 'openai';

    // Find the requested model and infer its provider
    const modelEntry = modelId ? allModels.find(m => m.id === modelId) : null;
    const selectedProvider = modelEntry?.provider ?? defaultProvider;

    // Select the model within that provider, falling back to the first available
    const providerModels = allModels.filter(m => m.provider === selectedProvider);
    const selectedModel =
        providerModels.find(m => m.id === modelId)?.id ??
        providerModels.find(m => m.isDefault)?.id ??
        providerModels[0]?.id ??
        modelId ??
        '';

    return {
        provider: selectedProvider,
        selectedModel,
        selectedReasoning: resolveWorkbenchReasoningSelection(reasoning),
        availableModels: providerModels.map(m => ({ label: m.label, value: m.id })),
        modelContextWindow: WORKBENCH_MODEL_CONTEXT_WINDOW,
        maxToolRounds: WORKBENCH_MAX_TOOL_ROUNDS,
        systemPrompt: WORKBENCH_AGENT_SYSTEM_PROMPT,
    };
}
