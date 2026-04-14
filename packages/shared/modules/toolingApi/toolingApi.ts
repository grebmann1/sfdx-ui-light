import {
    normalizeApiVersion,
    normalizeInstanceUrl,
    normalizeProxyUrl,
    toSalesforcePath,
} from '../salesforceUrl/salesforceUrl';

type JsforceConnection = {
    instanceUrl: string;
    version: string;
    request: (opts: {
        method: string;
        url: string;
        body?: string;
        headers?: Record<string, string>;
    }) => Promise<unknown>;
    tooling: {
        query: (soql: string) => {
            run: (opts: {
                responseTarget: string;
                autoFetch: boolean;
                maxFetch: number;
            }) => Promise<unknown[] | null>;
        };
    };
};

type RequestOptions = {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
    signal?: AbortSignal;
};

export type CreateToolingClientOptions = {
    instanceUrl?: string;
    accessToken?: string;
    apiVersion?: string;
    proxyUrl?: string;
    connection?: JsforceConnection;
    connector?: { conn?: JsforceConnection };
};

function formatSfError(status: number, payload: unknown): string {
    const details = Array.isArray(payload) ? payload[0] : payload;
    const d = details as Record<string, string> | null;
    const message = d?.message || d?.error || d?.error_description;
    const code = d?.errorCode || d?.error_code;
    const suffix = [code, message].filter(Boolean).join(': ');
    return `Salesforce API error (${status})${suffix ? ` - ${suffix}` : ''}`;
}

function isLikelyCorsOrNetworkError(err: unknown): boolean {
    const e = err as { name?: string; message?: string };
    const msg = (e?.message || '').toLowerCase();
    return (
        e?.name === 'TypeError' &&
        (msg.includes('failed to fetch') ||
            msg.includes('load failed') ||
            msg.includes('networkerror'))
    );
}

export function createToolingClient(options: CreateToolingClientOptions = {}) {
    const { instanceUrl, accessToken, apiVersion, proxyUrl } = options;
    const jsforceConnection: JsforceConnection | null =
        options.connection || options.connector?.conn || null;

    if (jsforceConnection) {
        const normalizedInstanceUrl = normalizeInstanceUrl(
            instanceUrl || jsforceConnection.instanceUrl
        );
        const normalizedApiVersion = normalizeApiVersion(apiVersion || jsforceConnection.version);

        const requestJson = async (
            urlOrPath: string,
            { method = 'GET', body, headers }: RequestOptions = {}
        ) => {
            const path = toSalesforcePath(urlOrPath, normalizedInstanceUrl);
            const upstreamPath = path.startsWith('/services/data/')
                ? path
                : `/services/data/v${normalizedApiVersion}${path}`;
            return await jsforceConnection.request({
                method,
                url: upstreamPath,
                body: body ? JSON.stringify(body) : undefined,
                headers: {
                    ...(body ? { 'Content-Type': 'application/json' } : null),
                    ...(headers || null),
                },
            });
        };

        const requestText = async (
            urlOrPath: string,
            { method = 'GET', body, headers }: RequestOptions = {}
        ) => {
            const path = toSalesforcePath(urlOrPath, normalizedInstanceUrl);
            const upstreamPath = path.startsWith('/services/data/')
                ? path
                : `/services/data/v${normalizedApiVersion}${path}`;
            const response = await jsforceConnection.request({
                method,
                url: upstreamPath,
                body: body ? JSON.stringify(body) : undefined,
                headers: {
                    ...(body ? { 'Content-Type': 'application/json' } : null),
                    ...(headers || null),
                },
            });
            return typeof response === 'string' ? response : JSON.stringify(response ?? '');
        };

        const toolingQueryAll = async (soql: string) => {
            const queryExec = jsforceConnection.tooling.query(soql);
            return (
                (await queryExec.run({
                    responseTarget: 'Records',
                    autoFetch: true,
                    maxFetch: 100000,
                })) || []
            );
        };

        return {
            instanceUrl: normalizedInstanceUrl,
            apiVersion: normalizedApiVersion,
            proxyUrl: null as string | null,
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
            async getApexClassBody(id: string) {
                const rows = await toolingQueryAll(
                    `SELECT Id, Name, Body FROM ApexClass WHERE Id='${id}'`
                );
                return rows?.[0] || null;
            },
            async getApexTriggerBody(id: string) {
                const rows = await toolingQueryAll(
                    `SELECT Id, Name, Body FROM ApexTrigger WHERE Id='${id}'`
                );
                return rows?.[0] || null;
            },
            async listLwcBundles() {
                return await toolingQueryAll(
                    'SELECT Id, DeveloperName, NamespacePrefix FROM LightningComponentBundle ORDER BY DeveloperName'
                );
            },
            async listLwcResources(bundleId: string) {
                return await toolingQueryAll(
                    `SELECT Id, FilePath, Format FROM LightningComponentResource WHERE LightningComponentBundleId='${bundleId}' ORDER BY FilePath`
                );
            },
            async getLwcResourceSource(id: string) {
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
            async listAuraDefinitions(bundleId: string) {
                return await toolingQueryAll(
                    `SELECT Id, DefType, Format FROM AuraDefinition WHERE AuraDefinitionBundleId='${bundleId}' ORDER BY DefType`
                );
            },
            async getAuraDefinitionSource(id: string) {
                const rows = await toolingQueryAll(
                    `SELECT Id, DefType, Format, Source FROM AuraDefinition WHERE Id='${id}'`
                );
                return rows?.[0] || null;
            },
        };
    }

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

    async function requestJson(
        urlOrPath: string,
        { method = 'GET', body, headers, signal }: RequestOptions = {}
    ) {
        const path = toSalesforcePath(urlOrPath, normalizedInstanceUrl);
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
            const json = text
                ? (() => {
                      try {
                          return JSON.parse(text);
                      } catch {
                          return null;
                      }
                  })()
                : null;

            if (!res.ok) {
                const err = new Error(formatSfError(res.status, json ?? text)) as Error & {
                    status?: number;
                    payload?: unknown;
                };
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

    async function requestText(
        urlOrPath: string,
        { method = 'GET', body, headers, signal }: RequestOptions = {}
    ) {
        const path = toSalesforcePath(urlOrPath, normalizedInstanceUrl);
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
                const err = new Error(formatSfError(res.status, text)) as Error & {
                    status?: number;
                    payload?: unknown;
                };
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

    async function toolingQueryAll(soql: string) {
        const first = (await requestJson(`/tooling/query?q=${encodeURIComponent(soql)}`)) as Record<
            string,
            unknown
        > | null;
        const out = [...((first?.records as unknown[]) || [])];
        let nextUrl = first?.nextRecordsUrl as string | undefined;
        while (nextUrl) {
            // eslint-disable-next-line no-await-in-loop
            const page = (await requestJson(nextUrl)) as Record<string, unknown> | null;
            out.push(...((page?.records as unknown[]) || []));
            nextUrl = page?.nextRecordsUrl as string | undefined;
        }
        return out;
    }

    return {
        instanceUrl: normalizedInstanceUrl,
        apiVersion: normalizedApiVersion,
        proxyUrl: normalizedProxyUrl || (null as string | null),

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

        async getApexClassBody(id: string) {
            const rows = await toolingQueryAll(
                `SELECT Id, Name, Body FROM ApexClass WHERE Id='${id}'`
            );
            return rows?.[0] || null;
        },

        async getApexTriggerBody(id: string) {
            const rows = await toolingQueryAll(
                `SELECT Id, Name, Body FROM ApexTrigger WHERE Id='${id}'`
            );
            return rows?.[0] || null;
        },

        async listLwcBundles() {
            return await toolingQueryAll(
                'SELECT Id, DeveloperName, NamespacePrefix FROM LightningComponentBundle ORDER BY DeveloperName'
            );
        },

        async listLwcResources(bundleId: string) {
            return await toolingQueryAll(
                `SELECT Id, FilePath, Format FROM LightningComponentResource WHERE LightningComponentBundleId='${bundleId}' ORDER BY FilePath`
            );
        },

        async getLwcResourceSource(id: string) {
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

        async listAuraDefinitions(bundleId: string) {
            return await toolingQueryAll(
                `SELECT Id, DefType, Format FROM AuraDefinition WHERE AuraDefinitionBundleId='${bundleId}' ORDER BY DefType`
            );
        },

        async getAuraDefinitionSource(id: string) {
            const rows = await toolingQueryAll(
                `SELECT Id, DefType, Format, Source FROM AuraDefinition WHERE Id='${id}'`
            );
            return rows?.[0] || null;
        },
    };
}
