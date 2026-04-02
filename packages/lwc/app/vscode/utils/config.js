/**
 * Configuration types and utilities for editor components
 * These types match the TypeScript definitions from the original EditorApp
 */

/**
 * @typedef {Object} CodeContent
 * @property {string} text - The text content
 * @property {string} uri - The URI for the model
 * @property {string} [enforceLanguageId] - Optional language ID to enforce
 */

/**
 * @typedef {Object} CodeResources
 * @property {CodeContent} [modified] - Modified content
 * @property {CodeContent} [original] - Original content (for diff editor)
 */

/**
 * @typedef {Object} EditorAppConfig
 * @property {string} [id] - Editor instance ID
 * @property {number} [logLevel] - Log level
 * @property {CodeResources} [codeResources] - Code resources
 * @property {boolean} [useDiffEditor] - Whether to use diff editor
 * @property {boolean} [domReadOnly] - DOM read-only flag
 * @property {boolean} [readOnly] - Editor read-only flag
 * @property {boolean} [overrideAutomaticLayout] - Override automatic layout
 * @property {Object} [editorOptions] - Monaco editor options
 * @property {Object} [diffEditorOptions] - Monaco diff editor options
 * @property {Object} [languageDef] - Language definition
 */

/**
 * @typedef {Object} TextModels
 * @property {Object} [modified] - Modified text model
 * @property {Object} [original] - Original text model
 */

/**
 * @typedef {Object} TextContents
 * @property {string} [modified] - Modified text content
 * @property {string} [original] - Original text content
 */

export const LogLevel = {
    Off: 0,
    Error: 1,
    Warn: 2,
    Info: 3,
    Debug: 4,
    Trace: 5
};

/**
 * Default editor configuration
 * @returns {EditorAppConfig}
 */
export function getDefaultEditorConfig() {
    return {
        codeResources: {
            modified: {
                text: '',
                uri: `default-uri-${Date.now()}`
            }
        },
        editorOptions: {
            fontSize: 14,
            minimap: {
                enabled: true
            },
            scrollBeyondLastLine: false,
            wordWrap: 'on'
        },
        useDiffEditor: false,
        readOnly: false,
        domReadOnly: false,
        overrideAutomaticLayout: true
    };
}

