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
    it('reports when the injected connector is missing', () => {
        expect(startupConnectionModule.describeStartupConnectionState()).toEqual({
            hasConnection: false,
            message:
                'Salesforce connection is required to open this workbench. Launch it from a connected toolkit session.',
        });
    });

    it('accepts the injected connector context when present', () => {
        expect(
            startupConnectionModule.describeStartupConnectionState({
                instanceUrl: 'https://acme.my.salesforce.com',
                accessToken: 'token',
            })
        ).toEqual({
            hasConnection: true,
            message: null,
        });
    });
});
