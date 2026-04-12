import {
    deriveWorkspaceRootFromConnection,
    resolveWorkspaceRootForConnection,
} from '../workspaceIdentity.ts';

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) {
        throw new Error(message);
    }
}

const orgRoot = deriveWorkspaceRootFromConnection({
    orgId: '00Dxx0000000001AAA',
    instanceUrl: 'https://example.my.salesforce.com',
});
assert(
    orgRoot === '/workspace/orgs/00Dxx0000000001AAA',
    'orgId-backed connections should derive an org-scoped workspace root'
);

const secondOrgRoot = deriveWorkspaceRootFromConnection({
    orgId: '00Dxx0000000002AAA',
    instanceUrl: 'https://example.my.salesforce.com',
});
assert(
    secondOrgRoot === '/workspace/orgs/00Dxx0000000002AAA' && secondOrgRoot !== orgRoot,
    'different org ids should map to different workspace roots even on the same host'
);

assert(
    deriveWorkspaceRootFromConnection({
        instanceUrl: 'https://fallback.my.salesforce.com',
    }) === '/workspace/orgs/fallback.my.salesforce.com',
    'host fallback should stay stable when no org id is available'
);

assert(
    resolveWorkspaceRootForConnection({
        connection: {
            orgId: '00Dxx0000000001AAA',
            instanceUrl: 'https://example.my.salesforce.com',
        },
        workspaceRoot: '/workspace',
    }) === '/workspace/orgs/00Dxx0000000001AAA',
    'the default workspace root should promote to the authoritative org root'
);

assert(
    resolveWorkspaceRootForConnection({
        connection: {
            orgId: '00Dxx0000000001AAA',
            instanceUrl: 'https://example.my.salesforce.com',
        },
        workspaceRoot: '/workspace/orgs/example.my.salesforce.com',
    }) === '/workspace/orgs/00Dxx0000000001AAA',
    'legacy host-based roots should migrate to the org-scoped root once org id is known'
);

assert(
    resolveWorkspaceRootForConnection({
        connection: {
            instanceUrl: 'https://fallback.my.salesforce.com',
        },
        workspaceRoot: '/workspace/orgs/fallback.my.salesforce.com',
    }) === '/workspace/orgs/fallback.my.salesforce.com',
    'host fallback roots should remain unchanged until an org id becomes available'
);
