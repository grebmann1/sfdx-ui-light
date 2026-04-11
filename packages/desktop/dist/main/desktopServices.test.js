"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = __importDefault(require("node:test"));
const desktopServiceUtils_1 = require("./desktopServiceUtils");
(0, node_test_1.default)('buildOrgOpenUrl prefers redirect URLs', () => {
    strict_1.default.equal((0, desktopServiceUtils_1.buildOrgOpenUrl)({
        redirectUrl: 'https://example.com/redirect',
        serverUrl: 'https://example.my.salesforce.com',
        sessionId: 'sid',
    }), 'https://example.com/redirect');
});
(0, node_test_1.default)('buildOrgOpenUrl generates a frontdoor URL when session data is provided', () => {
    strict_1.default.equal((0, desktopServiceUtils_1.buildOrgOpenUrl)({
        serverUrl: 'https://example.my.salesforce.com',
        sessionId: '00Dxx!token value',
    }), 'https://example.my.salesforce.com/secur/frontdoor.jsp?sid=00Dxx!token%20value');
});
(0, node_test_1.default)('buildOrgOpenUrl falls back to instanceUrl when serverUrl is absent', () => {
    strict_1.default.equal((0, desktopServiceUtils_1.buildOrgOpenUrl)({
        instanceUrl: 'https://example.my.salesforce.com',
    }), 'https://example.my.salesforce.com');
});
(0, node_test_1.default)('buildOrgOpenUrl returns null when no usable URL exists', () => {
    strict_1.default.equal((0, desktopServiceUtils_1.buildOrgOpenUrl)({}), null);
});
