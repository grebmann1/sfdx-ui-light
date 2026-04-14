import type { CoreServices } from '../extensions/core/coreServices';
import type { VscodeBundle } from '../extensions/core/extensionRegistration';

export type RegisterContext = {
    coreServices?: CoreServices;
};

type Disposable = { dispose(): void };

export async function registerExtensionsWithRegistrars(
    vscodeBundle: VscodeBundle,
    context: RegisterContext = {},
    registrars: Array<
        (vscodeBundle: VscodeBundle, ctx?: RegisterContext) => Promise<Disposable | void>
    >
): Promise<Disposable[]> {
    const disposables: Disposable[] = [];

    for (const registrar of registrars) {
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
