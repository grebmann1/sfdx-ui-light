import {
    buildPageRefForPath,
    getRequestedPathFromPage,
    normalizeSingleToolPath,
    resolveSingleToolConfig,
} from '../singleToolAppHelpers.ts';

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) {
        throw new Error(message);
    }
}

assert(
    normalizeSingleToolPath('  API  ') === 'api',
    'single tool paths should be normalized and lowercased'
);
assert(
    normalizeSingleToolPath('') === 'api',
    'blank single tool paths should default to API Explorer'
);

const builtPageRef = buildPageRefForPath('SOQL');
assert(
    builtPageRef.type === 'application' && builtPageRef.state.applicationName === 'soql',
    'single tool page refs should always normalize applicationName'
);

assert(
    getRequestedPathFromPage({ state: { applicationName: 'Metadata' } }) === 'metadata',
    'single tool page-ref parsing should read and normalize route application names'
);
assert(
    getRequestedPathFromPage(null) === 'api',
    'missing page refs should safely default to API Explorer'
);

const appList = [
    {
        isOfflineAvailable: false,
        label: 'API Explorer',
        module: () => null,
        name: 'api/app',
        path: 'api',
    },
    {
        isOfflineAvailable: false,
        label: 'SOQL Explorer',
        module: () => null,
        name: 'soql/app',
        path: 'soql',
    },
];

const apiConfig = resolveSingleToolConfig('api', appList, new Set(['api']));
assert(
    apiConfig?.name === 'api/app',
    'single tool resolution should return the allowed API configuration'
);

const rejectedConfig = resolveSingleToolConfig('soql', appList, new Set(['api']));
assert(rejectedConfig === null, 'single tool resolution should reject non-allowlisted tool paths');
