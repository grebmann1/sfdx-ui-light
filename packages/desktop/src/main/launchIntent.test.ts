import assert from 'node:assert/strict';
import test from 'node:test';

import {
    createDefaultLaunchIntent,
    parseLaunchIntent,
    serializeLaunchIntent,
} from './launchIntent';

test('parseLaunchIntent returns the default app intent when none is provided', () => {
    assert.deepEqual(parseLaunchIntent(['electron', '.']), createDefaultLaunchIntent());
});

test('parseLaunchIntent restores a serialized org intent', () => {
    const serializedIntent = serializeLaunchIntent({
        target: 'org',
        orgAlias: 'demo-org',
    });

    assert.deepEqual(parseLaunchIntent(['electron', '.', serializedIntent]), {
        target: 'org',
        orgAlias: 'demo-org',
    });
});

test('parseLaunchIntent falls back to the default app intent for invalid payloads', () => {
    assert.deepEqual(
        parseLaunchIntent(['electron', '.', '--desktop-intent=not-a-valid-payload']),
        createDefaultLaunchIntent()
    );
});
