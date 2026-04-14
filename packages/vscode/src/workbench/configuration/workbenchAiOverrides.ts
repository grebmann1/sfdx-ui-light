import {
    WORKBENCH_AI_COMPLETIONS_SETTING,
    WORKBENCH_AI_NEXT_EDIT_SUGGESTIONS_SETTING,
    WORKBENCH_CHAT_EXTENSION_ID,
    WORKBENCH_CHAT_PROVIDER_ID,
    WORKBENCH_CHAT_PROVIDER_NAME,
} from '../constants';
function mergeServiceOverrides(...overrides: Array<Record<string, unknown> | null | undefined>) {
    return overrides.reduce<Record<string, unknown>>((result, nextOverrides) => {
        if (!nextOverrides || typeof nextOverrides !== 'object') {
            return result;
        }
        return { ...result, ...nextOverrides };
    }, {});
}

const WORKBENCH_PROVIDER_BRANDING = {
    id: WORKBENCH_CHAT_PROVIDER_ID,
    name: WORKBENCH_CHAT_PROVIDER_NAME,
};

type WorkbenchServiceOverrideFactories = {
    getAiServiceOverride?: (...args: unknown[]) => Record<string, unknown>;
    getAuthenticationServiceOverride?: (...args: unknown[]) => Record<string, unknown>;
    getChatServiceOverride?: (...args: unknown[]) => Record<string, unknown>;
    getStorageServiceOverride?: (...args: unknown[]) => Record<string, unknown>;
};

function resolveWorkbenchServiceOverrideFactories(vscodeBundle?: {
    services?: WorkbenchServiceOverrideFactories;
}) {
    return vscodeBundle?.services || {};
}

export function buildWorkbenchDefaultChatAgent() {
    return {
        chatExtensionId: WORKBENCH_CHAT_EXTENSION_ID,
        extensionId: '',
        completionsEnablementSetting: WORKBENCH_AI_COMPLETIONS_SETTING,
        nextEditSuggestionsSetting: WORKBENCH_AI_NEXT_EDIT_SUGGESTIONS_SETTING,
        provider: {
            default: WORKBENCH_PROVIDER_BRANDING,
            apple: WORKBENCH_PROVIDER_BRANDING,
            enterprise: WORKBENCH_PROVIDER_BRANDING,
            google: WORKBENCH_PROVIDER_BRANDING,
        },
    };
}

export function buildWorkbenchDefaultChatAccount() {
    return {
        entitlementsData: {
            access_type_sku: 'workbench',
            assigned_date: 'workbench',
            can_signup_for_limited: false,
            copilot_plan: 'enterprise',
            organization_login_list: [],
            analytics_tracking_id: 'workbench',
        },
        accountName: WORKBENCH_CHAT_PROVIDER_NAME,
        authenticationProvider: {
            id: WORKBENCH_CHAT_PROVIDER_ID,
            name: WORKBENCH_CHAT_PROVIDER_NAME,
            enterprise: true,
        },
        enterprise: true,
        sessionId: 'workbench-ai',
    };
}

export function createWorkbenchAiServiceOverrides(
    fileServiceOverrides = {},
    vscodeBundle?: { services?: WorkbenchServiceOverrideFactories }
) {
    const {
        getAiServiceOverride,
        getAuthenticationServiceOverride,
        getChatServiceOverride,
        getStorageServiceOverride,
    } = resolveWorkbenchServiceOverrideFactories(vscodeBundle);

    return mergeServiceOverrides(
        fileServiceOverrides,
        typeof getAuthenticationServiceOverride === 'function'
            ? getAuthenticationServiceOverride()
            : {},
        typeof getStorageServiceOverride === 'function'
            ? getStorageServiceOverride({
                  fallbackOverride: {
                      'workbench.activity.showAccounts': false,
                  },
              })
            : {},
        typeof getChatServiceOverride === 'function'
            ? getChatServiceOverride({
                  defaultAccount: buildWorkbenchDefaultChatAccount(),
              })
            : {},
        typeof getAiServiceOverride === 'function' ? getAiServiceOverride() : {}
    );
}

export const __testables = {
    buildWorkbenchDefaultChatAccount,
    buildWorkbenchDefaultChatAgent,
    createWorkbenchAiServiceOverrides,
    resolveWorkbenchServiceOverrideFactories,
};
