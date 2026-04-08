import { createDeployAndSourceTracking } from '../metadata/commands/deployAndSourceTracking.js';
import { createActivationContext } from '../metadata/core/activationContext.js';
import {
    createConnectionRuntime,
    createLoginProblemSetter,
    tryRestoreStartupConnection,
} from '../metadata/runtime/connectionRuntime.js';

let activeSalesforceWorkbenchHost = null;

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
            '**/.salesforce/**': true,
            '**/*.map': true,
        };
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
        isLwcDoc() {
            return false;
        },
        async lintLwcDocument() {
            return undefined;
        },
    };
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
        isLwcDoc: (...args) => schemaTools.isLwcDoc(...args),
        lintLwcDocument: (...args) => schemaTools.lintLwcDocument(...args),
        commandGroups: [],
    });

    await tryRestoreStartupConnection({
        connectionRuntime,
        vscode,
        setLoginProblem,
    });

    const features = new Set();
    activeSalesforceWorkbenchHost = {
        connectionRuntime,
        context,
        deployTools,
        schemaTools,
        setLoginProblem,
        async activateFeatureOnce(featureId, activateFeature) {
            if (features.has(featureId)) {
                return this;
            }
            await activateFeature(this);
            features.add(featureId);
            return this;
        },
        setSchemaTools(nextSchemaTools = {}) {
            if (typeof nextSchemaTools.isLwcDoc === 'function') {
                schemaTools.isLwcDoc = nextSchemaTools.isLwcDoc;
            }
            if (typeof nextSchemaTools.lintLwcDocument === 'function') {
                schemaTools.lintLwcDocument = nextSchemaTools.lintLwcDocument;
            }
            deployTools.setLwcDocumentTools(nextSchemaTools);
        },
    };

    return activeSalesforceWorkbenchHost;
}
