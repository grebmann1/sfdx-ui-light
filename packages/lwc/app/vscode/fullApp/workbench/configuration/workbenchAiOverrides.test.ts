import {
    WORKBENCH_AI_COMPLETIONS_SETTING,
    WORKBENCH_AI_NEXT_EDIT_SUGGESTIONS_SETTING,
    WORKBENCH_CHAT_EXTENSION_ID,
    WORKBENCH_CHAT_PROVIDER_ID,
    WORKBENCH_CHAT_PROVIDER_NAME,
} from '../../constants';

import {
    buildWorkbenchDefaultChatAgent,
    buildWorkbenchDefaultChatAccount,
    createWorkbenchAiServiceOverrides,
} from './workbenchAiOverrides';

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) {
        throw new Error(message);
    }
}

const chatAgent = buildWorkbenchDefaultChatAgent();

assert(
    chatAgent.chatExtensionId === WORKBENCH_CHAT_EXTENSION_ID,
    'default chat agent should target the workbench AI extension id'
);
assert(
    chatAgent.completionsEnablementSetting === WORKBENCH_AI_COMPLETIONS_SETTING,
    'default chat agent should expose the workbench completions setting'
);
assert(
    chatAgent.nextEditSuggestionsSetting === WORKBENCH_AI_NEXT_EDIT_SUGGESTIONS_SETTING,
    'default chat agent should expose the workbench next edit suggestions setting'
);
assert(
    chatAgent.provider.enterprise.id === WORKBENCH_CHAT_PROVIDER_ID,
    'default chat agent should preserve workbench provider branding'
);

const defaultAccount = buildWorkbenchDefaultChatAccount();

assert(defaultAccount.enterprise === true, 'default chat account should be enterprise-scoped');
assert(
    defaultAccount.accountName === WORKBENCH_CHAT_PROVIDER_NAME,
    'default chat account should use the workbench provider name'
);
assert(
    defaultAccount.authenticationProvider.id === WORKBENCH_CHAT_PROVIDER_ID,
    'default chat account should use the workbench auth provider id'
);
assert(
    defaultAccount.entitlementsData.copilot_plan === 'enterprise',
    'default chat account should advertise enterprise entitlement state'
);

const mergedOverrides = createWorkbenchAiServiceOverrides(
    { fileService: true },
    {
        services: {
            getAuthenticationServiceOverride: () => ({ authService: true }),
            getStorageServiceOverride: () => ({ storageService: true }),
            getChatServiceOverride: () => ({ chatService: true }),
            getAiServiceOverride: () => ({ aiService: true }),
        },
    }
);

assert(mergedOverrides.fileService === true, 'composer should preserve file-service overrides');
assert(mergedOverrides.authService === true, 'composer should include auth overrides');
assert(mergedOverrides.storageService === true, 'composer should include storage overrides');
assert(mergedOverrides.chatService === true, 'composer should include chat overrides');
assert(mergedOverrides.aiService === true, 'composer should include AI overrides');
