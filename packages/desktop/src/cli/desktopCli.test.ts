import fs from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';

import { parseCliArgs, resolveElectronBinary } from './desktopCli';

test('parseCliArgs returns the app intent by default', () => {
    assert.deepEqual(parseCliArgs([]), {
        target: 'app',
    });
});

test('parseCliArgs returns an org intent when --org is provided', () => {
    assert.deepEqual(parseCliArgs(['--org', 'demo-org']), {
        target: 'org',
        orgAlias: 'demo-org',
    });
});

test('resolveElectronBinary prefers the package-local Electron install', () => {
    const appPath = '/workspace/packages/desktop';
    const originalExistsSync = fs.existsSync;

    fs.existsSync = pathToCheck =>
        pathToCheck === '/workspace/packages/desktop/node_modules/.bin/electron';

    try {
        assert.equal(
            resolveElectronBinary(appPath),
            '/workspace/packages/desktop/node_modules/.bin/electron'
        );
    } finally {
        fs.existsSync = originalExistsSync;
    }
});

test('resolveElectronBinary falls back to the repo-root Electron install', () => {
    const appPath = '/workspace/packages/desktop';
    const originalExistsSync = fs.existsSync;

    fs.existsSync = pathToCheck => pathToCheck === '/workspace/node_modules/.bin/electron';

    try {
        assert.equal(resolveElectronBinary(appPath), '/workspace/node_modules/.bin/electron');
    } finally {
        fs.existsSync = originalExistsSync;
    }
});
