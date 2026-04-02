/**
 * Utility module for accessing the VSCode bundle from the global scope.
 * Centralizes access to `globalThis.vscodeBundle` / `globalThis.vscodeBundleFull` to avoid direct global access throughout components.
 */

const EDITOR_WORKER_URL = '/libs/vscode/workers/editor.js';
const TEXTMATE_WORKER_URL = '/libs/vscode/workers/textmate.js';


export const LogLevel = {
    Off: 0,
    Error: 1,
    Warn: 2,
    Info: 3,
    Debug: 4,
    Trace: 5
};


/**
 * Gets the vscodeBundle from the window object
 * @returns {Promise<Object>} Promise that resolves to the vscodeBundle object containing monaco, vscode, and other utilities
 * @throws {Error} If vscodeBundle is not available on the window object
 */
export async function getVscodeBundle() {
    const globalObj = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : undefined);
    const bundle = globalObj?.vscodeBundle ?? globalObj?.vscodeBundleFull;

    if (!bundle) {
        throw new Error(
            'VSCode bundle is not available. Make sure the VSCode bundle is loaded before using editor components (expected globalThis.vscodeBundle or globalThis.vscodeBundleFull).'
        );
    }

    return bundle;
}

/**
 * Initializes the vscodeApi by creating a MonacoVscodeApiWrapper instance and starting it
 * @param {Object} apiConfig - Configuration object for MonacoVscodeApiWrapper
 * @param {string} apiConfig.$type - Overall config type: 'extended' or 'classic'
 * @param {Object} apiConfig.viewsConfig - Views configuration
 * @param {string} apiConfig.viewsConfig.$type - View service type: 'EditorService', 'ViewsService', or 'WorkbenchService'
 * @param {HTMLElement|string} apiConfig.viewsConfig.htmlContainer - HTML container element or 'ReactPlaceholder'
 * @param {Object} [apiConfig.serviceOverrides] - Optional service overrides
 * @param {number} [apiConfig.logLevel] - Optional log level
 * @param {Object} [startInstructions] - Optional start instructions
 * @param {boolean} [startInstructions.performServiceConsistencyChecks] - Whether to perform service consistency checks
 * @returns {Promise<Object>} Promise that resolves to the MonacoVscodeApiWrapper instance
 * @throws {Error} If vscodeBundle is not available or MonacoVscodeApiWrapper is not found
 */
export async function initializeVscodeApi(apiConfig, startInstructions) {
    const vscodeBundle = await getVscodeBundle();
    
    if (!vscodeBundle.monacoLanguageClient || !vscodeBundle.monacoLanguageClient.MonacoVscodeApiWrapper) {
        throw new Error('MonacoVscodeApiWrapper is not available in vscodeBundle. Make sure the vscode bundle includes monacoLanguageClient.');
    }

    const MonacoVscodeApiWrapper = vscodeBundle.monacoLanguageClient.MonacoVscodeApiWrapper;
    const apiWrapper = new MonacoVscodeApiWrapper(apiConfig);
    await apiWrapper.start(startInstructions);
    
    return apiWrapper;
}


export async function initializeVscodeApiWithDefaults(options = {}) {
    const { vscodeApiConfig, logLevel = LogLevel.Off, startInstructions, caller } = options;
    
    const vscodeBundle = await getVscodeBundle();
    const envEnhanced = vscodeBundle.getEnhancedMonacoEnvironment();
    
    // Check if already initialized or initializing
    if (envEnhanced.vscodeApiInitialised === true || envEnhanced.vscodeApiInitialising === true) {
        return undefined; // Already initialized or initializing
    }
    
    // Build the config with defaults
    const apiConfig = buildDefaultVscodeApiConfig(vscodeApiConfig, logLevel);
    
    // Prepare start instructions
    const instructions = {
        ...startInstructions,
        ...(caller && { caller })
    };
    
    // Initialize the vscode API
    const apiWrapper = await initializeVscodeApi(apiConfig, instructions);
    
    return apiWrapper;
}

/**
 * Returns the default monacoWorkerFactory implementation.
 * @returns {Function} The monacoWorkerFactory function
 */
export function getDefaultMonacoWorkerFactory() {
    return async (logger) => {
        const vscodeBundle = await getVscodeBundle();
        const defaultworkerLoaders = vscodeBundle.workers.defineDefaultWorkerLoaders();
        // TextMate worker is not compatible with classic mode, so we use custom workers
        defaultworkerLoaders.editorWorkerService = () => {
            return new Worker(
                EDITOR_WORKER_URL,
                { type: 'module' }
            );
        };
        defaultworkerLoaders.TextMateWorker = () => {
            return new Worker(
                TEXTMATE_WORKER_URL,
                { type: 'module' }
            );
        };
        vscodeBundle.workers.useWorkerFactory({
            workerLoaders: defaultworkerLoaders,
            logger
        });
    };
}

/**
 * Builds the default vscodeApiConfig, merging user-provided config with defaults.
 * @param {Object} [customConfig] - Optional user-provided configuration to merge with defaults
 * @param {number} [logLevel] - Optional log level (defaults to LogLevel.Off)
 * @returns {Object} The vscodeApiConfig object
 */
export function buildDefaultVscodeApiConfig(customConfig, logLevel = LogLevel.Off) {
    const defaultConfig = {
        $type: 'extended',
        viewsConfig: {
            $type: 'EditorService',
        },
        logLevel: logLevel,
        monacoWorkerFactory: getDefaultMonacoWorkerFactory()
    };

    // Merge user-provided config with defaults
    if (customConfig) {
        return {
            ...defaultConfig,
            ...customConfig,
            // Preserve monacoWorkerFactory from user config if provided, otherwise use default
            monacoWorkerFactory: customConfig.monacoWorkerFactory ?? defaultConfig.monacoWorkerFactory,
            // Deep merge viewsConfig
            viewsConfig: {
                ...defaultConfig.viewsConfig,
                ...(customConfig.viewsConfig || {})
            },
            // Preserve serviceOverrides from user config (no default to merge)
            serviceOverrides: customConfig.serviceOverrides
        };
    }

    return defaultConfig;
}