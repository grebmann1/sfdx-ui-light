/**
 * Validation utilities
 */

export function isUndefinedOrNull(value: unknown): boolean {
    return value === null || value === undefined;
}

export function isNotUndefinedOrNull(value: unknown): boolean {
    return !isUndefinedOrNull(value);
}

export function isEmpty(str?: string | null): boolean {
    return !str || str.length === 0;
}
