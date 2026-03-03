import { isEmpty } from './validation';

/**
 * Salesforce URL/link generation utilities
 */

export function getObjectSetupLink({ host, sobjectName, durableId, isCustomSetting }) {
    if (sobjectName.endsWith('__mdt')) {
        return getCustomMetadataLink({ host, durableId });
    } else if (isCustomSetting) {
        return `${host}/lightning/setup/CustomSettings/page?address=%2F${durableId}?setupid=CustomSettings`;
    } else if (!isEmpty(durableId) && sobjectName.endsWith('__c')) {
        return `${host}/lightning/setup/ObjectManager/${durableId}/Details/view`;
    } else {
        return `${host}/lightning/setup/ObjectManager/${sobjectName}/Details/view`;
    }
}

export function getCustomMetadataLink({ host, durableId }) {
    if (!host) {
        console.warn('getCustomMetadataLink: host parameter is required');
        return '#';
    }
    return `${host}/lightning/setup/CustomMetadata/page?address=%2F${durableId}%3Fsetupid%3DCustomMetadata`;
}

export function getObjectFieldsSetupLink({ host, sobjectName, durableId, isCustomSetting }) {
    if (sobjectName.endsWith('__mdt')) {
        return getCustomMetadataLink({ host, durableId });
    } else if (isCustomSetting) {
        return `${host}/lightning/setup/CustomSettings/page?address=%2F${durableId}?setupid=CustomSettings`;
    } else if (
        !isEmpty(durableId) &&
        (sobjectName.endsWith('__c') || sobjectName.endsWith('__kav'))
    ) {
        return `${host}/lightning/setup/ObjectManager/${durableId}/FieldsAndRelationships/view`;
    } else {
        return `${host}/lightning/setup/ObjectManager/${sobjectName}/FieldsAndRelationships/view`;
    }
}

export function getObjectFieldDetailSetupLink({
    host,
    sobjectName,
    durableId,
    fieldName,
    fieldNameDurableId,
}) {
    const _sobjectParam =
        sobjectName.endsWith('__c') || sobjectName.endsWith('__kav') ? durableId : sobjectName;
    const _fieldParam =
        sobjectName.endsWith('__c') || sobjectName.endsWith('__kav')
            ? fieldNameDurableId
            : fieldName;

    return `${host}/lightning/setup/ObjectManager/${_sobjectParam}/FieldsAndRelationships/${_fieldParam}/view`;
}

export function getObjectListLink({ host, sobjectName, keyPrefix, isCustomSetting }) {
    if (sobjectName.endsWith('__mdt')) {
        return `${host}/lightning/setup/CustomMetadata/page?address=%2F${keyPrefix}`;
    } else if (isCustomSetting) {
        return `${host}/lightning/setup/CustomSettings/page?address=%2Fsetup%2Fui%2FlistCustomSettingsData.apexp?id=${keyPrefix}`;
    } else {
        return `${host}/lightning/o/${sobjectName}/list`;
    }
}

export function getRecordTypesLink({ host, sobjectName, durableId }) {
    if (sobjectName.endsWith('__c') || sobjectName.endsWith('__kav')) {
        return `${host}/lightning/setup/ObjectManager/${durableId}/RecordTypes/view`;
    } else {
        return `${host}/lightning/setup/ObjectManager/${sobjectName}/RecordTypes/view`;
    }
}

export function getObjectDocLink(sobjectName, isUsingToolingApi) {
    if (isUsingToolingApi) {
        return `https://developer.salesforce.com/docs/atlas.en-us.api_tooling.meta/api_tooling/tooling_api_objects_${sobjectName.toLowerCase()}.htm`;
    }
    return `https://developer.salesforce.com/docs/atlas.en-us.object_reference.meta/object_reference/sforce_api_objects_${sobjectName.toLowerCase()}.htm`;
}
