import {
    isSessionAuthErrorMessage,
    resolveBootstrapMode,
    shouldAwaitWorkbenchStartupBootstrap,
    shouldRefreshWorkbenchStartupConnection,
    shouldRemountWorkbenchWorkspace,
    shouldUsePersistedBootstrapSeed,
    shouldUsePersistedSessionBootstrap,
} from '../bootstrapState.ts';

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) {
        throw new Error(message);
    }
}

assert(
    resolveBootstrapMode({
        alias: 'stale@example.com',
        sessionId: 'session-token',
        serverUrl: 'https://example.my.salesforce.com',
    }) === 'session',
    'a live session bootstrap should take precedence over alias metadata'
);

assert(
    resolveBootstrapMode({
        alias: 'alias-only-org',
    }) === 'alias',
    'alias bootstrap should remain available when no live session seed exists'
);

assert(
    shouldUsePersistedBootstrapSeed({
        sourceTabId: '42',
        hasExplicitBootstrap: false,
    }) === false,
    'sourceTabId-only launches should stay disconnected instead of reusing a stored session seed'
);

assert(
    shouldUsePersistedBootstrapSeed({
        sourceTabId: '42',
        hasExplicitBootstrap: true,
    }) === true,
    'explicit launches should still be allowed to consult persisted bootstrap state during reloads'
);

assert(
    !shouldUsePersistedSessionBootstrap({
        alias: 'curious-goat-i1oai0-dev-ed-PROD',
    }),
    'alias-only launches should not silently reuse a persisted session bootstrap'
);

assert(
    shouldUsePersistedSessionBootstrap({
        sessionId: 'session-token',
    }),
    'direct session launches should keep using the persisted session bootstrap path'
);

assert(
    shouldAwaitWorkbenchStartupBootstrap({
        bootstrapMode: 'alias',
        hasUsableConnection: false,
    }),
    'alias launches should wait for bootstrap resolution before mounting the workbench'
);

assert(
    shouldAwaitWorkbenchStartupBootstrap({
        bootstrapMode: 'session',
        hasUsableConnection: false,
    }),
    'session launches should also wait for bootstrap resolution before mounting the workbench'
);

assert(
    !shouldAwaitWorkbenchStartupBootstrap({
        bootstrapMode: 'none',
        hasUsableConnection: false,
    }),
    'disconnected launches should stay non-blocking'
);

assert(
    !shouldAwaitWorkbenchStartupBootstrap({
        bootstrapMode: 'alias',
        hasUsableConnection: true,
    }),
    'startup should not wait when the connection is already usable'
);

assert(
    isSessionAuthErrorMessage('INVALID_SESSION_ID: session expired'),
    'expired session errors should clear the persisted session bootstrap'
);

assert(
    shouldRefreshWorkbenchStartupConnection({
        initialConnection: null,
        latestConnection: {
            instanceUrl: 'https://example.my.salesforce.com',
            accessToken: 'token',
            workspaceRoot: '/workspace/orgs/00Dxx0000000001AAA',
        },
    }),
    'startup should refresh when a connection resolves after the first bootstrap snapshot'
);

assert(
    shouldRefreshWorkbenchStartupConnection({
        initialConnection: {
            instanceUrl: 'https://example.my.salesforce.com',
            accessToken: 'token',
            workspaceRoot: '/workspace',
        },
        latestConnection: {
            instanceUrl: 'https://example.my.salesforce.com',
            accessToken: 'token',
            workspaceRoot: '/workspace/orgs/00Dxx0000000001AAA',
        },
    }),
    'startup should refresh when the later connection snapshot promotes the workspace root'
);

assert(
    shouldRemountWorkbenchWorkspace({
        previousWorkspaceRoot: '/workspace/example.my.salesforce.com',
        nextWorkspaceRoot: '/workspace/orgs/00Dxx0000000001AAA',
    }),
    'legacy host-based roots should remount once the authoritative org root is known'
);

assert(
    !shouldRemountWorkbenchWorkspace({
        previousWorkspaceRoot: '/workspace/orgs/00Dxx0000000001AAA',
        nextWorkspaceRoot: '/workspace/orgs/00Dxx0000000001AAA',
    }),
    'the workbench should not remount when the workspace root is already authoritative'
);
