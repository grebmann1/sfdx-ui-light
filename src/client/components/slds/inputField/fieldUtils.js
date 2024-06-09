export function isCompoundField(field, objectInfo, personAccount = false) {
    const fieldInfo = objectInfo.fields.find(x => x.name === field);
    if (!fieldInfo) {
        // a field that does not exist is not compound
        // this is safety to prevent gacks and probably should not generally happen
        return false;
    }

    if (fieldInfo.compound === false) {
        return false;
    }

    objectInfo.fields.forEach(item => {
        if (item !== field && item.compoundFieldName === field) {
            // special case for when person accounts are enabled, but this is not a personAccount. In this case
            // the Name field of an account looks like a compound field but is not.
            if (
                objectInfo.name === 'Account' && item.compoundFieldName === 'Name' && !personAccount
            ) {
                return false;
            }

            return true;
        }
    })

    return false;
}

export function isPersonAccount(record) {
    return record.IsPersonAccount;
}

export function getCompoundFields(field, record, objectInfo) {
    return Object.keys(objectInfo.fields).filter(key => {
        return (
            key !== field &&
            record.fields[key] &&
            objectInfo.fields[key].compoundFieldName === field
        );
    });
}

export const FieldTypes = {
    BOOLEAN: 'boolean',
    CURRENCY: 'currency',
    DATE: 'date',
    TIME: 'time',
    DATETIME: 'datetime',
    EMAIL: 'email',
    LOCATION: 'location',
    ADDRESS: 'address',
    PICKLIST: 'picklist',
    MULTI_PICKLIST: 'multipicklist',
    PERCENT: 'percent',
    PHONE: 'phone',
    REFERENCE: 'reference',
    STRING: 'string',
    TEXT: 'text',
    TEXTAREA: 'textarea',
    RICH_TEXTAREA: 'richtextarea',
    ENCRYPTED_STRING: 'encryptedstring',
    URL: 'url',
    INT: 'int',
    DOUBLE: 'double',
    DECIMAL: 'decimal',
    PERSON_NAME: 'personname',
    PLAIN_TEXTAREA: 'plaintextarea',
    COMPLEX_VALUE: 'ComplexValue',
    BASE64: 'Base64',
    SWITCHABLE_PERSON_NAME: 'SwitchablePersonName',
};