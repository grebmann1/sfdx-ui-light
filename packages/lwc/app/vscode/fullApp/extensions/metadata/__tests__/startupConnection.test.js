/* eslint-env jest */
const path = require('path');
const { pathToFileURL } = require('url');

let startupConnectionModule;

beforeAll(async () => {
    startupConnectionModule = await import(
        pathToFileURL(path.join(__dirname, '../runtime/startupConnection.js')).href
    );
});

describe('startupConnection', () => {
    it('prefers a previously selected shared alias', () => {
        expect(
            startupConnectionModule.pickStartupConnectionCandidate({
                currentConnection: {
                    sharedAlias: 'Acme Prod',
                },
                oauthCredentialType: 'oauth',
            })
        ).toEqual({
            type: 'stored-alias',
            connection: {
                sharedAlias: 'Acme Prod',
            },
        });
    });

    it('auto-selects the single saved OAuth org', () => {
        expect(
            startupConnectionModule.pickStartupConnectionCandidate({
                currentConnection: null,
                oauthCredentialType: 'oauth',
                sharedConnectionEntries: [
                    {
                        configuration: {
                            alias: 'Acme Prod',
                            credentialType: 'oauth',
                        },
                    },
                ],
            })
        ).toEqual({
            type: 'shared-oauth',
            configuration: {
                alias: 'Acme Prod',
                credentialType: 'oauth',
            },
        });
    });

    it('does not auto-select when multiple saved OAuth orgs exist', () => {
        expect(
            startupConnectionModule.pickStartupConnectionCandidate({
                currentConnection: null,
                oauthCredentialType: 'oauth',
                sharedConnectionEntries: [
                    {
                        configuration: {
                            alias: 'Acme Prod',
                            credentialType: 'oauth',
                        },
                    },
                    {
                        configuration: {
                            alias: 'Acme UAT',
                            credentialType: 'oauth',
                        },
                    },
                ],
            })
        ).toBeNull();
    });
});
