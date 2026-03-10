export const MODELS = [
    { label: 'gpt-5-mini', value: 'gpt-5-mini-2025-08-07' },
    { label: 'gpt-5', value: 'gpt-5-2025-08-07' },
    { label: 'gpt-5-nano', value: 'gpt-5-nano-2025-08-07' },
    { label: 'gpt-5.4', value: 'gpt-5.4' },
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
export const DEFAULT_REASONING = REASONING_OPTIONS[1].value;