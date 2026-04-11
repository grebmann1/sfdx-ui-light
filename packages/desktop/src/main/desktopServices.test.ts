import assert from 'node:assert/strict';
import test from 'node:test';

import { buildOrgOpenUrl } from './desktopServiceUtils';

test('buildOrgOpenUrl prefers redirect URLs', () => {
    assert.equal(
        buildOrgOpenUrl({
            redirectUrl: 'https://example.com/redirect',
            serverUrl: 'https://example.my.salesforce.com',
            sessionId: 'sid',
        }),
        'https://example.com/redirect'
    );
});

test('buildOrgOpenUrl generates a frontdoor URL when session data is provided', () => {
    assert.equal(
        buildOrgOpenUrl({
            serverUrl: 'https://example.my.salesforce.com',
            sessionId: '00Dxx!token value',
        }),
        'https://example.my.salesforce.com/secur/frontdoor.jsp?sid=00Dxx!token%20value'
    );
});

test('buildOrgOpenUrl falls back to instanceUrl when serverUrl is absent', () => {
    assert.equal(
        buildOrgOpenUrl({
            instanceUrl: 'https://example.my.salesforce.com',
        }),
        'https://example.my.salesforce.com'
    );
});

test('buildOrgOpenUrl returns null when no usable URL exists', () => {
    assert.equal(buildOrgOpenUrl({}), null);
});
