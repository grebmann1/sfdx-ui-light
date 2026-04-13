type DirectoryTypeRule = {
    type: string;
    suffixes: string[];
};

type ObjectChildTypeRule = {
    type: string;
    suffix: string;
};

export type InferredMetadataMember = {
    type: string;
    fullName: string;
};

const IGNORED_RELATIVE_PREFIXES = ['.salesforce/', '.vscode/', 'manifest/'];

const DIRECTORY_TYPE_RULES: Record<string, DirectoryTypeRule> = {
    applications: {
        type: 'CustomApplication',
        suffixes: ['.app-meta.xml'],
    },
    classes: {
        type: 'ApexClass',
        suffixes: ['.cls-meta.xml', '.cls'],
    },
    flexipages: {
        type: 'FlexiPage',
        suffixes: ['.flexipage-meta.xml'],
    },
    flows: {
        type: 'Flow',
        suffixes: ['.flow-meta.xml'],
    },
    labels: {
        type: 'CustomLabels',
        suffixes: ['.labels-meta.xml'],
    },
    layouts: {
        type: 'Layout',
        suffixes: ['.layout-meta.xml'],
    },
    permissionsets: {
        type: 'PermissionSet',
        suffixes: ['.permissionset-meta.xml'],
    },
    tabs: {
        type: 'CustomTab',
        suffixes: ['.tab-meta.xml'],
    },
    triggers: {
        type: 'ApexTrigger',
        suffixes: ['.trigger-meta.xml', '.trigger'],
    },
};

export const CUSTOM_OBJECT_CHILD_TYPE_RULES: Record<string, ObjectChildTypeRule> = {
    businessProcesses: {
        suffix: '.businessProcess-meta.xml',
        type: 'BusinessProcess',
    },
    compactLayouts: {
        suffix: '.compactLayout-meta.xml',
        type: 'CompactLayout',
    },
    fieldSets: {
        suffix: '.fieldSet-meta.xml',
        type: 'FieldSet',
    },
    fields: {
        suffix: '.field-meta.xml',
        type: 'CustomField',
    },
    indexes: {
        suffix: '.index-meta.xml',
        type: 'Index',
    },
    listViews: {
        suffix: '.listView-meta.xml',
        type: 'ListView',
    },
    recordTypes: {
        suffix: '.recordType-meta.xml',
        type: 'RecordType',
    },
    sharingReasons: {
        suffix: '.sharingReason-meta.xml',
        type: 'SharingReason',
    },
    validationRules: {
        suffix: '.validationRule-meta.xml',
        type: 'ValidationRule',
    },
    webLinks: {
        suffix: '.webLink-meta.xml',
        type: 'WebLink',
    },
};

export function normalizeMetadataPath(value) {
    return String(value || '').replace(/\\/g, '/');
}

export function normalizeRelativeMetadataPath(value) {
    return normalizeMetadataPath(value).replace(/^\/+/, '');
}

function isIgnoredNormalizedRelativePath(normalizedPath) {
    if (!normalizedPath) {
        return true;
    }
    return IGNORED_RELATIVE_PREFIXES.some(prefix => normalizedPath.startsWith(prefix));
}

export function shouldIgnoreMetadataRelativePath(relativePath) {
    return isIgnoredNormalizedRelativePath(normalizeRelativeMetadataPath(relativePath));
}

function trimMetadataSuffix(value, suffix) {
    const normalized = String(value || '');
    return normalized.endsWith(suffix) ? normalized.slice(0, -suffix.length) : normalized;
}

function inferMemberFromDirectoryRule(parentDir, fileName) {
    const rule = DIRECTORY_TYPE_RULES[parentDir];
    if (!rule || !fileName) {
        return null;
    }
    const suffix = rule.suffixes.find(candidate => fileName.endsWith(candidate));
    if (!suffix) {
        return null;
    }
    return {
        type: rule.type,
        fullName: trimMetadataSuffix(fileName, suffix),
    };
}

function inferBundleMember(segments, folderName, typeName) {
    const index = segments.indexOf(folderName);
    return index >= 0 && segments[index + 1]
        ? {
              type: typeName,
              fullName: segments[index + 1],
          }
        : null;
}

function inferCustomObjectMember(segments, leafName) {
    const objectIndex = segments.indexOf('objects');
    if (objectIndex < 0 || !segments[objectIndex + 1]) {
        return null;
    }

    const objectName = segments[objectIndex + 1];
    if (leafName === `${objectName}.object-meta.xml`) {
        return {
            type: 'CustomObject',
            fullName: objectName,
        };
    }

    const childFolder = segments[objectIndex + 2];
    const childRule = childFolder ? CUSTOM_OBJECT_CHILD_TYPE_RULES[childFolder] : null;
    if (!childRule || !leafName.endsWith(childRule.suffix)) {
        return null;
    }

    return {
        type: childRule.type,
        fullName: `${objectName}.${trimMetadataSuffix(leafName, childRule.suffix)}`,
    };
}

export function inferMetadataMemberFromRelativePath(relativePath): InferredMetadataMember | null {
    const normalizedPath = normalizeRelativeMetadataPath(relativePath);
    if (isIgnoredNormalizedRelativePath(normalizedPath)) {
        return null;
    }

    const segments = normalizedPath.split('/').filter(Boolean);
    const leafName = segments[segments.length - 1] || '';
    const parentDir = segments[segments.length - 2] || '';

    const directMatch = inferMemberFromDirectoryRule(parentDir, leafName);
    if (directMatch) {
        return directMatch;
    }

    const lwcMatch = inferBundleMember(segments, 'lwc', 'LightningComponentBundle');
    if (lwcMatch) {
        return lwcMatch;
    }

    const auraMatch = inferBundleMember(segments, 'aura', 'AuraDefinitionBundle');
    if (auraMatch) {
        return auraMatch;
    }

    return inferCustomObjectMember(segments, leafName);
}
