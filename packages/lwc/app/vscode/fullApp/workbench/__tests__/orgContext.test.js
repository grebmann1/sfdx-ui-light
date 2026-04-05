/* eslint-env jest */
const path = require('path');
const { pathToFileURL } = require('url');

let orgContextModule;

beforeAll(async () => {
    orgContextModule = await import(pathToFileURL(path.join(__dirname, '../orgContext.js')).href);
});

describe('orgContext', () => {
    it('prefers the shared alias for the display name', () => {
        expect(
            orgContextModule.buildOrgDisplayName({
                sharedAlias: 'Acme Prod',
                organizationName: 'Acme Corporation',
                username: 'user@example.com',
                instanceUrl: 'https://acme.my.salesforce.com',
            })
        ).toBe('Acme Prod');
    });

    it('classifies production orgs from the sandbox flag', () => {
        expect(
            orgContextModule.inferOrgEnvironment({
                instanceUrl: 'https://acme.my.salesforce.com',
                isSandbox: false,
            })
        ).toBe(orgContextModule.ORG_ENVIRONMENT_TYPES.production);
    });

    it('classifies sandbox orgs from the organization type or host', () => {
        expect(
            orgContextModule.inferOrgEnvironment({
                instanceUrl: 'https://acme--uat.sandbox.my.salesforce.com',
                organizationType: 'Developer Sandbox',
            })
        ).toBe(orgContextModule.ORG_ENVIRONMENT_TYPES.sandbox);
    });

    it('returns a neutral context when no environment can be determined', () => {
        expect(
            orgContextModule.buildOrgContext({
                instanceUrl: 'https://acme.my.salesforce.com',
                accessToken: 'token',
                username: 'user@example.com',
            })
        ).toMatchObject({
            hasConnection: true,
            displayName: 'user@example.com',
            environmentType: orgContextModule.ORG_ENVIRONMENT_TYPES.unknown,
            tone: 'neutral',
        });
    });

    it('normalizes persisted sandbox flag values', () => {
        expect(orgContextModule.normalizeSandboxValue('true')).toBe(true);
        expect(orgContextModule.normalizeSandboxValue('false')).toBe(false);
        expect(orgContextModule.normalizeSandboxValue('')).toBeNull();
    });
});
