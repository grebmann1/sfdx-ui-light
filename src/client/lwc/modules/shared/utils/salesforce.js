import { isEmpty } from './validation';

/**
 * Salesforce-specific utilities (URL parsing, record ID extraction, etc.)
 */

/**
 * Build full API name with optional namespace prefix (e.g. managed package).
 * @param {string} name - Field or object API name (or path like "Account.Owner.Name").
 * @param {string} [namespace] - Optional namespace (e.g. package prefix).
 * @returns {string}
 */
export function fullApiName(name, namespace) {
    if (name == null) return '';
    const n = String(name);
    if (namespace != null && String(namespace).trim() !== '') {
        return `${String(namespace).trim()}__${n}`;
    }
    return n;
}

export function getSobject(href) {
    let url = new URL(href);
    if (url.pathname) {
        let match = url.pathname.match(/\/lightning\/[r|o]\/([a-zA-Z0-9_]+)\/[a-zA-Z0-9]+/);
        if (match) {
            return match[1];
        }
    }
    return null;
}

const extractRecordId = href => {
    if (!href) return null;
    try {
        const url = new URL(href);
        // Find record ID from URL
        const searchParams = new URLSearchParams(url.search.substring(1));

        const isLightningPath = url.pathname.startsWith('/lightning/') || url.pathname === '/one/one.app';

        // Lightning Experience and Salesforce1 (supports enhanced domains like *.my.salesforce.com)
        if (isLightningPath) {
            let match;

            if (url.pathname === '/one/one.app') {
                // Pre URL change: https://docs.releasenotes.salesforce.com/en-us/spring18/release-notes/rn_general_enhanced_urls_cruc.htm
                match = url.hash.match(/\/sObject\/([a-zA-Z0-9]{15}|[a-zA-Z0-9]{18})(?:\/|$)/);
            } else {
                match = url.pathname.match(
                    /\/lightning\/[ro]\/[a-zA-Z0-9_]+\/([a-zA-Z0-9]{15}|[a-zA-Z0-9]{18})(?:\/|$)/
                );
            }
            if (match) {
                return match[1];
            }
        }

        // Salesforce Classic and Console
        if (!isLightningPath && (url.hostname.endsWith('.salesforce.com') || url.hostname.endsWith('.salesforce.mil'))) {
            const match = url.pathname.match(/\/([a-zA-Z0-9]{15}|[a-zA-Z0-9]{18})(?:\/|$)/);
            if (match) {
                return match[1];
            }
        }

        // Visualforce
        {
            const idParam = searchParams.get('id');
            if (idParam) {
                return idParam;
            }
        }
        // Visualforce page that does not follow standard Visualforce naming
        for (let [, p] of searchParams) {
            if (
                p.match(/^([a-zA-Z0-9]{15}|[a-zA-Z0-9]{18})$/) &&
                p.includes('0000')
            ) {
                return p;
            }
        }
    } catch (e) {
        console.error('Error while extracting the recordId');
    }
    return null;
};

export function getRecordId(href) {
    const recordId = extractRecordId(href);
    return recordId && recordId.match(/^([a-zA-Z0-9]{15}|[a-zA-Z0-9]{18})$/)
        ? recordId
        : null;
}

export function getCurrentObjectType(conn, recordId) {
    return new Promise((resolve, reject) => {
        conn.tooling
            .executeAnonymous(
                "ID a='" + recordId + "';Integer.valueOf(String.valueOf(a.getSObjectType()));"
            )
            .then(res => {
                let _sobjectString = res.exceptionMessage.replace(/^.* (.*)$/, '$1');
                resolve(_sobjectString == 'null' ? null : _sobjectString);
            })
            .catch(e => {
                console.error(e);
                reject(e);
            });
    });
}
