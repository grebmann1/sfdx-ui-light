"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = __importDefault(require("node:fs"));
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = __importDefault(require("node:test"));
const desktopCli_1 = require("./desktopCli");
(0, node_test_1.default)('parseCliArgs returns the app intent by default', () => {
    strict_1.default.deepEqual((0, desktopCli_1.parseCliArgs)([]), {
        target: 'app',
    });
});
(0, node_test_1.default)('parseCliArgs returns an org intent when --org is provided', () => {
    strict_1.default.deepEqual((0, desktopCli_1.parseCliArgs)(['--org', 'demo-org']), {
        target: 'org',
        orgAlias: 'demo-org',
    });
});
(0, node_test_1.default)('resolveElectronBinary prefers the package-local Electron install', () => {
    const appPath = '/workspace/packages/desktop';
    const originalExistsSync = node_fs_1.default.existsSync;
    node_fs_1.default.existsSync = pathToCheck => pathToCheck === '/workspace/packages/desktop/node_modules/.bin/electron';
    try {
        strict_1.default.equal((0, desktopCli_1.resolveElectronBinary)(appPath), '/workspace/packages/desktop/node_modules/.bin/electron');
    }
    finally {
        node_fs_1.default.existsSync = originalExistsSync;
    }
});
(0, node_test_1.default)('resolveElectronBinary falls back to the repo-root Electron install', () => {
    const appPath = '/workspace/packages/desktop';
    const originalExistsSync = node_fs_1.default.existsSync;
    node_fs_1.default.existsSync = pathToCheck => pathToCheck === '/workspace/node_modules/.bin/electron';
    try {
        strict_1.default.equal((0, desktopCli_1.resolveElectronBinary)(appPath), '/workspace/node_modules/.bin/electron');
    }
    finally {
        node_fs_1.default.existsSync = originalExistsSync;
    }
});
