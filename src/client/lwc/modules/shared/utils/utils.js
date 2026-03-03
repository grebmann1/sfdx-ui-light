/**
 * Barrel export file - re-exports all utilities from organized modules
 * This maintains backward compatibility while allowing better code organization
 */

// Existing module exports (unchanged)
export { classSet } from './classSet';
export * from './salesforce';
export * from './normalize';
export { generateUniqueId } from './idGenerator';
export { calculateOverflow } from './sldsOverflowLibrary';
export { LightningResizeObserver } from './sldsResizeObserver';
export * as SETUP_LINKS from './links';
export * as API from './modules/api';
export * as METADATA from './modules/metadata';
export * as ASSISTANT from './modules/assistant';
export * as PLATFORM_EVENT from './modules/platformEvent';
export * as CSV from './modules/csv';
export {
    keyCodes,
    runActionOnBufferedTypedCharacters,
    normalizeKeyValue,
    isShiftMetaOrControlKey,
} from './keyboard';

// Validation utilities
export * from './validation';

// ID generation utilities
export { guid, guidFromHash } from './ids';

// Collection utilities
export { groupBy, chunkArray, removeDuplicates, arrayToMap } from './collections';

// Formatting utilities
export {
    formatBytes,
    basicTextFormatter,
    shortFormatter,
    detectLanguageFromContentType,
    autoDetectAndFormat,
} from './format';

// DOM utilities
export { enableBodyScroll, disableBodyScroll, timeout, animationFrame } from './dom';

// Environment detection
export { isElectronApp, isChromeExtension, isMac } from './env';

// Async utilities
export { chunkPromises, runActionAfterTimeOut, runSilent } from './async';

// Base64url utilities (URL-safe JSON payloads)
export { encodeJsonToBase64Url, decodeBase64UrlToJson } from './base64Url';

// Storage utilities
export { getFromStorage, safeParseJson } from './storage';

// Language/file utilities
export { getLanguage, formatFiles } from './language';

// Sorting utilities
export { sortObjectsByField, getCurrentRank } from './sorting';

// String utilities
export {
    escapeRegExp,
    checkIfPresent,
    isSalesforceId,
    capitalizeFirstLetter,
    compareString,
    isSame,
    lowerCaseKey,
    splitTextByTimestamp,
    stripNamespace,
} from './string';

// Chrome extension utilities
export { getAllOrgs, redirectToUrlViaChrome, getCurrentTab, refreshCurrentTab } from './chrome';

// Chrome port singleton
export { getChromePort, registerChromePort, disconnectChromePort } from './chromePort';

// Salesforce link utilities
export {
    getObjectSetupLink,
    getCustomMetadataLink,
    getObjectFieldsSetupLink,
    getObjectFieldDetailSetupLink,
    getObjectListLink,
    getRecordTypesLink,
    getObjectDocLink,
} from './salesforceLinks';

// Miscellaneous utilities
export {
    decodeError,
    download,
    ROLES,
    forceVariableSave,
    generateExternalId,
    isObject,
    getFieldValue,
    extractErrorDetailsFromQuery,
    isMonacoLanguageSetup,
    prettifyXml,
} from './misc';

// AI prompt constants (re-exported for backward compatibility)
export {
    RECOMMENDED_PROMPT_PREFIX,
    promptWithHandoffInstructions,
} from './prompts';
