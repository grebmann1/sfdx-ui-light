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

function createVscodeWithObjectXml(objectApiName: string, objectXml: string) {
    const encoder = new TextEncoder();
    return {
        Uri: {
            joinPath(base: { path: string }, ...segments: string[]) {
                return {
                    path: `${base.path}/${segments.join('/')}`.replace(/\/+/g, '/'),
                };
            },
        },
        workspace: {
            workspaceFolders: [{ uri: { path: '/workspace' } }],
            fs: {
                async readFile(uri: { path: string }) {
                    if (
                        uri.path.endsWith(
                            `/objects/${objectApiName}/${objectApiName}.object-meta.xml`
                        )
                    ) {
                        return encoder.encode(objectXml);
                    }
                    throw new Error('File not found');
                },
            },
        },
    };
}

function createVscodeWithoutWorkspaceFolders(objectApiName: string, objectXml: string) {
    const encoder = new TextEncoder();
    return {
        Uri: {
            file(path: string) {
                return { path };
            },
            joinPath(base: { path: string }, ...segments: string[]) {
                return {
                    path: `${base.path}/${segments.join('/')}`.replace(/\/+/g, '/'),
                };
            },
        },
        workspace: {
            fs: {
                async readFile(uri: { path: string }) {
                    if (
                        uri.path.endsWith(
                            `/objects/${objectApiName}/${objectApiName}.object-meta.xml`
                        )
                    ) {
                        return encoder.encode(objectXml);
                    }
                    throw new Error('File not found');
                },
            },
        },
    };
}

function createVscodeWithObjectChildFile(
    objectApiName: string,
    childFolder: string,
    childFile: string
) {
    return {
        Uri: {
            joinPath(base: { path: string }, ...segments: string[]) {
                return {
                    path: `${base.path}/${segments.join('/')}`.replace(/\/+/g, '/'),
                };
            },
        },
        workspace: {
            workspaceFolders: [{ uri: { path: '/workspace' } }],
            fs: {
                async stat(uri: { path: string }) {
                    if (
                        uri.path ===
                        `/workspace/force-app/main/default/objects/${objectApiName}/${childFolder}/${childFile}`
                    ) {
                        return { type: 1 };
                    }
                    throw new Error('missing');
                },
                async readFile() {
                    throw new Error('missing');
                },
            },
        },
    };
}

async function customFieldPresenceFromWorkspace({
    fullName,
    metadataMembers = {},
    objectApiName,
    objectXml,
}: {
    fullName: string;
    metadataMembers?: Record<string, unknown>;
    objectApiName: string;
    objectXml: string;
}) {
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
            async loadMetadataApiMapJson() {
                return {
                    items: {},
                    members: metadataMembers,
                };
            },
            async withMetadataApiClientAuthed(_conn, callback) {
                return await callback({
                    apiVersion: '63.0',
                });
            },
        },
        state: {},
        vscode: createVscodeWithObjectXml(objectApiName, objectXml),
    });

    return await runtime.isMemberPresent('CustomField', fullName);
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
        jsforceObjectTypes[0].xmlName === 'CustomObject' &&
            jsforceObjectTypes[0].inFolder === false,
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

    const fallbackPresence = await customFieldPresenceFromWorkspace({
        fullName: 'Account.Custom_Field__c',
        objectApiName: 'Account',
        objectXml: `
            <CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
                <fields>
                    <fullName>Custom_Field__c</fullName>
                </fields>
            </CustomObject>
        `,
    });
    assert(
        fallbackPresence === true,
        'should fallback to workspace object metadata when custom field is missing from map'
    );

    const mapPresence = await customFieldPresenceFromWorkspace({
        fullName: 'Account.From_Map__c',
        metadataMembers: {
            'CustomField::Account.From_Map__c': {
                type: 'CustomField',
            },
        },
        objectApiName: 'Account',
        objectXml: `<CustomObject />`,
    });
    assert(
        mapPresence === true,
        'should keep map-first custom field presence behavior before using workspace fallback'
    );

    const noFolderPresenceRuntime = createOrgBrowserDataRuntime({
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
            async loadMetadataApiMapJson() {
                return { items: {}, members: {} };
            },
            async withMetadataApiClientAuthed(_conn, callback) {
                return await callback({ apiVersion: '63.0' });
            },
        },
        state: {},
        vscode: createVscodeWithoutWorkspaceFolders(
            'Account',
            `
                <CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
                    <fields><fullName>SLAExpirationDate__c</fullName></fields>
                </CustomObject>
            `
        ),
    });
    const noFolderPresence = await noFolderPresenceRuntime.isMemberPresent(
        'CustomField',
        'Account.SLAExpirationDate__c'
    );
    assert(
        noFolderPresence === true,
        'should fallback to workspace root resolution when workspaceFolders are unavailable'
    );

    const listViewPresenceRuntime = createOrgBrowserDataRuntime({
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
            async loadMetadataApiMapJson() {
                return { items: {}, members: {} };
            },
            async withMetadataApiClientAuthed(_conn, callback) {
                return await callback({ apiVersion: '63.0' });
            },
        },
        state: {},
        vscode: createVscodeWithObjectChildFile(
            'Account',
            'listViews',
            'AllAccounts.listView-meta.xml'
        ),
    });
    const listViewPresent = await listViewPresenceRuntime.isMemberPresent(
        'ListView',
        'Account.AllAccounts'
    );
    assert(
        listViewPresent === true,
        'should detect object child metadata files like listViews from workspace paths when map is stale'
    );
}

main().catch(error => {
    throw error;
});
