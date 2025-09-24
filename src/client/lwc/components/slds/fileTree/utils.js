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
    const normalizedTerm = caseInsensitive ? String(searchTerm).toLowerCase() : String(searchTerm);
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
    // 2. Filter flat list by search term
    const getItemSearchString = (item) => {
        const isPrimitive = (v) => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean';
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
        return caseInsensitive ? combined.toLowerCase() : combined;
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
    return {
        expandedMap: newExpandedMap,
        matchedIds: matchedIdSet,
    };
}