import { registerExtensionsWithRegistrars } from '../extensionRegistryRuntime';

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) {
        throw new Error(message);
    }
}

async function main() {
    const receivedContexts: Array<Record<string, unknown>> = [];
    const fakeDisposable = { dispose() {} };
    const fakeCoreServices = {
        features: {
            activateOnce: async () => undefined,
        },
    };

    const registrars = [
        async (_bundle, ctx) => {
            receivedContexts.push((ctx || {}) as Record<string, unknown>);
            return fakeDisposable;
        },
        async (_bundle, ctx) => {
            receivedContexts.push((ctx || {}) as Record<string, unknown>);
            return undefined;
        },
    ];

    const disposables = await registerExtensionsWithRegistrars(
        {} as any,
        {
            coreServices: fakeCoreServices,
            orgContext: { orgId: '00Dxx0000000001' },
        },
        registrars
    );

    assert(receivedContexts.length === 2, 'all injected registrars should receive context');
    assert(
        receivedContexts.every(ctx => ctx.coreServices === fakeCoreServices),
        'coreServices should be passed to every registrar'
    );
    assert(
        disposables.length === 1 && disposables[0] === fakeDisposable,
        'registerAllExtensions should only collect valid disposables'
    );
}

main().catch(error => {
    throw error;
});
