export function searchDirectories(searchTerm, tree, expandedMap = {}) {
    if (!searchTerm || !tree) {
        return {
            expandedMap: {},
            nonMatchesInDirectory: new Set(),
        };
    }
    const searchTermLower = searchTerm.toLowerCase();
    if (searchTermLower.length < 3) {
        return {
            expandedMap: {},
            nonMatchesInDirectory: new Set(),
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
    const filtered = flatList.filter(item => {
        const concat = `${item.name} ${item.id}`.toLowerCase();
        return concat.includes(searchTermLower);
    });
    // 3. Collect all parentIds to expand
    const expandedSet = new Set();
    filtered.forEach(item => {
        item.parentIds.forEach(pid => expandedSet.add(pid));
    });
    // 4. Collect non-matching children under expanded parents
    const nonMatchesInDirectory = new Set();
    flatList.forEach(item => {
        // If item's parent is expanded, but item itself is not a match
        const parentId = item.parentIds[item.parentIds.length - 1];
        if (parentId && expandedSet.has(parentId)) {
            const concat = `${item.name} ${item.id}`.toLowerCase();
            if (!concat.includes(searchTermLower)) {
                nonMatchesInDirectory.add(item.id);
            }
        }
    });
    // 5. Build expandedMap
    const newExpandedMap = { ...expandedMap };
    expandedSet.forEach(id => {
        newExpandedMap[id] = true;
    });
    return {
        expandedMap: newExpandedMap,
        nonMatchesInDirectory,
    };
}