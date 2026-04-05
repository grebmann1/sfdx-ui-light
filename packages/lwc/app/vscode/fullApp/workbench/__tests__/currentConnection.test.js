/* eslint-env jest */
const path = require('path');
const { pathToFileURL } = require('url');

let currentConnectionModule;

beforeAll(async () => {
    currentConnectionModule = await import(
        pathToFileURL(path.join(__dirname, '../currentConnection.js')).href
    );
});

afterEach(() => {
    currentConnectionModule.clearCurrentConnectionProvider();
});

describe('currentConnection', () => {
    it('returns the live connection from the registered provider', () => {
        currentConnectionModule.setCurrentConnectionProvider(() => ({
            instanceUrl: 'https://acme.my.salesforce.com',
            accessToken: 'token',
            sharedAlias: 'Acme Prod',
        }));

        expect(currentConnectionModule.hasCurrentConnectionProvider()).toBe(true);
        expect(currentConnectionModule.getCurrentConnection()).toEqual({
            instanceUrl: 'https://acme.my.salesforce.com',
            accessToken: 'token',
            sharedAlias: 'Acme Prod',
        });
    });

    it('clears the provider when requested', () => {
        const provider = () => ({
            instanceUrl: 'https://acme.my.salesforce.com',
            accessToken: 'token',
        });
        currentConnectionModule.setCurrentConnectionProvider(provider);

        currentConnectionModule.clearCurrentConnectionProvider(provider);

        expect(currentConnectionModule.hasCurrentConnectionProvider()).toBe(false);
        expect(currentConnectionModule.getCurrentConnection()).toBeNull();
    });
});
