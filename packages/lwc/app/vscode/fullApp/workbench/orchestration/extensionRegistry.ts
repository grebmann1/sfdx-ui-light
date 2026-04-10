import { register as registerAgentScript } from '../../extensions/agentscript/extension';
import { register as registerWorkbenchAi } from '../../extensions/ai/extension';
import { register as registerApex } from '../../extensions/apex/extension';
import type { VscodeBundle } from '../../extensions/core/extensionRegistration';
import { register as registerLwc } from '../../extensions/lwc/extension';
import { register as registerMetadata } from '../../extensions/metadata/extension';
import { registerUnifiedSoqlExtension } from '../../extensions/soql/unifiedSoqlExtension';
import {
    register as registerWalkthrough,
    type WalkthroughVscodeBundle,
} from '../../extensions/walkthrough/extension';

export type RegisterContext = { orgContext?: Record<string, unknown> };

type Disposable = { dispose(): void };

const EXTENSION_REGISTRARS: Array<
    (vscodeBundle: VscodeBundle, ctx?: RegisterContext) => Promise<Disposable | void>
> = [
    vscodeBundle => registerUnifiedSoqlExtension(vscodeBundle),
    (vscodeBundle, ctx) => registerMetadata(vscodeBundle, ctx),
    vscodeBundle => registerApex(vscodeBundle),
    vscodeBundle => registerLwc(vscodeBundle),
    vscodeBundle => registerAgentScript(vscodeBundle),
    vscodeBundle => registerWorkbenchAi(vscodeBundle),
    (vscodeBundle, ctx) => registerWalkthrough(vscodeBundle as WalkthroughVscodeBundle, ctx),
];

export async function registerAllExtensions(
    vscodeBundle: VscodeBundle,
    context: RegisterContext = {}
): Promise<Disposable[]> {
    const disposables: Disposable[] = [];

    for (const registrar of EXTENSION_REGISTRARS) {
        try {
            const disposable = await registrar(vscodeBundle, context);
            if (disposable && typeof disposable.dispose === 'function') {
                disposables.push(disposable);
            }
        } catch (error) {
            // eslint-disable-next-line no-console
            console.warn('[extensionRegistry] Failed to register extension:', error);
        }
    }

    return disposables;
}
