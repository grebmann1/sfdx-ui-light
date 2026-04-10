import {
    DEFAULT_WORKBENCH_REASONING,
    __testables,
    resolveWorkbenchReasoningSelection,
} from './agentConfig';

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) {
        throw new Error(message);
    }
}

const internalOpenAiModels = __testables.getDefaultWorkbenchModelOptions('openai', true);
assert(internalOpenAiModels.length > 0, 'internal OpenAI configs should expose fallback models');
assert(
    internalOpenAiModels.every(model => model.provider === 'openai'),
    'internal OpenAI fallbacks should stay on the OpenAI provider'
);

const geminiModels = __testables.getDefaultWorkbenchModelOptions('gemini', false);
assert(geminiModels.length > 0, 'Gemini configs should expose fallback Gemini models');
assert(
    geminiModels.every(model => model.provider === 'gemini'),
    'Gemini fallbacks should stay scoped to the selected provider'
);

assert(
    resolveWorkbenchReasoningSelection('invalid-option') === DEFAULT_WORKBENCH_REASONING,
    'invalid reasoning selections should fall back to the default reasoning level'
);
assert(
    resolveWorkbenchReasoningSelection('medium') === 'medium',
    'valid reasoning selections should be preserved'
);
