import {
    OPENAI_MODEL_OPTIONS,
    INTERNAL_OPENAI_MODEL_OPTIONS,
    getDefaultModelForProvider,
} from 'shared/llm';

export const MODELS = OPENAI_MODEL_OPTIONS.map(model => ({
    label: model.label,
    value: model.value,
}));

export const INTERNAL_MODELS = INTERNAL_OPENAI_MODEL_OPTIONS.map(model => ({
    label: model.label,
    value: model.value,
}));

export const DEFAULT_MODEL = getDefaultModelForProvider('openai') || MODELS[0].value;

export const REASONING_OPTIONS = [
    { value: 'none', label: 'None' },
    { value: 'minimal', label: 'Minimal' },
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'xhigh', label: 'X-High' },
];
export const DEFAULT_REASONING = REASONING_OPTIONS[2].value;
