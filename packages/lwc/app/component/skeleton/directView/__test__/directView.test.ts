import {
    hasVscodeBootstrapEntrySeed,
    hasVscodeExplicitBootstrap,
    parseVscodeBootstrapSeed,
} from '../../../../../../shared/modules/utils/vscodeBootstrap.ts';

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) {
        throw new Error(message);
    }
}

function isValidDirectViewBootstrap(seed: ReturnType<typeof parseVscodeBootstrapSeed>, variant) {
    return variant === 'vscode'
        ? hasVscodeBootstrapEntrySeed(seed)
        : hasVscodeExplicitBootstrap(seed);
}

const sessionSeed = parseVscodeBootstrapSeed(
    '?sessionId=session-token&serverUrl=https%3A%2F%2Fexample.my.salesforce.com&alias=sandbox-dev'
);
assert(
    isValidDirectViewBootstrap(sessionSeed, 'vscode'),
    'the VS Code direct view should accept a complete session bootstrap seed'
);

const aliasSeed = parseVscodeBootstrapSeed('?alias=sandbox-dev');
assert(
    isValidDirectViewBootstrap(aliasSeed, 'vscode'),
    'the VS Code direct view should still accept alias-only fallback launches'
);
assert(
    isValidDirectViewBootstrap(aliasSeed, 'default'),
    'the default direct view should keep accepting alias-backed launches'
);

const sourceTabOnlySeed = parseVscodeBootstrapSeed('?sourceTabId=42');
assert(
    isValidDirectViewBootstrap(sourceTabOnlySeed, 'vscode'),
    'sourceTabId-only launches should stay valid for the disconnected VS Code import flow'
);
assert(
    !isValidDirectViewBootstrap(sourceTabOnlySeed, 'default'),
    'sourceTabId-only launches should not be treated as a valid non-VS Code explicit session'
);

const partialSessionSeed = parseVscodeBootstrapSeed('?sessionId=missing-server-url');
assert(
    !isValidDirectViewBootstrap(partialSessionSeed, 'vscode'),
    'partial session launch params should be rejected before they reach the VS Code bootstrap'
);
assert(
    partialSessionSeed.sessionId === null && partialSessionSeed.serverUrl === null,
    'partial session params should normalize away consistently across wrappers'
);
