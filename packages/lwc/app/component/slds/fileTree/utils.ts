/**
 * Normalizes a string for search comparisons:
 * - lowercases
 * - treats underscores and spaces as equivalent by converting to single spaces
 * - collapses multiple spaces and trims
 */
export function normalizeForSearch(input) {
    if (typeof input !== 'string') {
        return '';
    }
    return input
        .toLowerCase()
        .replace(/[_\s]+/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim();
}

export function searchDirectories(searchTerm, tree, expandedMap = {}, options = {}) {
    const {
        searchFields = ['name', 'id'],
        minSearchLength = 3,
        caseInsensitive = true,
        includeFoldersInResults = true,
    } = options || {};

    if (!searchTerm || !tree) {
        return {
            expandedMap: {},
            matchedIds: new Set(),
        };
    }
    const normalizedTerm = normalizeForSearch(String(searchTerm));
    if (normalizedTerm.length < minSearchLength) {
        return {
            expandedMap: {},
            matchedIds: new Set(),
        };
    }
    // 1. Flatten the tree
    const flatList = [];
    function flatten(items, parentIds = []) {
        items.forEach(item => {
            flatList.push({ ...item, parentIds });
            if (item.children && item.children.length > 0) {
                flatten(item.children, [...parentIds, item.id]);
            }
        });
    }
    flatten(tree);
    // 2. Filter flat list by search term (use normalizeForSearch for underscore/space equivalence)
    const getItemSearchString = item => {
        const isPrimitive = v =>
            typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean';
        const values = [];
        for (const field of searchFields) {
            const value = item && item[field];
            if (Array.isArray(value)) {
                const joined = value.filter(isPrimitive).map(String).join(' ');
                if (joined) values.push(joined);
            } else if (isPrimitive(value)) {
                values.push(String(value));
            }
        }
        const combined = values.join(' ').trim().replace(/\s+/g, ' ');
        const str = caseInsensitive ? combined.toLowerCase() : combined;
        return normalizeForSearch(str);
    };

    const filtered = flatList.filter(item => {
        // If folders should not be considered matches themselves
        if (!includeFoldersInResults && Array.isArray(item.children)) {
            return false;
        }
        return getItemSearchString(item).includes(normalizedTerm);
    });
    // 3. Collect all parentIds to expand (ancestors of matches)
    const expandedSet = new Set();
    filtered.forEach(item => {
        item.parentIds.forEach(pid => expandedSet.add(pid));
    });
    // 4. Collect matched item ids
    const matchedIdSet = new Set(filtered.map(i => i.id));
    // 5. Build expandedMap
    const newExpandedMap = { ...expandedMap };
    expandedSet.forEach(id => {
        newExpandedMap[id] = true;
    });
    // 6. nonMatchesInDirectory: leaf nodes in expanded folders that don't match (reference visibility)
    const nonMatchesInDirectory = new Set();
    flatList.forEach((entry) => {
        const isLeaf = !(entry.children && entry.children.length > 0);
        const parentId = entry.parentIds.length > 0 ? entry.parentIds[entry.parentIds.length - 1] : null;
        const parentExpanded =
            parentId === null || expandedSet.has(parentId) || newExpandedMap[parentId];
        if (isLeaf && parentExpanded && !matchedIdSet.has(entry.id)) {
            nonMatchesInDirectory.add(entry.id);
        }
    });
    return {
        expandedMap: newExpandedMap,
        matchedIds: matchedIdSet,
        nonMatchesInDirectory,
    };
}
