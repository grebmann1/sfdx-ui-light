/**
 * Collection manipulation utilities
 */

export function groupBy<T extends Record<string, unknown>>(
    items: T[],
    key: keyof T & string
): Record<string, T[]> {
    return items.reduce<Record<string, T[]>>((x, y) => {
        const groupKey = String(y[key]);
        (x[groupKey] = x[groupKey] || []).push(y);
        return x;
    }, {});
}

export function chunkArray<T>(arr: T[], chunkSize: number = 5): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += chunkSize) {
        const chunk = arr.slice(i, i + chunkSize);
        chunks.push(chunk);
    }
    return chunks;
}

export function removeDuplicates<T, K extends keyof T>(arr: T[], prop: K): T[] {
    const unique = new Set<T[K]>();
    const result = arr.filter(item => {
        const val = item[prop];
        const isPresent = unique.has(val);
        unique.add(val); //always add
        return !isPresent;
    });
    return result;
}

export const arrayToMap = <T extends Record<string, unknown>, K extends keyof T & string>(
    array: T[],
    idField: K,
    attributes?: Record<string, unknown>,
    format?: (value: T[K]) => string
): Record<string, T | (T & Record<string, unknown>)> => {
    const _format = format ? format : (x: T[K]) => String(x);
    return array.reduce<Record<string, T | (T & Record<string, unknown>)>>((map, item) => {
        if (item.hasOwnProperty(idField)) {
            map[_format(item[idField])] = attributes
                ? Object.assign({ ...item }, attributes)
                : item;
        }
        return map;
    }, {});
};
