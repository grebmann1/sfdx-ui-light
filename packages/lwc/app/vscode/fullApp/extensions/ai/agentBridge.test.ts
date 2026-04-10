import {
    WORKBENCH_CHAT_MODEL_FAMILY,
    WORKBENCH_CHAT_MODEL_ID,
    WORKBENCH_CHAT_MODEL_NAME,
} from '../../constants';

import { __testables } from './agentBridge';

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) {
        throw new Error(message);
    }
}

const modelInfo = __testables.createWorkbenchModelInfo();

assert(modelInfo.id === WORKBENCH_CHAT_MODEL_ID, 'bridge should expose the workbench model id');
assert(
    modelInfo.family === WORKBENCH_CHAT_MODEL_FAMILY,
    'bridge should expose the workbench model family'
);
assert(
    modelInfo.name === WORKBENCH_CHAT_MODEL_NAME,
    'bridge should expose the workbench model name'
);
assert(modelInfo.isDefault === true, 'bridge model should stay default-selectable');
assert(modelInfo.capabilities?.toolCalling === true, 'bridge model should advertise tool calling');

const promptText = __testables.buildPromptText({
    prompt: 'Fix the current file',
    activeEditorContext: { text: 'Active file: /workspace/demo.ts' },
    referencedFiles: [{ path: '/workspace/helper.ts', text: 'export const value = 1;' }],
    source: 'chat',
});

assert(promptText.includes('Fix the current file'), 'prompt should include the user request');
assert(promptText.includes('## Active Editor Context'), 'prompt should include editor context');
assert(promptText.includes('/workspace/helper.ts'), 'prompt should include referenced files');
