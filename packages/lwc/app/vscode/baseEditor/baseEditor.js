import { api, LightningElement } from 'lwc';
import { getVscodeBundle, initializeVscodeApi } from 'vscode/vscodeBundle';

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
 * Returns the default monacoWorkerFactory implementation.
 * @returns {Function} The monacoWorkerFactory function
 */
function getDefaultMonacoWorkerFactory() {
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
 * @param {Object} [userConfig] - Optional user-provided configuration to merge with defaults
 * @param {number} [logLevel] - Optional log level (defaults to LogLevel.Off)
 * @returns {Object} The vscodeApiConfig object
 */
function buildDefaultVscodeApiConfig(userConfig, logLevel = LogLevel.Off) {
    const defaultConfig = {
        $type: 'extended',
        viewsConfig: {
            $type: 'EditorService',
        },
        logLevel: logLevel,
        monacoWorkerFactory: getDefaultMonacoWorkerFactory()
    };

    // Merge user-provided config with defaults
    if (userConfig) {
        return {
            ...defaultConfig,
            ...userConfig,
            // Preserve monacoWorkerFactory from user config if provided, otherwise use default
            monacoWorkerFactory: userConfig.monacoWorkerFactory ?? defaultConfig.monacoWorkerFactory,
            // Deep merge viewsConfig
            viewsConfig: {
                ...defaultConfig.viewsConfig,
                ...(userConfig.viewsConfig || {})
            },
            // Preserve serviceOverrides from user config (no default to merge)
            serviceOverrides: userConfig.serviceOverrides
        };
    }

    return defaultConfig;
}

/**
 * Initializes the vscode API with default configuration.
 * This function can be called from parent elements to initialize vscode API before creating editors.
 * It checks if vscodeApi is already initialized and only initializes if needed.
 * 
 * @param {Object} [options] - Optional configuration
 * @param {Object} [options.vscodeApiConfig] - Optional vscodeApiConfig to merge with defaults
 * @param {number} [options.logLevel] - Optional log level (defaults to LogLevel.Off)
 * @param {Object} [options.startInstructions] - Optional start instructions for initializeVscodeApi
 * @param {string} [options.caller] - Optional caller identifier for logging
 * @returns {Promise<Object>} Promise that resolves to the MonacoVscodeApiWrapper instance if initialized, or undefined if already initialized
 * @throws {Error} If vscodeBundle is not available or initialization fails
 */
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

export default class BaseEditor extends LightningElement {
    _editorId;
    @api
    get editorId() {
        return this._editorId;
    }
    set editorId(value) {
        this._editorId = value;
    }

    _vscodeApiConfig;
    @api
    get vscodeApiConfig() {
        return this._vscodeApiConfig;
    }
    set vscodeApiConfig(value) {
        this._vscodeApiConfig = value;
    }

    _config;
    @api
    get config() {
        return this._config;
    }
    set config(value) {
        this._config = value;
    }

    _readOnly = false;
    @api
    get readOnly() {
        return this._readOnly;
    }
    set readOnly(value) {
        this._readOnly = value;
        if (this.editor) {
            this.editor?.updateOptions({ readOnly: value });
        } else if (this.diffEditor) {
            this.diffEditor?.updateOptions({ readOnly: value });
        }
    }

    @api domReadOnly = false;
    @api useDiffEditor = false;
    @api logLevel;
    @api modelRefDisposeTimeout = 0;
    @api textChangedHandler;

    editor;
    diffEditor;
    modelRefs = {
        modified: undefined,
        original: undefined
    };
    textChangedDisposables = {
        modified: undefined,
        original: undefined
    };
    modelDisposables = {
        modified: undefined,
        original: undefined
    };
    startingPromise;
    disposingPromise;
    logger;
    container;
    diagnosticsDisposable = null;
    currentDiagnostics = [];

    connectedCallback() {
        const MAX_EDITOR_ID = 1000000;
        this._editorId = this._editorId || Math.floor(Math.random() * (MAX_EDITOR_ID + 1)).toString();
        this.asyncInit();
    }

    async asyncInit() {
        const vscodeBundle = await getVscodeBundle();
        this.logger = new vscodeBundle.ConsoleLogger();
        if (this.logLevel !== undefined) {
            this.logger.setLevel(this.logLevelCode);
        }
    }

    renderedCallback() {
        if (!this.container) {
            const containerElement = this.template.querySelector('.editor-container');
            if (containerElement) {
                this.container = containerElement;
                this.initializeEditor();
            }
        }
    }

    disconnectedCallback() {
        this.dispose();
    }

    /**
     * Builds the vscodeApiConfig, merging user-provided config with defaults.
     * Child classes can override this method to customize the configuration.
     * @returns {Object} The vscodeApiConfig object
     */
    buildVscodeApiConfig() {
        return buildDefaultVscodeApiConfig(this.vscodeApiConfig, this.logLevel ?? LogLevel.Off);
    }

    /**
     * Returns the default monacoWorkerFactory implementation.
     * Child classes can override this method to provide custom worker factory logic.
     * @returns {Function} The monacoWorkerFactory function
     */
    getDefaultMonacoWorkerFactory() {
        return getDefaultMonacoWorkerFactory();
    }

    async initializeEditor() {
        if (!this.logger) {
            await this.asyncInit();
        }
        this.logger.info('initializeEditor');
        if (this.isStarting()) {
            await this.startingPromise;
            return;
        }

        let startingResolve;
        this.startingPromise = new Promise((resolve) => {
            startingResolve = resolve;
        });

        try {
            const vscodeBundle = await getVscodeBundle();
            const envEnhanced = vscodeBundle.getEnhancedMonacoEnvironment();
            this.logger.info('envEnhanced', envEnhanced);
            if (envEnhanced.vscodeApiInitialised === false && envEnhanced.vscodeApiInitialising === false) {
                this.logger.info('vscodeApi not initialized. Initializing now...');
                const apiConfig = this.buildVscodeApiConfig();
                this.logger.info('apiConfig', apiConfig);
                await initializeVscodeApi(apiConfig, { caller: 'BaseEditor.initializeEditor' });
                this.logger.info('vscodeApi initialized successfully.');
            }

            const updatedEnvEnhanced = vscodeBundle.getEnhancedMonacoEnvironment();
            const updatedViewServiceType = updatedEnvEnhanced.viewServiceType;

            if (updatedViewServiceType !== 'EditorService' && updatedViewServiceType !== undefined) {
                throw new Error('No EditorService configured. monaco-editor will not be started.');
            }

            await this.createEditors();
            startingResolve();
            this.logger.info('EditorApp start completed successfully.');
            this.dispatchEvent(new CustomEvent('editorinitialized', {
                bubbles: true,
                composed: true,
                detail: {
                    editor: this.editor,
                    diffEditor: this.diffEditor,
                    editorId: this.editorId,
                    vscodeBundle
                }
            }));
        } catch (error) {
            this.logger.error('Error starting editor:', error);
            throw error;
        } finally {
            this.startingPromise = undefined;
        }
    }

    registerLanguageDefinition(vscodeBundle) {
        const monaco = vscodeBundle.monaco;
        const languageDef = this.config?.languageDef;
        if (!languageDef) {
            return;
        }

        monaco.languages.register(languageDef.languageExtensionConfig);

        const languageRegistered = monaco.languages.getLanguages().filter(
            x => x.id === languageDef.languageExtensionConfig.id
        );
        if (languageRegistered.length === 0) {
            monaco.languages.register({
                id: languageDef.languageExtensionConfig.id
            });
        }

        if (languageDef.monarchLanguage) {
            monaco.languages.setMonarchTokensProvider(
                languageDef.languageExtensionConfig.id,
                languageDef.monarchLanguage
            );
        }

        if (languageDef.theme) {
            monaco.editor.defineTheme(languageDef.theme.name, languageDef.theme.data);
            monaco.editor.setTheme(languageDef.theme.name);
        }
    }

    configureSemanticHighlighting(vscodeBundle) {
        if (this.config?.editorOptions?.['semanticHighlighting.enabled'] === undefined) {
            return;
        }

        const StandaloneServices = vscodeBundle.StandaloneServices;
        const IConfigurationService = vscodeBundle.IConfigurationService;
        const ConfigurationTarget = vscodeBundle.ConfigurationTarget;

        StandaloneServices.get(IConfigurationService).updateValue(
            'editor.semanticHighlighting.enabled',
            this.config.editorOptions['semanticHighlighting.enabled'],
            ConfigurationTarget.USER
        );
    }

    async buildOriginalModelRef() {
        const original = {
            text: this.config?.codeResources?.original?.text ?? '',
            uri: this.config?.codeResources?.original?.uri ?? `default-uri-original-${this.editorId}`,
            enforceLanguageId: this.config?.codeResources?.original?.enforceLanguageId ?? undefined
        };
        this.modelRefs.original = await this.buildModelReference(original);
    }

    async buildModelRefs() {
        const modified = {
            text: this.config?.codeResources?.modified?.text ?? '',
            uri: this.config?.codeResources?.modified?.uri ?? `default-uri-modified-${this.editorId}`,
            enforceLanguageId: this.config?.codeResources?.modified?.enforceLanguageId ?? undefined
        };
        this.modelRefs.modified = await this.buildModelReference(modified);

        if (this.useDiffEditor) {
            await this.buildOriginalModelRef();
        }
    }

    async createDiffEditorInstance(vscodeBundle) {
        const diffEditorOptions = {
            ...this.config?.diffEditorOptions,
            readOnly: this.readOnly
        };
        const createDiffEditor =
            typeof vscodeBundle.createDiffEditor === 'function'
                ? vscodeBundle.createDiffEditor
                : (container, opts) => vscodeBundle.monaco.editor.createDiffEditor(container, opts);
        this.diffEditor = createDiffEditor(this.container, diffEditorOptions);
        const modifiedModel = this.modelRefs.modified?.object?.textEditorModel ?? undefined;
        const originalModel = this.modelRefs.original?.object?.textEditorModel ?? undefined;
        if (modifiedModel !== undefined && originalModel !== undefined) {
            const model = {
                modified: modifiedModel,
                original: originalModel
            };
            this.diffEditor.setModel(model);
            await this.announceModelUpdate(model);
        }
    }

    async createStandardEditorInstance(vscodeBundle) {
        const monaco = vscodeBundle.monaco;
        const editorOptions = {
            ...this.config?.editorOptions,
            readOnly: this.readOnly
        };
        const modifiedModel = this.modelRefs.modified?.object?.textEditorModel;
        this.editor = monaco.editor.create(this.container, {
            ...editorOptions,
            model: modifiedModel
        });
        await this.announceModelUpdate({ modified: modifiedModel });
    }

    async createEditors() {
        const vscodeBundle = await getVscodeBundle();

        this.registerLanguageDefinition(vscodeBundle);
        this.configureSemanticHighlighting(vscodeBundle);
        await this.buildModelRefs();

        this.logger.info(`Starting monaco-editor (${this.editorId})`);

        if (this.useDiffEditor) {
            await this.createDiffEditorInstance(vscodeBundle);
        } else {
            await this.createStandardEditorInstance(vscodeBundle);
        }

        await this.setupDiagnosticsListener();
    }

    async buildModelReference(codeContent) {
        const vscodeBundle = await getVscodeBundle();
        const vscode = vscodeBundle.vscode;
        const createModelReference = vscodeBundle.createModelReference;

        const code = codeContent.text;
        const modelRef = await createModelReference(vscode.Uri.parse(codeContent.uri), code);

        if (modelRef.object.textEditorModel?.getValue() !== code) {
            modelRef.object.textEditorModel?.setValue(code);
        }
        const enforceLanguageId = codeContent.enforceLanguageId;
        if (enforceLanguageId !== undefined) {
            modelRef.object.setLanguageId(enforceLanguageId);
            this.logger?.info(`Main languageId is enforced: ${enforceLanguageId}`);
        }
        return modelRef;
    }

    async announceModelUpdate(textModels) {
        if (this.textChangedHandler) {
            let changed = false;
            if (textModels.modified !== undefined && textModels.modified !== null) {
                const old = this.textChangedDisposables.modified;
                this.textChangedDisposables.modified = textModels.modified.onDidChangeContent(() => {
                    this.didModelContentChange(textModels);
                });
                old?.dispose();
                changed = true;
            }

            if (textModels.original !== undefined && textModels.original !== null) {
                const old = this.textChangedDisposables.original;
                this.textChangedDisposables.original = textModels.original.onDidChangeContent(() => {
                    this.didModelContentChange(textModels);
                });
                old?.dispose();
                changed = true;
            }

            if (changed) {
                this.didModelContentChange(textModels);
            }
        }

        if (textModels.modified !== undefined && textModels.modified !== null) {
            await this.setupDiagnosticsListener();
        }
    }

    didModelContentChange(textModels) {
        const modified = textModels.modified?.getValue() ?? '';
        const original = textModels.original?.getValue() ?? '';
        if (this.textChangedHandler) {
            this.textChangedHandler({
                modified,
                original
            });
        }
    }

    @api
    updateCode(code) {
        if (this.useDiffEditor) {
            if (code.modified !== undefined) {
                this.diffEditor?.getModifiedEditor().setValue(code.modified);
            }
            if (code.original !== undefined) {
                this.diffEditor?.getOriginalEditor().setValue(code.original);
            }
        } else if (code.modified !== undefined) {
            this.editor?.setValue(code.modified);
        }
    }

    checkModelRefUpdates(modelRefs) {
        const updates = { updateModified: false, updateOriginal: false };

        if (modelRefs.modified !== undefined) {
            const newUri = modelRefs.modified?.object?.resource?.path;
            const currentUri = this.modelRefs.modified?.object?.resource?.path;

            if (newUri !== currentUri) {
                this.modelDisposables.modified = this.modelRefs.modified;
                this.modelRefs.modified = modelRefs.modified;
                updates.updateModified = true;
            }
        }

        if (modelRefs.original !== undefined) {
            const newUri = modelRefs.original?.object?.resource?.path;
            const currentUri = this.modelRefs.original?.object?.resource?.path;

            if (newUri !== currentUri) {
                this.modelDisposables.original = this.modelRefs.original;
                this.modelRefs.original = modelRefs.original;
                updates.updateOriginal = true;
            }
        }

        return updates;
    }

    async updateDiffEditorModel() {
        const modified = this.modelRefs.modified?.object?.textEditorModel ?? undefined;
        const original = this.modelRefs.original?.object?.textEditorModel ?? undefined;
        if (modified !== undefined && original !== undefined) {
            const model = {
                modified,
                original
            };
            this.diffEditor?.setModel(model);
            await this.announceModelUpdate(model);
        } else {
            this.logger.warn('Diff Editor: Both modified and original model references are required');
        }
    }

    async updateStandardEditorModel() {
        const modifiedModel = this.modelRefs.modified?.object?.textEditorModel;
        if (modifiedModel !== undefined && modifiedModel !== null) {
            this.editor?.setModel(modifiedModel);
            await this.announceModelUpdate({ modified: modifiedModel });
        } else {
            this.logger.warn('Editor: Modified model reference is invalid');
        }
    }

    @api
    async setModelRefs(modelRefs) {
        if (!modelRefs) {
            this.logger.warn('setModelRefs called with undefined or null modelRefs');
            return;
        }

        const { updateModified, updateOriginal } = this.checkModelRefUpdates(modelRefs);

        if (this.useDiffEditor) {
            if (updateModified || updateOriginal) {
                await this.updateDiffEditorModel();
            } else {
                this.logger.info('Diff Editor: Model references were not updated. They are either unchanged or undefined.');
            }
        } else if (updateModified) {
            await this.updateStandardEditorModel();
        } else {
            this.logger.info('Editor: Model reference was not updated. It is either unchanged or undefined.');
        }
    }

    async checkCodeResourceUpdates(codeResources) {
        const updates = { updateModified: false, updateOriginal: false };

        if (codeResources?.modified !== undefined &&
            codeResources.modified.uri !== this.modelRefs.modified?.object?.resource?.path) {
            this.modelDisposables.modified = this.modelRefs.modified;
            this.modelRefs.modified = await this.buildModelReference(codeResources.modified);
            updates.updateModified = true;
        }
        if (codeResources?.original !== undefined &&
            codeResources.original.uri !== this.modelRefs.original?.object?.resource?.path) {
            this.modelDisposables.original = this.modelRefs.original;
            this.modelRefs.original = await this.buildModelReference(codeResources.original);
            updates.updateOriginal = true;
        }

        return updates;
    }

    async updateDiffEditorFromResources() {
        const modified = this.modelRefs.modified?.object?.textEditorModel ?? undefined;
        const original = this.modelRefs.original?.object?.textEditorModel ?? undefined;
        if (modified !== undefined && original !== undefined) {
            const model = {
                modified,
                original
            };
            this.diffEditor?.setModel(model);
            await this.announceModelUpdate(model);
        }
    }

    async updateStandardEditorFromResources() {
        const model = {
            modified: this.modelRefs.modified?.object?.textEditorModel
        };
        if (model.modified !== undefined && model.modified !== null) {
            this.editor?.setModel(model.modified);
            await this.announceModelUpdate(model);
        }
    }

    @api
    async updateCodeResources(codeResources) {
        const { updateModified, updateOriginal } = await this.checkCodeResourceUpdates(codeResources);

        if (this.useDiffEditor) {
            if (updateModified || updateOriginal) {
                await this.updateDiffEditorFromResources();
            } else {
                this.logger.info('Diff Editor: Code resources were not updated. They are either unchanged or undefined.');
            }
        } else if (updateModified) {
            await this.updateStandardEditorFromResources();
        } else {
            this.logger.info('Editor: Code resources were not updated. They are either unchanged or undefined.');
        }

        await this.disposeModelRefs();
    }

    @api
    updateLayout(dimension, postponeRendering) {
        if (this.useDiffEditor) {
            this.diffEditor?.layout(dimension, postponeRendering);
        } else {
            this.editor?.layout(dimension, postponeRendering);
        }
    }

    @api
    getEditor() {
        return this.editor;
    }

    @api
    getDiffEditor() {
        return this.diffEditor;
    }

    @api
    getTextModels() {
        return {
            modified: this.modelRefs.modified?.object?.textEditorModel ?? undefined,
            original: this.modelRefs.original?.object?.textEditorModel ?? undefined
        };
    }

    @api
    getModelRefs() {
        return {
            modified: this.modelRefs.modified,
            original: this.modelRefs.original
        };
    }

    @api
    async createModelRefFromContent(codeContent) {
        return await this.buildModelReference(codeContent);
    }

    @api
    getLogger() {
        return this.logger;
    }

    @api
    async getVscodeBundle() {
        return await getVscodeBundle();
    }

    @api
    isStarting() {
        return this.startingPromise !== undefined;
    }

    @api
    isStarted() {
        return this.editor !== undefined || this.diffEditor !== undefined;
    }

    @api
    isDisposed() {
        return this.editor === undefined && this.diffEditor === undefined &&
            this.modelDisposables.original === undefined && this.modelDisposables.modified === undefined;
    }

    @api
    isDisposing() {
        return this.disposingPromise !== undefined;
    }

    @api
    async dispose() {
        if (this.isDisposing()) {
            await this.disposingPromise;
            return;
        }

        let disposingResolve;
        this.disposingPromise = new Promise((resolve) => {
            disposingResolve = resolve;
        });

        if (this.editor) {
            this.editor.dispose();
            this.editor = undefined;
        }
        if (this.diffEditor) {
            this.diffEditor.dispose();
            this.diffEditor = undefined;
        }

        this.textChangedDisposables.modified?.dispose();
        this.textChangedDisposables.original?.dispose();
        this.textChangedDisposables.modified = undefined;
        this.textChangedDisposables.original = undefined;

        // Clean up diagnostics listener
        if (this.diagnosticsDisposable) {
            this.diagnosticsDisposable.dispose();
            this.diagnosticsDisposable = null;
        }

        await this.disposeModelRefs();

        disposingResolve();
        this.disposingPromise = undefined;
    }

    async delayDispose(disposeRefs) {
        return new Promise((resolve) => {
            const timeoutId = setTimeout(async () => {
                await disposeRefs();
                resolve();
            }, this.modelRefDisposeTimeout);
            this._disposeTimeoutId = timeoutId;
        });
    }

    async disposeModelRefs() {
        const disposeRefs = async () => {
            const vscodeBundle = await getVscodeBundle();
            if (this.logger?.getLevel() === LogLevel.Debug) {
                const monaco = vscodeBundle.monaco;
                const models = monaco.editor.getModels();
                this.logger.debug('Current model URIs:');
                models.forEach((model) => {
                    this.logger.debug(`${model.uri.toString()}`);
                });
            }

            if (this.modelDisposables.modified !== undefined &&
                !this.modelDisposables.modified.object.isDisposed()) {
                this.modelDisposables.modified.dispose();
                this.modelDisposables.modified = undefined;
            }
            if (this.modelDisposables.original !== undefined &&
                !this.modelDisposables.original.object.isDisposed()) {
                this.modelDisposables.original.dispose();
                this.modelDisposables.original = undefined;
            }

            if (this.logger?.getLevel() === LogLevel.Debug) {
                if (this.modelDisposables.modified === undefined &&
                    this.modelDisposables.original === undefined) {
                    this.logger.debug('All model references are disposed.');
                } else {
                    this.logger.debug('Model references are still available.');
                }
            }
        };

        if (this.modelRefDisposeTimeout > 0) {
            this.logger?.debug('Using async dispose of model references');
            await this.delayDispose(disposeRefs);
        } else {
            await disposeRefs();
        }
    }

    @api
    reportStatus() {
        const status = [];
        status.push('EditorApp status:');
        status.push(`Editor: ${this.editor?.getId()}`);
        status.push(`DiffEditor: ${this.diffEditor?.getId()}`);
        return status;
    }

    get logLevelCode() {
        const map = {
            'off': LogLevel.Off,
            'error': LogLevel.Error,
            'warn': LogLevel.Warn,
            'info': LogLevel.Info,
            'debug': LogLevel.Debug,
            'trace': LogLevel.Trace
        };
        return map[this.logLevel] || LogLevel.Error;
    }
}

