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

function normalizeMemberPathMap(memberPathsByKey) {
    const next = {};
    for (const [key, rawPaths] of Object.entries(memberPathsByKey || {})) {
        next[String(key)] = Array.isArray(rawPaths) ? rawPaths.filter(Boolean) : [];
    }
    return next;
}

export function mergeRetrievedMetadataMembers(
    existingMembers,
    typesMap,
    writtenPaths,
    options = {}
) {
    const nextMembers =
        existingMembers && typeof existingMembers === 'object' ? { ...existingMembers } : {};
    const retrievedAt = new Date().toISOString();
    const normalizedPaths = Array.isArray(writtenPaths) ? writtenPaths.filter(Boolean) : [];
    const perMemberPaths = normalizeMemberPathMap(options.memberPathsByKey);
    const membersByKey = new Map();

    for (const [type, rawMembers] of typesMap instanceof Map ? typesMap.entries() : []) {
        for (const fullName of rawMembers instanceof Set ? rawMembers : []) {
            if (!fullName || fullName === '*') {
                continue;
            }
            membersByKey.set(buildMetadataMemberKey(type, fullName), {
                type: String(type || ''),
                fullName: String(fullName || ''),
            });
        }
    }
    for (const member of Array.isArray(options.additionalMembers)
        ? options.additionalMembers
        : []) {
        const type = String(member?.type || '').trim();
        const fullName = String(member?.fullName || '').trim();
        if (!type || !fullName) {
            continue;
        }
        membersByKey.set(buildMetadataMemberKey(type, fullName), {
            type,
            fullName,
        });
    }

    for (const [key, value] of membersByKey.entries()) {
        const { type, fullName } = value;
        const previous = cloneMetadataMapEntry(nextMembers[key]) || {};
        nextMembers[key] = {
            ...previous,
            type,
            fullName,
            paths: perMemberPaths[key]?.length ? perMemberPaths[key] : normalizedPaths,
            retrievedAt,
        };
    }
    return nextMembers;
}

export function isToolingMetadataType(type) {
    return TOOLING_METADATA_TYPES.has(String(type || '').trim());
}
