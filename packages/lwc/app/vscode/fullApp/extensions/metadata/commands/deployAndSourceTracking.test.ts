import { __testables } from './deployAndSourceTracking';

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

const partition = __testables.partitionChangedPathsForDeploy(trackedPaths, mapItems);

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

const picks = __testables.buildChangedFileDeployQuickPickItems(partition.deployablePaths, mapItems);
assert(picks.length === 1, 'deploy quick pick should only include deployable tracked files');
assert(picks[0].label === 'MyClass.cls', 'deploy quick pick label should use the file name');
assert(
    picks[0].detail.includes('ApexClass'),
    'deploy quick pick detail should surface the tracked metadata type'
);

const changedPathSet = new Set(['/workspace/classes/MyClass.cls', '/workspace/classes/Other.cls']);
const successPaths = __testables.pruneChangedPathsForSuccessfulDeploys(changedPathSet, [
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
const workerConnection = __testables.buildDeployWorkerConnection(liveConnection, storedConnection);
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

const fallbackWorkerConnection = __testables.buildDeployWorkerConnection(
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
