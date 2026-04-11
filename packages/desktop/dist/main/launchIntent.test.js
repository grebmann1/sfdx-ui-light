"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = __importDefault(require("node:test"));
const launchIntent_1 = require("./launchIntent");
(0, node_test_1.default)('parseLaunchIntent returns the default app intent when none is provided', () => {
    strict_1.default.deepEqual((0, launchIntent_1.parseLaunchIntent)(['electron', '.']), (0, launchIntent_1.createDefaultLaunchIntent)());
});
(0, node_test_1.default)('parseLaunchIntent restores a serialized org intent', () => {
    const serializedIntent = (0, launchIntent_1.serializeLaunchIntent)({
        target: 'org',
        orgAlias: 'demo-org',
    });
    strict_1.default.deepEqual((0, launchIntent_1.parseLaunchIntent)(['electron', '.', serializedIntent]), {
        target: 'org',
        orgAlias: 'demo-org',
    });
});
(0, node_test_1.default)('parseLaunchIntent falls back to the default app intent for invalid payloads', () => {
    strict_1.default.deepEqual((0, launchIntent_1.parseLaunchIntent)(['electron', '.', '--desktop-intent=not-a-valid-payload']), (0, launchIntent_1.createDefaultLaunchIntent)());
});
