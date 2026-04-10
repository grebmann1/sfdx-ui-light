import { register as registerMetadata } from '../extensions/metadata/extension.js';
import { register as registerApex } from '../extensions/apex/extension.js';
import { register as registerSoql } from '../extensions/soql/extension.js';
import { register as registerLwc } from '../extensions/lwc/extension.js';
import { register as registerAgentScript } from '../extensions/agentscript/extension.js';
import { register as registerWalkthrough } from '../extensions/walkthrough/extension.js';
import { register as registerSoqlMonaco } from '../extensions/salesforcedx-vscode-soql/extension.js';
import { register as registerWorkbenchAi } from '../extensions/ai/extension.js';

const EXTENSION_REGISTRARS = [
    (vscodeBundle, ctx) => registerMetadata(vscodeBundle, ctx),
    /* (vscodeBundle)      => registerApex(vscodeBundle),
    (vscodeBundle)      => registerSoql(vscodeBundle),
    (vscodeBundle)      => registerLwc(vscodeBundle),
    (vscodeBundle)      => registerAgentScript(vscodeBundle),
    (vscodeBundle)      => registerSoqlMonaco(vscodeBundle),
    (vscodeBundle)      => registerWorkbenchAi(vscodeBundle), */
    //(vscodeBundle, ctx) => registerWalkthrough(vscodeBundle, ctx)
];

/**
 * Registers all workbench extensions post-init and returns their disposables.
 *
 * @param {object} vscodeBundle
 * @param {{ orgContext? }} [context]
 * @returns {Promise<{ dispose(): void }[]>}
 */
export async function registerAllExtensions(vscodeBundle, context = {}) {
    const disposables = [];

    for (const registrar of EXTENSION_REGISTRARS) {
        try {
            const disposable = await registrar(vscodeBundle, context);
            if (disposable?.dispose) {
                disposables.push(disposable);
            }
        } catch (error) {
            // eslint-disable-next-line no-console
            console.warn(`[extensionRegistry] Failed to register extension "${registrar.name}":`, error);
        }
    }

    return disposables;
}
