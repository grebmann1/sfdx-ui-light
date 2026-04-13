import { buildFeaturesCoreService } from '../coreServiceFeatures';

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) {
        throw new Error(message);
    }
}

async function main() {
    let activatedFeatureId = '';
    let activated = false;
    let loginProblemMessage = '';

    const host = {
        activateFeatureOnce: async (featureId, activateFeature) => {
            activatedFeatureId = String(featureId || '');
            await activateFeature();
            return undefined;
        },
        setLoginProblem(message) {
            loginProblemMessage = String(message || '');
        },
    };

    const features = buildFeaturesCoreService(host);
    await features.activateFeature?.('salesforce-metadata', async () => {
        activated = true;
    });
    features.setLoginProblem?.('Connection expired');

    assert(
        activatedFeatureId === 'salesforce-metadata' && activated === true,
        'activateFeature should delegate to the host feature activator'
    );
    assert(
        loginProblemMessage === 'Connection expired',
        'setLoginProblem should proxy to host implementation'
    );
}

main().catch(error => {
    throw error;
});
