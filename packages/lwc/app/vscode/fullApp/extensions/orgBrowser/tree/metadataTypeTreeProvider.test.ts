import { MetadataTypeTreeProvider } from './metadataTypeTreeProvider';
import { createOrgBrowserNode } from './orgBrowserNode';

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) {
        throw new Error(message);
    }
}

class MockEventEmitter {
    event = () => {};
    fire() {}
    dispose() {}
}

const vscode = {
    EventEmitter: MockEventEmitter,
    ThemeIcon: class {
        constructor(public id: string) {
            this.id = id;
        }
    },
    TreeItem: class {
        constructor(
            public label: string,
            public collapsibleState: number
        ) {
            this.label = label;
            this.collapsibleState = collapsibleState;
        }
    },
    TreeItemCollapsibleState: {
        Collapsed: 1,
        None: 0,
    },
};

const connectionRuntime = {
    getConnectionProblemMessage() {
        return 'Connect to Salesforce';
    },
    loadStoredConn() {
        return {
            accessToken: 'token',
            instanceUrl: 'https://example.my.salesforce.com',
        };
    },
};

const dataRuntime = {
    async describeCustomObject() {
        return {
            fields: [
                { custom: false, name: 'Name', type: 'string' },
                { custom: true, name: 'Custom_Field__c', type: 'string', length: 80 },
            ],
        };
    },
    async isMemberPresent(type: string, fullName: string) {
        return type === 'CustomField' && fullName === 'Account.Custom_Field__c';
    },
    async listMetadata(type: string, folder?: string) {
        if (type === 'ReportFolder') {
            return [{ fullName: 'Sales Reports' }];
        }
        if (type === 'Report' && folder === 'Sales Reports') {
            return [{ fullName: 'QuarterlyPipeline' }];
        }
        if (type === 'CustomObject') {
            return [{ fullName: 'Account' }];
        }
        return [];
    },
    async listMetadataTypes() {
        return [
            { inFolder: false, xmlName: 'CustomObject' },
            { inFolder: true, xmlName: 'Report' },
        ];
    },
};

async function main() {
    const provider = new MetadataTypeTreeProvider(connectionRuntime, dataRuntime, vscode);

    const rootNodes = await provider.getChildren();
    assert(rootNodes.length === 2, 'root should contain the described metadata types');
    assert(rootNodes[0].xmlName === 'CustomObject', 'root should include CustomObject');
    assert(
        rootNodes[1].kind === 'folderType',
        'folder-backed metadata types should be marked as folder types'
    );

    const objectChildren = await provider.getChildren(
        createOrgBrowserNode({
            componentName: 'Account',
            kind: 'customObject',
            label: 'Account',
            xmlName: 'CustomObject',
        })
    );
    assert(
        objectChildren.length === 1,
        'custom object nodes should only render retrievable custom fields'
    );
    assert(
        objectChildren[0].kind === 'customField',
        'custom fields should use the customField node kind'
    );
    assert(
        objectChildren[0].filePresent === true,
        'custom field nodes should reflect local presence'
    );

    const folderChildren = await provider.getChildren(
        createOrgBrowserNode({
            folderName: 'Sales Reports',
            kind: 'folder',
            label: 'Sales Reports',
            xmlName: 'Report',
        })
    );
    assert(
        folderChildren.length === 1,
        'folder nodes should list the metadata items in that folder'
    );
    assert(
        folderChildren[0].componentName === 'QuarterlyPipeline',
        'folder children should keep the member full name'
    );
}

main().catch(error => {
    throw error;
});
