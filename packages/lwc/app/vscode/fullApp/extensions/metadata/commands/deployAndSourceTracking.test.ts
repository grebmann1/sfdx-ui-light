import * as helpers from './deployAndSourceTrackingHelpers';

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) {
        throw new Error(message);
    }
}

const trackedPaths = [
    '/workspace/classes/MyClass.cls',
    '/workspace/classes/Managed.cls',
    '/workspace/objects/CustomObject.object-meta.xml',
    '/workspace/missing/Unknown.cls',
];

const mapItems = {
    '/workspace/classes/MyClass.cls': {
        type: 'ApexClass',
        id: '01p-valid',
    },
    '/workspace/classes/Managed.cls': {
        type: 'ApexClass',
        id: '01p-readonly',
        readOnly: true,
    },
    '/workspace/objects/CustomObject.object-meta.xml': {
        type: 'CustomObject',
        id: '01I-unsupported',
    },
};

const partition = helpers.partitionChangedPathsForDeploy(trackedPaths, mapItems);

assert(
    partition.deployablePaths.length === 1 &&
        partition.deployablePaths[0] === '/workspace/classes/MyClass.cls',
    'only deployable tracked files should remain in the deployable set'
);
assert(
    partition.readOnlyPaths.length === 1 &&
        partition.readOnlyPaths[0] === '/workspace/classes/Managed.cls',
    'read-only tracked files should be partitioned out'
);
assert(
    partition.unsupportedPaths.length === 1 &&
        partition.unsupportedPaths[0] === '/workspace/objects/CustomObject.object-meta.xml',
    'unsupported tracked files should be partitioned out'
);
assert(
    partition.missingPaths.length === 1 &&
        partition.missingPaths[0] === '/workspace/missing/Unknown.cls',
    'files without tooling-map entries should be partitioned out'
);

const picks = helpers.buildChangedFileDeployQuickPickItems(partition.deployablePaths, mapItems);
assert(picks.length === 1, 'deploy quick pick should only include deployable tracked files');
assert(picks[0].label === 'MyClass.cls', 'deploy quick pick label should use the file name');
assert(
    picks[0].detail.includes('ApexClass'),
    'deploy quick pick detail should surface the tracked metadata type'
);

const changedPathSet = new Set(['/workspace/classes/MyClass.cls', '/workspace/classes/Other.cls']);
const successPaths = helpers.pruneChangedPathsForSuccessfulDeploys(changedPathSet, [
    { ok: true, path: '/workspace/classes/MyClass.cls' },
    { ok: false, path: '/workspace/classes/Other.cls' },
]);
assert(
    successPaths.length === 1 && successPaths[0] === '/workspace/classes/MyClass.cls',
    'successful deploy pruning should report only successful paths'
);
assert(
    !changedPathSet.has('/workspace/classes/MyClass.cls') &&
        changedPathSet.has('/workspace/classes/Other.cls'),
    'successful deploy pruning should only remove successful paths from tracking'
);

const liveConnection = {
    instanceUrl: 'https://live.my.salesforce.com',
    accessToken: 'live-token',
    apiVersion: '62.0',
    refresh: async () => {
        // no-op callback that should never be sent to workers
    },
    nested: {
        listener: () => {},
    },
};
const storedConnection = {
    instanceUrl: 'https://stored.my.salesforce.com',
    accessToken: 'stored-token',
    apiVersion: '61.0',
    refresh: () => {},
};
const workerConnection = helpers.buildDeployWorkerConnection(liveConnection, storedConnection);
assert(
    workerConnection.instanceUrl === 'https://live.my.salesforce.com' &&
        workerConnection.accessToken === 'live-token' &&
        workerConnection.apiVersion === '62.0',
    'worker connection payload should prefer live scalar connection values'
);
assert(
    Object.keys(workerConnection).length === 3 &&
        !('refresh' in workerConnection) &&
        !('nested' in workerConnection),
    'worker connection payload should only include clone-safe scalar fields'
);

const fallbackWorkerConnection = helpers.buildDeployWorkerConnection(
    {
        instanceUrl: '',
        accessToken: '   ',
        apiVersion: null,
    },
    storedConnection
);
assert(
    fallbackWorkerConnection.instanceUrl === 'https://stored.my.salesforce.com' &&
        fallbackWorkerConnection.accessToken === 'stored-token' &&
        fallbackWorkerConnection.apiVersion === '61.0',
    'worker connection payload should fall back to stored scalars when live values are missing'
);

assert(
    typeof helpers.resolveTrackedPath === 'function',
    'resolveTrackedPath should exist to remap stale workspace-root paths'
);

const remappedTrackedPath = helpers.resolveTrackedPath(
    '/workspace/force-app/main/default/classes/MyClass.cls',
    {
        '/workspace/orgs/00Dxx0000000001AAA/force-app/main/default/classes/MyClass.cls': {
            type: 'ApexClass',
            id: '01p-remapped',
        },
    },
    '/workspace/orgs/00Dxx0000000001AAA'
);

assert(
    remappedTrackedPath?.path ===
        '/workspace/orgs/00Dxx0000000001AAA/force-app/main/default/classes/MyClass.cls' &&
        remappedTrackedPath?.entry?.id === '01p-remapped' &&
        remappedTrackedPath?.source === 'remapped',
    'stale current-file paths should remap onto the active workspace root before lookup'
);

assert(
    typeof helpers.classifyToolingCommandPath === 'function',
    'classifyToolingCommandPath should exist to distinguish tooling, metadata-only, and missing paths'
);

const metadataOnlyPath = helpers.classifyToolingCommandPath(
    '/workspace/force-app/main/default/objects/Account/Account.object-meta.xml',
    {},
    {
        '/workspace/orgs/00Dxx0000000001AAA/force-app/main/default/objects/Account/Account.object-meta.xml':
            { zipPath: 'unpackaged/objects/Account/Account.object-meta.xml' },
    },
    '/workspace/orgs/00Dxx0000000001AAA'
);

assert(
    metadataOnlyPath?.status === 'metadata' &&
        metadataOnlyPath?.path ===
            '/workspace/orgs/00Dxx0000000001AAA/force-app/main/default/objects/Account/Account.object-meta.xml',
    'metadata-api-only files should be classified separately from missing tooling-map entries'
);

assert(
    typeof helpers.buildCurrentFileWarningMessage === 'function',
    'buildCurrentFileWarningMessage should exist to return precise current-file warnings'
);

const metadataWarning = helpers.buildCurrentFileWarningMessage(metadataOnlyPath, 'Deploy current file');
assert(
    metadataWarning.includes('Metadata API') &&
        !metadataWarning.includes('not in tooling-map.json'),
    'metadata-only current files should report an unsupported Metadata API warning instead of a missing tooling-map entry'
);
