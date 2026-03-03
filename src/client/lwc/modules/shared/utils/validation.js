/**
 * Validation utilities
 */

export function isUndefinedOrNull(value) {
    return value === null || value === undefined;
}

export function isNotUndefinedOrNull(value) {
    return !isUndefinedOrNull(value);
}

export function isEmpty(str) {
    return !str || str.length === 0;
}
