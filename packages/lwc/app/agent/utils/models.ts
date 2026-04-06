export const MODELS = [
    { label: 'gpt-5-mini', value: 'gpt-5-mini' },
    { label: 'gpt-5', value: 'gpt-5-2025-08-07' },
    { label: 'gpt-5-codex', value: 'gpt-5-codex' },
    { label: 'gpt-5-nano', value: 'gpt-5-nano-2025-08-07' },
    { label: 'gpt-5.4', value: 'gpt-5.4-2026-03-05' },
];

export const INTERNAL_MODELS = [
    { label: 'gpt-5-mini', value: 'gpt-5-mini' },
    { label: 'gpt-5', value: 'gpt-5' },
];

export const DEFAULT_MODEL = MODELS[0].value;

export const REASONING_OPTIONS = [
    { value: 'none', label: 'None' },
    { value: 'minimal', label: 'Minimal' },
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'xhigh', label: 'X-High' },
];
export const DEFAULT_REASONING = REASONING_OPTIONS[2].value;
