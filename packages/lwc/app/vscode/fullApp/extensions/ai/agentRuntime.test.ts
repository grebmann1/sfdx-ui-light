import { formatWorkbenchRuntimeError } from './agentRuntime';

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) {
        throw new Error(message);
    }
}

const toolSyncError = formatWorkbenchRuntimeError(
    new Error('No tool call found for function call output with call_id abc123')
);
assert(
    toolSyncError.code === 'tool-call-sync',
    'tool call sync failures should map to the dedicated retryable error code'
);

const invalidPayloadError = formatWorkbenchRuntimeError(
    new Error('AI_TypeValidationError: invalid output payload')
);
assert(
    invalidPayloadError.code === 'invalid-stream-payload',
    'invalid payload failures should map to the dedicated streaming payload code'
);

const genericError = formatWorkbenchRuntimeError(new Error('Provider timed out'));
assert(
    genericError.code === 'runtime-error',
    'unexpected errors should keep the generic runtime code'
);
assert(
    genericError.message === 'Provider timed out',
    'unexpected errors should preserve the upstream message'
);
