import type { Connection } from '@salesforce/core';

/**
 * Narrowing helper for call sites that expect core Connection shape (browser: structural only).
 */
export function asSalesforceConnection(
    conn: Record<string, unknown> | null | undefined
): Connection | null {
    if (!conn?.instanceUrl || !conn?.accessToken) {
        return null;
    }
    return conn as unknown as Connection;
}
