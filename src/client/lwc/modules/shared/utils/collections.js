/**
 * Collection manipulation utilities
 */

export function groupBy(items, key) {
    return items.reduce((x, y) => {
        (x[y[key]] = x[y[key]] || []).push(y);
        return x;
    }, {});
}

export function chunkArray(arr, chunkSize = 5) {
    const chunks = [];
    for (let i = 0; i < arr.length; i += chunkSize) {
        const chunk = arr.slice(i, i + chunkSize);
        chunks.push(chunk);
    }
    return chunks;
}

export function removeDuplicates(arr, prop) {
    const unique = new Set();
    const result = arr.filter(item => {
        const val = item[prop];
        const isPresent = unique.has(val);
        unique.add(val); //always add
        return !isPresent;
    });
    return result;
}

export const arrayToMap = (array, idField, attributes, format) => {
    const _format = format ? format : x => x;
    return array.reduce((map, item) => {
        if (item.hasOwnProperty(idField)) {
            map[_format(item[idField])] = attributes
                ? Object.assign({ ...item }, attributes)
                : item;
        }
        return map;
    }, {});
};
