import {
    buildVscodeEditorUrl,
    parseVscodeBootstrapSeed,
} from '../vscodeBootstrap.ts';

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) {
        throw new Error(message);
    }
}

const sessionFirstUrl = buildVscodeEditorUrl({
    baseUrl: '/views/vscode.html',
    baseOrigin: 'https://sf-toolkit.example',
    seed: {
        alias: 'stale@example.com',
        sessionId: 'session-token',
        serverUrl: 'https://example.my.salesforce.com',
    },
});
assert(sessionFirstUrl, 'session bootstrap should build a VS Code URL');
assert(
    sessionFirstUrl.startsWith('https://sf-toolkit.example/views/vscode.html?sessionId='),
    'session bootstrap should be serialized ahead of alias fallback metadata'
);
const sessionFirstSeed = parseVscodeBootstrapSeed(new URL(sessionFirstUrl).search);
assert(
    sessionFirstSeed.sessionId === 'session-token',
    'session bootstrap should preserve the session id'
);
assert(
    sessionFirstSeed.serverUrl === 'https://example.my.salesforce.com',
    'session bootstrap should preserve the server URL'
);
assert(
    sessionFirstSeed.alias === 'stale@example.com',
    'session bootstrap should still carry alias metadata for fallback enrichment and alias-backed reconnect flows'
);

const sessionOnlyUrl = buildVscodeEditorUrl({
    baseUrl: '/views/vscode.html',
    baseOrigin: 'https://sf-toolkit.example',
    seed: {
        sessionId: 'token-only',
        serverUrl: 'https://session-only.my.salesforce.com',
    },
});
assert(sessionOnlyUrl, 'session-only input should still produce a launch URL');
const sessionOnlySeed = parseVscodeBootstrapSeed(new URL(sessionOnlyUrl).search);
assert(
    sessionOnlySeed.sessionId === 'token-only' &&
        sessionOnlySeed.serverUrl === 'https://session-only.my.salesforce.com',
    'session-only input should preserve the live bootstrap pair'
);

const aliasOnlyUrl = buildVscodeEditorUrl({
    baseUrl: '/views/vscode.html',
    baseOrigin: 'https://sf-toolkit.example',
    seed: {
        alias: 'alias-only-org',
    },
});
assert(aliasOnlyUrl, 'alias-only input should still produce a fallback launch URL');
const aliasOnlySeed = parseVscodeBootstrapSeed(new URL(aliasOnlyUrl).search);
assert(
    aliasOnlySeed.alias === 'alias-only-org' &&
        aliasOnlySeed.sessionId === null &&
        aliasOnlySeed.serverUrl === null,
    'alias-only input should stay alias-backed when no live session exists'
);

const blankAliasSessionUrl = buildVscodeEditorUrl({
    baseUrl: '/views/vscode.html',
    baseOrigin: 'https://sf-toolkit.example',
    seed: {
        alias: '   ',
        sessionId: 'token-with-blank-alias',
        serverUrl: 'https://blank-alias.my.salesforce.com',
    },
});
assert(blankAliasSessionUrl, 'blank alias should not suppress a valid session bootstrap');
const blankAliasSessionSeed = parseVscodeBootstrapSeed(new URL(blankAliasSessionUrl).search);
assert(
    blankAliasSessionSeed.sessionId === 'token-with-blank-alias' &&
        blankAliasSessionSeed.alias === null,
    'blank alias input should normalize away while keeping the session bootstrap'
);

assert(
    buildVscodeEditorUrl({
        baseUrl: '/views/vscode.html',
        baseOrigin: 'https://sf-toolkit.example',
        seed: {
            sessionId: 'missing-server-url',
        },
    }) === null,
    'partial session bootstrap should not produce a malformed launch URL'
);
