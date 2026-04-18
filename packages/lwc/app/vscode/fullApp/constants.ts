import {
    IFRAME_FS_BRIDGE_QUERY_FLAG,
    IFRAME_FS_BRIDGE_QUERY_PARENT_ORIGIN_PARAM,
    IFRAME_FS_BRIDGE_QUERY_VERSION_PARAM,
} from './bridge/iframeFsBridgeContract';
import {
    IFRAME_JSFORCE_BRIDGE_QUERY_FLAG,
    IFRAME_JSFORCE_BRIDGE_QUERY_VERSION_PARAM,
} from './bridge/iframeJsforceBridgeContract';
import {
    IFRAME_AI_BRIDGE_QUERY_FLAG,
    IFRAME_AI_BRIDGE_QUERY_VERSION_PARAM,
} from './bridge/iframeAiBridgeContract';

export const CHAT_MODEL_STORAGE_PREFIX = 'chat.currentLanguageModel.';
export const WORKBENCH_CHAT_EXTENSION_ID = 'salesforce.workbench-ai';
export const WORKBENCH_CHAT_PARTICIPANT_ID = 'salesforce.workbench.agent';
export const WORKBENCH_CHAT_MODEL_VENDOR = 'copilot';
export const WORKBENCH_CHAT_MODEL_ID = 'workbench-agent';
export const WORKBENCH_CHAT_MODEL_FAMILY = 'salesforce-workbench-agent';
export const WORKBENCH_CHAT_MODEL_NAME = 'Workbench Agent';
export const WORKBENCH_CHAT_PROVIDER_ID = 'workbench';
export const WORKBENCH_CHAT_PROVIDER_NAME = 'Workbench AI';
export const WORKBENCH_AI_COMPLETIONS_SETTING = 'workbenchAICompletionsEnabled';
export const WORKBENCH_AI_NEXT_EDIT_SUGGESTIONS_SETTING = 'workbenchAINextEditSuggestionsEnabled';
export const LIGHT_COLOR_THEME = 'Default Light+';
export const DARK_COLOR_THEME = 'Default Dark+';
export const WORKBENCH_THEME_STORAGE_KEY = 'vscode.workbench.themeMode';
export const WORKBENCH_IFRAME_URL = 'http://localhost:5173/';
export const WORKBENCH_IFRAME_ORIGIN = 'http://localhost:5173';
export const DEFAULT_WORKSPACE_ROOT = '/workspace';
export {
    IFRAME_FS_BRIDGE_QUERY_FLAG,
    IFRAME_FS_BRIDGE_QUERY_PARENT_ORIGIN_PARAM,
    IFRAME_FS_BRIDGE_QUERY_VERSION_PARAM,
    IFRAME_JSFORCE_BRIDGE_QUERY_FLAG,
    IFRAME_JSFORCE_BRIDGE_QUERY_VERSION_PARAM,
    IFRAME_AI_BRIDGE_QUERY_FLAG,
    IFRAME_AI_BRIDGE_QUERY_VERSION_PARAM,
};
