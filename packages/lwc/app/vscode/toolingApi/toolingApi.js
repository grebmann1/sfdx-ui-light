function normalizeInstanceUrl(instanceUrl) {
    const raw = (instanceUrl ?? '').trim();
    if (!raw) return '';
    const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    return withScheme.replace(/\/+$/, '');
}

function normalizeProxyUrl(proxyUrl) {
    const raw = (proxyUrl ?? '').trim();
    if (!raw) return '';
    const withScheme = /^https?:\/\//i.test(raw) ? raw : `http://${raw}`;
    return withScheme.replace(/\/+$/, '');
}

function normalizeApiVersion(apiVersion) {
    const v = (apiVersion ?? '').trim();
    return v || '63.0';
}

function formatSfError(status, payload) {
    const details = Array.isArray(payload) ? payload[0] : payload;
    const message = details?.message || details?.error || details?.error_description;
    const code = details?.errorCode || details?.error_code;
    const suffix = [code, message].filter(Boolean).join(': ');
    return `Salesforce API error (${status})${suffix ? ` - ${suffix}` : ''}`;
}

function isLikelyCorsOrNetworkError(err) {
    const msg = (err?.message || '').toLowerCase();
    return err?.name === 'TypeError' && (
        msg.includes('failed to fetch') ||
        msg.includes('load failed') ||
        msg.includes('networkerror')
    );
}

function toPath(urlOrPath, instanceUrl) {
    const raw = String(urlOrPath ?? '');
    if (/^https?:\/\//i.test(raw)) {
        try {
            const u = new URL(raw);
            const i = new URL(instanceUrl);
            if (u.origin === i.origin) {
                return `${u.pathname}${u.search}${u.hash}`;
            }
        } catch {
            // ignore
        }
        throw new Error('Absolute URLs are not supported.');
    }
    if (raw.startsWith('/')) return raw;
    return `${raw.startsWith('?') ? '' : '/'}${raw}`;
}

export function createToolingClient({ instanceUrl, accessToken, apiVersion, proxyUrl } = {}) {
    const normalizedInstanceUrl = normalizeInstanceUrl(instanceUrl);
    const normalizedApiVersion = normalizeApiVersion(apiVersion);
    const normalizedProxyUrl = normalizeProxyUrl(proxyUrl);
    const token = (accessToken ?? '').trim();

    if (!normalizedInstanceUrl) {
        throw new Error('Missing Instance URL.');
    }
    if (!token) {
        throw new Error('Missing Access Token.');
    }

    const proxyBase = normalizedProxyUrl ? `${normalizedProxyUrl}/proxy` : '';
    const base = normalizedProxyUrl
        ? `${proxyBase}/services/data/v${normalizedApiVersion}`
        : `${normalizedInstanceUrl}/services/data/v${normalizedApiVersion}`;

    async function requestJson(urlOrPath, { method = 'GET', body, headers, signal } = {}) {
        const path = toPath(urlOrPath, normalizedInstanceUrl);
        const upstreamPath = path.startsWith('/services/data/')
            ? path
            : `/services/data/v${normalizedApiVersion}${path}`;
        const upstreamUrl = `${normalizedInstanceUrl}${upstreamPath}`;
        const url = normalizedProxyUrl ? `${proxyBase}${upstreamPath}` : upstreamUrl;

        try {
            const res = await fetch(url, {
                method,
                headers: {
                    ...(normalizedProxyUrl ? { 'Salesforceproxy-Endpoint': upstreamUrl } : null),
                    Authorization: `Bearer ${token}`,
                    ...(body ? { 'Content-Type': 'application/json' } : null),
                    ...(headers || null),
                },
                body: body ? JSON.stringify(body) : undefined,
                signal,
            });

            const text = await res.text();
            const json = text ? (() => {
                try {
                    return JSON.parse(text);
                } catch {
                    return null;
                }
            })() : null;

            if (!res.ok) {
                const err = new Error(formatSfError(res.status, json ?? text));
                // Attach status to enable auth refresh + retry.
                err.status = res.status;
                err.payload = json ?? text;
                throw err;
            }

            return json;
        } catch (err) {
            if (isLikelyCorsOrNetworkError(err)) {
                if (normalizedProxyUrl) {
                    throw new Error(
                        `Unable to reach local proxy at ${normalizedProxyUrl}. ` +
                        'Start it (npm run sf:proxy) and retry.'
                    );
                }
                throw new Error(
                    'Network/CORS error calling Salesforce. ' +
                    'Add this app origin to Setup → CORS in your org, then retry, ' +
                    'or enable the local proxy.'
                );
            }
            throw err;
        }
    }

    async function requestText(urlOrPath, { method = 'GET', body, headers, signal } = {}) {
        const path = toPath(urlOrPath, normalizedInstanceUrl);
        const upstreamPath = path.startsWith('/services/data/')
            ? path
            : `/services/data/v${normalizedApiVersion}${path}`;
        const upstreamUrl = `${normalizedInstanceUrl}${upstreamPath}`;
        const url = normalizedProxyUrl ? `${proxyBase}${upstreamPath}` : upstreamUrl;

        try {
            const res = await fetch(url, {
                method,
                headers: {
                    ...(normalizedProxyUrl ? { 'Salesforceproxy-Endpoint': upstreamUrl } : null),
                    Authorization: `Bearer ${token}`,
                    ...(body ? { 'Content-Type': 'application/json' } : null),
                    ...(headers || null),
                },
                body: body ? JSON.stringify(body) : undefined,
                signal,
            });

            const text = await res.text();
            if (!res.ok) {
                const err = new Error(formatSfError(res.status, text));
                err.status = res.status;
                err.payload = text;
                throw err;
            }
            return text;
        } catch (err) {
            if (isLikelyCorsOrNetworkError(err)) {
                if (normalizedProxyUrl) {
                    throw new Error(
                        `Unable to reach local proxy at ${normalizedProxyUrl}. ` +
                        'Start it (npm run sf:proxy) and retry.'
                    );
                }
                throw new Error(
                    'Network/CORS error calling Salesforce. ' +
                    'Add this app origin to Setup → CORS in your org, then retry, ' +
                    'or enable the local proxy.'
                );
            }
            throw err;
        }
    }

    async function toolingQueryAll(soql) {
        const first = await requestJson(`/tooling/query?q=${encodeURIComponent(soql)}`);
        const out = [...(first?.records || [])];
        let nextUrl = first?.nextRecordsUrl;
        while (nextUrl) {
            const page = await requestJson(nextUrl);
            out.push(...(page?.records || []));
            nextUrl = page?.nextRecordsUrl;
        }
        return out;
    }

    return {
        instanceUrl: normalizedInstanceUrl,
        apiVersion: normalizedApiVersion,
        proxyUrl: normalizedProxyUrl || null,

        requestJson,
        requestText,
        toolingQueryAll,

        async ping() {
            await toolingQueryAll('SELECT Id FROM ApexClass LIMIT 1');
            return true;
        },

        async listApexClasses() {
            return await toolingQueryAll('SELECT Id, Name FROM ApexClass ORDER BY Name');
        },

        async listApexTriggers() {
            return await toolingQueryAll('SELECT Id, Name FROM ApexTrigger ORDER BY Name');
        },

        async getApexClassBody(id) {
            const rows = await toolingQueryAll(`SELECT Id, Name, Body FROM ApexClass WHERE Id='${id}'`);
            return rows?.[0] || null;
        },

        async getApexTriggerBody(id) {
            const rows = await toolingQueryAll(`SELECT Id, Name, Body FROM ApexTrigger WHERE Id='${id}'`);
            return rows?.[0] || null;
        },

        async listLwcBundles() {
            return await toolingQueryAll(
                'SELECT Id, DeveloperName, NamespacePrefix FROM LightningComponentBundle ORDER BY DeveloperName'
            );
        },

        async listLwcResources(bundleId) {
            return await toolingQueryAll(
                `SELECT Id, FilePath, Format FROM LightningComponentResource WHERE LightningComponentBundleId='${bundleId}' ORDER BY FilePath`
            );
        },

        async getLwcResourceSource(id) {
            const rows = await toolingQueryAll(
                `SELECT Id, FilePath, Format, Source FROM LightningComponentResource WHERE Id='${id}'`
            );
            return rows?.[0] || null;
        },

        async listAuraBundles() {
            return await toolingQueryAll(
                'SELECT Id, DeveloperName, NamespacePrefix FROM AuraDefinitionBundle ORDER BY DeveloperName'
            );
        },

        async listAuraDefinitions(bundleId) {
            return await toolingQueryAll(
                `SELECT Id, DefType, Format FROM AuraDefinition WHERE AuraDefinitionBundleId='${bundleId}' ORDER BY DefType`
            );
        },

        async getAuraDefinitionSource(id) {
            const rows = await toolingQueryAll(
                `SELECT Id, DefType, Format, Source FROM AuraDefinition WHERE Id='${id}'`
            );
            return rows?.[0] || null;
        },
    };
}

