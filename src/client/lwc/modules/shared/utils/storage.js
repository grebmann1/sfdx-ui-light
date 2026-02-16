import { isUndefinedOrNull } from './validation';

/**
 * Storage utilities
 */

export function getFromStorage(item, byDefault) {
    try {
        const parsedItem = JSON.parse(item);
        return isUndefinedOrNull(parsedItem) ? byDefault : parsedItem;
    } catch (e) {
        return byDefault;
    }
}

export function safeParseJson(item) {
    try {
        const parsedItem = JSON.parse(item);
        return parsedItem;
    } catch (e) {
        return null;
    }
}
