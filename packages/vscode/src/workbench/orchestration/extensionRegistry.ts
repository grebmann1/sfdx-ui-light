import { register as registerAgentScript } from '../extensions/agentscript/extension';
import { register as registerWorkbenchAi } from '../extensions/ai/extension';
import { register as registerApex } from '../extensions/apex/extension';
import type { VscodeBundle } from '../extensions/core/extensionRegistration';
import { register as registerLwc } from '../extensions/lwc/extension';
import { register as registerMetadata } from '../extensions/metadata/extension';
import { register as registerOrgBrowser } from '../extensions/orgBrowser/extension';
import { registerUnifiedSoqlExtension } from '../extensions/soql/unifiedSoqlExtension';
import { register as registerTerminal } from '../extensions/terminal/extension';
import { register as registerWalkthrough, type WalkthroughVscodeBundle } from '../extensions/walkthrough/extension';
import { registerExtensionsWithRegistrars, type RegisterContext } from './extensionRegistryRuntime';

type Disposable = { dispose(): void };

const EXTENSION_REGISTRARS: Array<
    (vscodeBundle: VscodeBundle, ctx?: RegisterContext) => Promise<Disposable | void>
> = [
    (vscodeBundle, ctx) => registerUnifiedSoqlExtension(vscodeBundle, ctx),
    (vscodeBundle, ctx) => registerMetadata(vscodeBundle, ctx),
    (vscodeBundle, ctx) => registerOrgBrowser(vscodeBundle, ctx),
    (vscodeBundle, ctx) => registerApex(vscodeBundle, ctx),
    (vscodeBundle, ctx) => registerLwc(vscodeBundle, ctx),
    vscodeBundle => registerAgentScript(vscodeBundle),
    vscodeBundle => registerWorkbenchAi(vscodeBundle),
    (vscodeBundle, ctx) => registerTerminal(vscodeBundle, ctx),
    (vscodeBundle, ctx) => registerWalkthrough(vscodeBundle as WalkthroughVscodeBundle, ctx),
];

export async function registerAllExtensions(
    vscodeBundle: VscodeBundle,
    context: RegisterContext = {},
    registrars: Array<
        (vscodeBundle: VscodeBundle, ctx?: RegisterContext) => Promise<Disposable | void>
    > = EXTENSION_REGISTRARS
): Promise<Disposable[]> {
    return await registerExtensionsWithRegistrars(vscodeBundle, context, registrars);
}
