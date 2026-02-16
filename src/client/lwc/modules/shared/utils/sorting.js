/**
 * Sorting utilities
 */

export function sortObjectsByField(objects, field, order) {
    // Define a map for storing the order of each element
    const orderMap = {};
    order.forEach((item, index) => {
        orderMap[item] = index;
    });

    // Sort function
    return objects.sort((a, b) => {
        // Get the order index, default to a large number if the item is not in the order array
        const orderA = orderMap.hasOwnProperty(a[field]) ? orderMap[a[field]] : 999;
        const orderB = orderMap.hasOwnProperty(b[field]) ? orderMap[b[field]] : 999;

        // Compare the order indices
        return orderA - orderB;
    });
}

export function getCurrentRank(mapping, check) {
    for (let i = 0; i < mapping.length; i++) {
        if (check(mapping[i])) {
            return i;
        }
    }
    return mapping.length - 1;
}
