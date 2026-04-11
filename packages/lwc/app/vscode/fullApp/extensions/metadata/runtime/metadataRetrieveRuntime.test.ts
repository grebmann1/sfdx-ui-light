import * as helpers from './metadataRetrieveRuntimeHelpers';

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) {
        throw new Error(message);
    }
}

const toolingTypes = [
    'ApexClass',
    'ApexTrigger',
    'LightningComponentBundle',
    'AuraDefinitionBundle',
];
for (const type of toolingTypes) {
    assert(
        helpers.isToolingMetadataType(type),
        `expected ${type} to be treated as a tooling-backed metadata type`
    );
}
assert(
    !helpers.isToolingMetadataType('CustomObject'),
    'non-tooling metadata types should not be marked as tooling-backed'
);

const members = helpers.membersOrAll(new Set(['*', 'Account']));
assert(members.all === true, 'membersOrAll should flag wildcard selections');
assert(
    members.members.length === 1 && members.members[0] === 'Account',
    'membersOrAll should keep explicit selections alongside wildcard detection'
);

const merged = helpers.mergeRetrievedMetadataMembers(
    {
        'CustomObject::Existing__c': {
            type: 'CustomObject',
            fullName: 'Existing__c',
            paths: [
                '/workspace/force-app/main/default/objects/Existing__c/Existing__c.object-meta.xml',
            ],
            retrievedAt: '2026-01-01T00:00:00.000Z',
        },
    },
    new Map([
        ['CustomObject', new Set(['Account', '*'])],
        ['CustomField', new Set(['Account.Name', 'Account.Custom__c'])],
    ]),
    ['/workspace/force-app/main/default/objects/Account/Account.object-meta.xml']
);

assert(
    Object.prototype.hasOwnProperty.call(merged, 'CustomObject::Existing__c'),
    'merge should preserve previously recorded metadata members'
);
assert(
    Object.prototype.hasOwnProperty.call(merged, 'CustomObject::Account'),
    'merge should add explicit object members'
);
assert(
    Object.prototype.hasOwnProperty.call(merged, 'CustomField::Account.Custom__c'),
    'merge should add explicit custom field members'
);
assert(
    !Object.prototype.hasOwnProperty.call(merged, 'CustomObject::*'),
    'merge should not persist wildcard-only metadata keys'
);
assert(
    Array.isArray(merged['CustomField::Account.Custom__c'].paths) &&
        merged['CustomField::Account.Custom__c'].paths.length === 1,
    'merge should retain the retrieved path list for explicit members'
);
