export const TOOLING_METADATA_TYPES = new Set([
    'ApexClass',
    'ApexTrigger',
    'LightningComponentBundle',
    'AuraDefinitionBundle',
]);

function cloneMetadataMapEntry(entry) {
    if (!entry || typeof entry !== 'object') {
        return null;
    }
    const paths = Array.isArray(entry.paths) ? entry.paths.filter(Boolean) : [];
    return {
        ...entry,
        paths,
    };
}

export function membersOrAll(set) {
    const nextSet = set instanceof Set ? set : new Set();
    return {
        all: nextSet.has('*'),
        members: Array.from(nextSet).filter(member => member && member !== '*'),
    };
}

export function buildMetadataMemberKey(type, fullName) {
    return `${String(type || '').trim()}::${String(fullName || '').trim()}`;
}

export function mergeRetrievedMetadataMembers(existingMembers, typesMap, writtenPaths) {
    const nextMembers =
        existingMembers && typeof existingMembers === 'object' ? { ...existingMembers } : {};
    const retrievedAt = new Date().toISOString();
    const normalizedPaths = Array.isArray(writtenPaths) ? writtenPaths.filter(Boolean) : [];
    for (const [type, rawMembers] of typesMap instanceof Map ? typesMap.entries() : []) {
        for (const fullName of rawMembers instanceof Set ? rawMembers : []) {
            if (!fullName || fullName === '*') {
                continue;
            }
            const key = buildMetadataMemberKey(type, fullName);
            const previous = cloneMetadataMapEntry(nextMembers[key]) || {};
            nextMembers[key] = {
                ...previous,
                type,
                fullName,
                paths: normalizedPaths,
                retrievedAt,
            };
        }
    }
    return nextMembers;
}

export function isToolingMetadataType(type) {
    return TOOLING_METADATA_TYPES.has(String(type || '').trim());
}
