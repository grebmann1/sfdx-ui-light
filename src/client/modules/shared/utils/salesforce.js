function _stripNamespace(apiName,namespace) {
    if (!apiName) return null;
    if (!namespace) return apiName;
    const escapedNamespace = escapeRegExp(namespace);
    const namespacePattern = new RegExp(`^${escapedNamespace}__(.*)$`, 'i');
    const matcher = apiName.match(namespacePattern);
    if (matcher) {
        return matcher[1];
    }
    return apiName;
}

export function stripNamespace(apiName,namespace) {
    if (!apiName) return null;
    if (!namespace) return apiName;
    if (Array.isArray(apiName)) {
        return apiName.map(n => _stripNamespace(n,namespace));
    }
    return apiName
        .split('.')
        .map(n => _stripNamespace(n))
        .join('.');
}


function _fullApiName(apiName,namespace) {
    if (!apiName) return null;
    if (!namespace) return apiName;
    if (MANAGED_NAME_PATTERN.test(apiName)) {
        return `${namespace}__${apiName}`;
    }
    return apiName;
}

export function fullApiName(apiName,namespace) {
    if (!apiName) return null;
    if (!namespace) return apiName;
    if (Array.isArray(apiName)) {
        return apiName.map(n => _fullApiName(n,namespace));
    }
    return apiName
        .split('.')
        .map(n => _fullApiName(n))
        .join('.');
}

export function isSame(apiName1, apiName2) {
    return fullApiName(apiName1,null) === fullApiName(apiName2,null);
}