import { hasUsableConnection } from '../workbenchConnection';
import { createDeployAndSourceTracking } from '../extensions/metadata/commands/deployAndSourceTracking';
import { createActivationContext } from '../extensions/metadata/core/activationContext';
import {
    createConnectionRuntime,
    createLoginProblemSetter,
    tryRestoreStartupConnection,
} from '../extensions/metadata/runtime/connectionRuntime';

let activeSalesforceWorkbenchHost = null;

type SchemaToolsApi = {
    ensureGlobalDescribe: (conn?: unknown, options?: { force?: boolean }) => Promise<unknown>;
    ensureSObjectDescribe: (conn?: unknown, name?: string, options?: { force?: boolean }) => Promise<unknown>;
    isLwcDoc: (doc?: unknown) => boolean;
    lintLwcDocument: (doc?: unknown) => Promise<unknown>;
    loadSchemaCache: () => Promise<Record<string, unknown>>;
};

function buildSchemaBootstrapKey(conn) {
    if (!hasUsableConnection(conn)) {
        return '';
    }
    return [
        String(conn.instanceUrl || '').trim(),
        String(conn.workspaceRoot || '').trim(),
        String(conn.apiVersion || '').trim(),
    ].join('::');
}

export function getActiveSalesforceWorkbenchHost() {
    return activeSalesforceWorkbenchHost;
}

async function applyExplorerExcludes(vscode) {
    try {
        if (typeof vscode.workspace?.getConfiguration !== 'function') {
            return;
        }
        const filesConfig = vscode.workspace.getConfiguration('files');
        const current =
            (typeof filesConfig?.get === 'function' && filesConfig.get('exclude')) || {};
        const merged = {
            ...(current && typeof current === 'object' ? current : {}),
            '**/*.map': true,
        };
        delete merged['**/.salesforce/**']; // just in case of caching issues.
        if (typeof filesConfig?.update === 'function') {
            try {
                await filesConfig.update('exclude', merged, true);
            } catch {
                await filesConfig.update('exclude', merged);
            }
        }
    } catch {
        // ignore
    }
}

function createNoopSchemaTools() {
    return {
        async ensureGlobalDescribe() {
            return null;
        },
        async ensureSObjectDescribe() {
            return null;
        },
        isLwcDoc() {
            return false;
        },
        async lintLwcDocument() {
            return undefined;
        },
        async loadSchemaCache() {
            return { objects: {} };
        },
    } as SchemaToolsApi;
}

export async function getOrCreateSalesforceWorkbenchHost(vscodeBundle) {
    if (activeSalesforceWorkbenchHost) {
        return activeSalesforceWorkbenchHost;
    }

    const context = createActivationContext(vscodeBundle);
    if (!context) {
        return null;
    }

    const { diagnostics, statusItem, vscode } = context;
    await applyExplorerExcludes(vscode);

    const setLoginProblem = createLoginProblemSetter({
        loginDiagnostics: diagnostics.login,
        vscode,
    });
    const connectionRuntime = createConnectionRuntime({ statusItem, vscode });
    connectionRuntime.setStatus(connectionRuntime.loadStoredConn());

    const schemaTools = createNoopSchemaTools();
    const deployTools = createDeployAndSourceTracking({
        connectionRuntime,
        context,
        isLwcDoc: doc => schemaTools.isLwcDoc(doc),
        lintLwcDocument: doc => schemaTools.lintLwcDocument(doc),
        commandGroups: [],
    });

    await tryRestoreStartupConnection({
        connectionRuntime,
        setLoginProblem,
    });

    const features = new Set();
    const schemaBootstrapState = {
        lastAttemptedKey: '',
        inFlightKey: '',
        inFlightPromise: null,
    };
    activeSalesforceWorkbenchHost = {
        connectionRuntime,
        context,
        deployTools,
        schemaTools,
        setLoginProblem,
        resetSchemaBootstrap(identity?: {
            instanceUrl?: string;
            workspaceRoot?: string;
            apiVersion?: string;
        }) {
            const nextKey = buildSchemaBootstrapKey(identity);
            if (!nextKey || nextKey !== schemaBootstrapState.lastAttemptedKey) {
                schemaBootstrapState.lastAttemptedKey = '';
            }
            schemaBootstrapState.inFlightKey = '';
            schemaBootstrapState.inFlightPromise = null;
        },
        scheduleSchemaBootstrap(conn = connectionRuntime.loadStoredConn(), { force = false } = {}) {
            const key = buildSchemaBootstrapKey(conn);
            if (!key || typeof schemaTools.ensureGlobalDescribe !== 'function') {
                return null;
            }
            if (!force) {
                if (
                    schemaBootstrapState.inFlightPromise &&
                    schemaBootstrapState.inFlightKey === key
                ) {
                    return schemaBootstrapState.inFlightPromise;
                }
                if (schemaBootstrapState.lastAttemptedKey === key) {
                    return null;
                }
            }

            schemaBootstrapState.lastAttemptedKey = key;
            schemaBootstrapState.inFlightKey = key;
            schemaBootstrapState.inFlightPromise = Promise.resolve()
                .then(() => schemaTools.ensureGlobalDescribe(conn, { force }))
                .catch(() => null)
                .finally(() => {
                    if (schemaBootstrapState.inFlightKey === key) {
                        schemaBootstrapState.inFlightKey = '';
                        schemaBootstrapState.inFlightPromise = null;
                    }
                });
            return schemaBootstrapState.inFlightPromise;
        },
        async activateFeatureOnce(featureId, activateFeature) {
            if (features.has(featureId)) {
                return this;
            }
            await activateFeature(this);
            features.add(featureId);
            return this;
        },
        setSchemaTools(nextSchemaTools: Partial<SchemaToolsApi> = {}) {
            if (typeof nextSchemaTools.ensureGlobalDescribe === 'function') {
                schemaTools.ensureGlobalDescribe = nextSchemaTools.ensureGlobalDescribe;
            }
            if (typeof nextSchemaTools.isLwcDoc === 'function') {
                schemaTools.isLwcDoc = nextSchemaTools.isLwcDoc;
            }
            if (typeof nextSchemaTools.lintLwcDocument === 'function') {
                schemaTools.lintLwcDocument = nextSchemaTools.lintLwcDocument;
            }
            if (typeof nextSchemaTools.ensureSObjectDescribe === 'function') {
                schemaTools.ensureSObjectDescribe = nextSchemaTools.ensureSObjectDescribe;
            }
            if (typeof nextSchemaTools.loadSchemaCache === 'function') {
                schemaTools.loadSchemaCache = nextSchemaTools.loadSchemaCache;
            }
            deployTools.setLwcDocumentTools(nextSchemaTools);
            void this.scheduleSchemaBootstrap();
        },
    };

    const removeStatusListener = connectionRuntime.addStatusChangeListener(conn => {
        if (!hasUsableConnection(conn)) {
            activeSalesforceWorkbenchHost?.resetSchemaBootstrap(conn);
            return;
        }
        void activeSalesforceWorkbenchHost?.scheduleSchemaBootstrap(conn);
    });
    context.addDisposable({ dispose: removeStatusListener });

    return activeSalesforceWorkbenchHost;
}
