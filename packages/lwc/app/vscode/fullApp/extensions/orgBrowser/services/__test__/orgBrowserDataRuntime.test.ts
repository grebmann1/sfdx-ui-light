import { createOrgBrowserDataRuntime } from '../orgBrowserDataRuntime';

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) {
        throw new Error(message);
    }
}

function createMetadataObject(xmlName: string, inFolder: string) {
    return {
        getElementsByTagName(tagName: string) {
            if (tagName === 'xmlName') {
                return [{ textContent: xmlName }];
            }
            if (tagName === 'inFolder') {
                return [{ textContent: inFolder }];
            }
            return [];
        },
    };
}

async function listMetadataTypesForDescribe(describeResult: unknown) {
    const runtime = createOrgBrowserDataRuntime({
        connectionRuntime: {
            loadStoredConn() {
                return {};
            },
            withToolingClientAuthed(_conn, callback) {
                return callback({
                    requestJson: async () => ({}),
                });
            },
        },
        metadataRetrieveRuntime: {
            async withMetadataApiClientAuthed(_conn, callback) {
                return await callback({
                    apiVersion: '63.0',
                    describeMetadata: async () => describeResult,
                });
            },
        },
        state: {},
        vscode: {},
    });

    return await runtime.listMetadataTypes({});
}

async function listMetadataForPayload(listMetadataResult: unknown) {
    const runtime = createOrgBrowserDataRuntime({
        connectionRuntime: {
            loadStoredConn() {
                return {};
            },
            withToolingClientAuthed(_conn, callback) {
                return callback({
                    requestJson: async () => ({}),
                });
            },
        },
        metadataRetrieveRuntime: {
            async withMetadataApiClientAuthed(_conn, callback) {
                return await callback({
                    apiVersion: '63.0',
                    listMetadata: async () => listMetadataResult,
                });
            },
        },
        state: {},
        vscode: {},
    });
    return await runtime.listMetadata('ApexClass', undefined, {});
}

async function main() {
    const jsforceObjectTypes = await listMetadataTypesForDescribe({
        metadataObjects: [
            { inFolder: false, xmlName: 'CustomObject' },
            { inFolder: true, xmlName: 'Report' },
            { inFolder: false, xmlName: '' },
        ],
    });
    assert(jsforceObjectTypes.length === 2, 'should parse metadataObjects arrays from jsforce');
    assert(
        jsforceObjectTypes[0].xmlName === 'CustomObject' && jsforceObjectTypes[0].inFolder === false,
        'should keep non-folder object metadata from jsforce describe payload'
    );
    assert(
        jsforceObjectTypes[1].xmlName === 'Report' && jsforceObjectTypes[1].inFolder === true,
        'should keep folder-backed object metadata from jsforce describe payload'
    );

    const xmlDocumentTypes = await listMetadataTypesForDescribe({
        getElementsByTagName(tagName: string) {
            if (tagName === 'metadataObjects') {
                return [createMetadataObject('ApexClass', 'false')];
            }
            return [];
        },
    });
    assert(
        xmlDocumentTypes.length === 1 &&
            xmlDocumentTypes[0].xmlName === 'ApexClass' &&
            xmlDocumentTypes[0].inFolder === false,
        'should continue parsing XML document-like payloads'
    );

    const malformedTypes = await listMetadataTypesForDescribe({ somethingElse: true });
    assert(
        Array.isArray(malformedTypes) && malformedTypes.length === 0,
        'should safely return an empty list for malformed describe payloads'
    );

    const singletonListResult = await listMetadataForPayload({
        fullName: 'MySingleClass',
        manageableState: 'unmanaged',
    });
    assert(
        singletonListResult.length === 1 && singletonListResult[0].fullName === 'MySingleClass',
        'should normalize singleton listMetadata payload objects into list results'
    );

    const unsupportedManageableState = await listMetadataForPayload({
        fullName: 'ManagedThing',
        manageableState: 'installed',
    });
    assert(
        unsupportedManageableState.length === 0,
        'should continue filtering unsupported manageableState entries'
    );
}

main().catch(error => {
    throw error;
});
