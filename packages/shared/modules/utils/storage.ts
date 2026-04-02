import { isUndefinedOrNull } from './validation';

/**
 * Storage utilities
 */

export function getFromStorage<T = unknown>(item: string | null, byDefault: T): T {
    try {
        const parsedItem = JSON.parse(item);
        return isUndefinedOrNull(parsedItem) ? byDefault : parsedItem;
    } catch (e) {
        return byDefault;
    }
}

export function safeParseJson<T = unknown>(item: string | null): T | null {
    try {
        const parsedItem = JSON.parse(item);
        return parsedItem;
    } catch (e) {
        return null;
    }
}
