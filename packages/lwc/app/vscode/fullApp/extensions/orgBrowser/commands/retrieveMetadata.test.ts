import { createOrgBrowserNode } from '../tree/orgBrowserNode';

import { createRetrieveHandler, __testables } from './retrieveMetadata';

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) {
        throw new Error(message);
    }
}

async function main() {
    const typeNode = createOrgBrowserNode({
        kind: 'type',
        label: 'ApexClass',
        xmlName: 'ApexClass',
    });

    const members = await __testables.getRetrieveMembers(typeNode, {
        async getChildren() {
            return [
                createOrgBrowserNode({
                    componentName: 'MyClass',
                    kind: 'component',
                    label: 'MyClass',
                    xmlName: 'ApexClass',
                }),
                createOrgBrowserNode({
                    componentName: 'OtherClass',
                    kind: 'component',
                    label: 'OtherClass',
                    xmlName: 'ApexClass',
                }),
            ];
        },
    });

    assert(
        members.length === 2 &&
            members[0].fullName === 'MyClass' &&
            members[1].fullName === 'OtherClass',
        'type-level retrieve should expand component children into explicit retrieve members'
    );

    const leafNode = createOrgBrowserNode({
        componentName: 'MyClass',
        filePresent: false,
        kind: 'component',
        label: 'MyClass',
        xmlName: 'ApexClass',
    });
    let refreshCalls = 0;
    let fireCalls = 0;
    let retrievedMembers = null;
    const handler = createRetrieveHandler({
        dataRuntime: {
            async isMemberPresent() {
                return true;
            },
        },
        retrieveService: {
            async retrieveMembers(nextMembers, options) {
                retrievedMembers = { nextMembers, options };
                return { writtenPaths: ['/workspace/force-app/main/default/classes/MyClass.cls'] };
            },
        },
        treeProvider: {
            fireChangeEvent() {
                fireCalls += 1;
            },
            async getChildren() {
                return [];
            },
            async refreshType() {
                refreshCalls += 1;
            },
        },
        vscode: {
            window: {
                async showWarningMessage(_message: string, yesLabel: string) {
                    return yesLabel;
                },
            },
        },
    });

    await handler(leafNode);

    assert(
        Array.isArray(retrievedMembers?.nextMembers) &&
            retrievedMembers.nextMembers.length === 1 &&
            retrievedMembers.nextMembers[0].fullName === 'MyClass',
        'leaf retrieve should request the selected member only'
    );
    assert(
        retrievedMembers?.options?.openFirstFile === true,
        'single-member retrieve should request opening the first retrieved file'
    );
    assert(
        leafNode.filePresent === true,
        'successful leaf retrieve should mark the node as present'
    );
    assert(fireCalls === 1, 'successful leaf retrieve should emit a targeted tree change');
    assert(refreshCalls === 0, 'leaf retrieve should not force a full tree refresh');

    const customObjectNode = createOrgBrowserNode({
        componentName: 'Account',
        filePresent: false,
        kind: 'customObject',
        label: 'Account',
        xmlName: 'CustomObject',
    });
    let customObjectRefreshCalls = 0;
    let customObjectFireCalls = 0;
    let invalidatedObjectKey = '';
    const customObjectHandler = createRetrieveHandler({
        dataRuntime: {
            invalidateCustomObjectFieldPresenceCache(objectName: string) {
                invalidatedObjectKey = objectName;
            },
            async isMemberPresent() {
                return false;
            },
        },
        retrieveService: {
            async retrieveMembers() {
                return {
                    writtenPaths: [
                        '/workspace/force-app/main/default/objects/Account/Account.object-meta.xml',
                    ],
                };
            },
        },
        treeProvider: {
            fireChangeEvent() {
                customObjectFireCalls += 1;
            },
            async getChildren() {
                return [];
            },
            async refreshType() {
                customObjectRefreshCalls += 1;
            },
        },
        vscode: {
            window: {
                async showWarningMessage(_message: string, yesLabel: string) {
                    return yesLabel;
                },
            },
        },
    });
    await customObjectHandler(customObjectNode);
    assert(
        customObjectNode.filePresent === true,
        'custom object retrieve should still mark the object node as present'
    );
    assert(
        invalidatedObjectKey === 'Account',
        'custom object retrieve should invalidate field presence cache for that object'
    );
    assert(
        customObjectRefreshCalls === 1,
        'custom object retrieve should refresh the node so field presence is recomputed'
    );
    assert(
        customObjectFireCalls === 0,
        'custom object retrieve should rely on refresh, not a targeted fire-only update'
    );
}

main().catch(error => {
    throw error;
});
