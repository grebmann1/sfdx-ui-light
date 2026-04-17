import { getActiveSalesforceWorkbenchHost } from '../../../platform/workbenchHost';
import { truncateText } from '../agentFormatting';

const MAX_SOQL_RECORDS = 200;
const MAX_API_RESPONSE_CHARS = 30000;

function getHost() {
    const host = getActiveSalesforceWorkbenchHost();
    if (!host?.connectionRuntime) {
        throw new Error('Salesforce connection is not ready. Make sure the workbench is connected to an org.');
    }
    return host;
}

function formatConnectionInfoText(conn) {
    const parts = [
        conn.instanceUrl ? `Instance URL: ${conn.instanceUrl}` : null,
        conn.username ? `Username: ${conn.username}` : null,
        conn.orgId ? `Org ID: ${conn.orgId}` : null,
        conn.userId ? `User ID: ${conn.userId}` : null,
        conn.apiVersion ? `API Version: ${conn.apiVersion}` : null,
        conn.organizationName ? `Org Name: ${conn.organizationName}` : null,
        conn.organizationType ? `Org Type: ${conn.organizationType}` : null,
        conn.isSandbox != null ? `Is Sandbox: ${conn.isSandbox}` : null,
    ].filter(Boolean);
    return parts.length ? parts.join('\n') : 'Not connected.';
}

function formatApexResultText(result, code) {
    const compiled = Boolean(result?.compiled);
    const success = Boolean(result?.success);
    const status = compiled && success ? 'succeeded' : 'failed';
    const sections = [`Status: ${status}`, `Compiled: ${compiled}`, `Success: ${success}`];
    if (result?.compileProblem) {
        sections.push(`Compile error: ${result.compileProblem} (line ${result.line ?? '?'}, col ${result.column ?? '?'})`);
    }
    if (result?.exceptionMessage) {
        sections.push(`Exception: ${result.exceptionMessage}`);
    }
    if (result?.exceptionStackTrace) {
        sections.push(`Stack trace:\n${result.exceptionStackTrace}`);
    }
    if (result?.logs) {
        sections.push(`Logs:\n${result.logs}`);
    }
    return sections.join('\n\n');
}

function formatSoqlResultText(query, records, totalSize, truncated) {
    const header = truncated
        ? `SOQL returned the first ${records.length} of ${totalSize} records (truncated).`
        : `SOQL returned ${records.length} record(s).`;
    const body = records.length > 0 ? JSON.stringify(records, null, 2) : '(no records)';
    return `Query: ${query}\n\n${header}\n\n${body}`;
}

function formatApiResultText(endpoint, method, result) {
    const header = `${method} ${endpoint}`;
    const body = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
    return `${header}\n\n${truncateText(body, MAX_API_RESPONSE_CHARS)}`;
}

export const WORKBENCH_SALESFORCE_TOOL_DEFINITIONS = [
    {
        name: 'getConnectionInfo',
        toolReferenceName: 'getConnectionInfo',
        displayName: 'Get Salesforce Connection Info',
        userDescription: 'Return the current Salesforce org connection details.',
        modelDescription:
            'Use this tool to get the connected org instance URL, username, org ID, API version, and sandbox status. Call it first when you need to know what org the workbench is connected to.',
        canBeReferencedInPrompt: true,
        inputSchema: {
            type: 'object',
            properties: {},
            additionalProperties: false,
        },
    },
    {
        name: 'executeApex',
        toolReferenceName: 'executeApex',
        displayName: 'Execute Anonymous Apex',
        userDescription: 'Execute anonymous Apex code on the connected Salesforce org.',
        modelDescription:
            'Use this tool to run anonymous Apex code against the connected org. Returns compile/run status, errors, and logs.',
        canBeReferencedInPrompt: true,
        inputSchema: {
            type: 'object',
            properties: {
                code: { type: 'string' },
            },
            required: ['code'],
            additionalProperties: false,
        },
    },
    {
        name: 'soqlQuery',
        toolReferenceName: 'soqlQuery',
        displayName: 'SOQL Query',
        userDescription: 'Execute a SOQL query against the connected Salesforce org.',
        modelDescription:
            'Use this tool to run a SOQL query. Supports standard and Tooling API queries. Returns paginated records up to 200.',
        canBeReferencedInPrompt: true,
        inputSchema: {
            type: 'object',
            properties: {
                query: { type: 'string' },
                useToolingApi: { type: 'boolean' },
                includeDeletedRecords: { type: 'boolean' },
            },
            required: ['query'],
            additionalProperties: false,
        },
    },
    {
        name: 'callSalesforceApi',
        toolReferenceName: 'callSalesforceApi',
        displayName: 'Call Salesforce REST API',
        userDescription: 'Make a REST API call to the connected Salesforce org.',
        modelDescription:
            'Use this tool to call any Salesforce REST API endpoint. Provide a relative path (e.g. /sobjects/Account/describe). Supports GET, POST, PATCH, DELETE with optional JSON body and headers.',
        canBeReferencedInPrompt: true,
        inputSchema: {
            type: 'object',
            properties: {
                endpoint: { type: 'string' },
                method: { type: 'string' },
                body: { type: 'string' },
                headers: {
                    type: 'object',
                    additionalProperties: { type: 'string' },
                },
            },
            required: ['endpoint'],
            additionalProperties: false,
        },
    },
];

export function createWorkbenchSalesforceTools() {
    return [
        {
            name: 'getConnectionInfo',
            description:
                'Return the current Salesforce org connection details: instance URL, username, org ID, API version, and sandbox status.',
            parameters: {
                type: 'object',
                properties: {},
                additionalProperties: false,
            },
            execute: async () => {
                try {
                    const { connectionRuntime } = getHost();
                    const conn = connectionRuntime.loadStoredConn();
                    if (!conn?.instanceUrl) {
                        return {
                            isError: true,
                            connected: false,
                            text: 'Not connected to a Salesforce org.',
                        };
                    }
                    return {
                        isError: false,
                        connected: true,
                        instanceUrl: conn.instanceUrl || '',
                        username: conn.username || '',
                        orgId: conn.orgId || '',
                        userId: conn.userId || '',
                        apiVersion: conn.apiVersion || '',
                        organizationName: conn.organizationName || '',
                        organizationType: conn.organizationType || '',
                        isSandbox: conn.isSandbox ?? null,
                        text: formatConnectionInfoText(conn),
                    };
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    return { isError: true, error: message, text: `Unable to get connection info: ${message}` };
                }
            },
        },
        {
            name: 'executeApex',
            description:
                'Execute anonymous Apex code on the connected Salesforce org. Returns compile status, success flag, errors, and any debug logs.',
            parameters: {
                type: 'object',
                properties: {
                    code: {
                        type: 'string',
                        description: 'The anonymous Apex code to execute.',
                    },
                },
                required: ['code'],
                additionalProperties: false,
            },
            execute: async input => {
                try {
                    const code = String(input?.code ?? '').trim();
                    if (!code) {
                        throw new Error('Apex code is required.');
                    }
                    const { connectionRuntime } = getHost();
                    const conn = connectionRuntime.loadStoredConn();
                    const result = await connectionRuntime.withToolingClientAuthed(
                        conn,
                        async client =>
                            client.requestJson(
                                `/tooling/executeAnonymous/?anonymousBody=${encodeURIComponent(code)}`
                            )
                    );
                    const compiled = Boolean(result?.compiled);
                    const success = Boolean(result?.success);
                    return {
                        isError: !compiled || !success,
                        compiled,
                        success,
                        compileProblem: result?.compileProblem || null,
                        exceptionMessage: result?.exceptionMessage || null,
                        exceptionStackTrace: result?.exceptionStackTrace || null,
                        line: result?.line ?? null,
                        column: result?.column ?? null,
                        logs: result?.logs || null,
                        text: formatApexResultText(result, code),
                    };
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    return { isError: true, error: message, text: `Unable to execute Apex: ${message}` };
                }
            },
            shouldConfirm: () => true,
            buildConfirmation: vscodeApi => ({
                title: vscodeApi.l10n.t('Execute anonymous Apex'),
                message: new vscodeApi.MarkdownString(
                    'AI wants to run anonymous Apex code on the connected Salesforce org using `executeApex`.'
                ),
            }),
        },
        {
            name: 'soqlQuery',
            description:
                'Execute a SOQL query against the connected Salesforce org. Supports standard and Tooling API. Returns up to 200 records.',
            parameters: {
                type: 'object',
                properties: {
                    query: {
                        type: 'string',
                        description: 'The SOQL query to execute.',
                    },
                    useToolingApi: {
                        type: 'boolean',
                        description: 'Query the Tooling API instead of the standard API.',
                    },
                    includeDeletedRecords: {
                        type: 'boolean',
                        description: 'Include deleted and archived records (queryAll).',
                    },
                },
                required: ['query'],
                additionalProperties: false,
            },
            execute: async input => {
                try {
                    const query = String(input?.query ?? '').trim();
                    if (!query) {
                        throw new Error('A SOQL query is required.');
                    }
                    const useToolingApi = input?.useToolingApi === true;
                    const includeDeletedRecords = input?.includeDeletedRecords === true;
                    const { connectionRuntime } = getHost();
                    const conn = connectionRuntime.loadStoredConn();

                    const { records, totalSize, truncated } =
                        await connectionRuntime.withToolingClientAuthed(conn, async client => {
                            const basePath = useToolingApi
                                ? '/tooling/query'
                                : includeDeletedRecords
                                  ? '/queryAll'
                                  : '/query';
                            const first = await client.requestJson(
                                `${basePath}?q=${encodeURIComponent(query)}`
                            );
                            const pages = [first];
                            let nextUrl = first?.nextRecordsUrl;
                            let collected = (first?.records || []).length;
                            while (nextUrl && collected < MAX_SOQL_RECORDS) {
                                // eslint-disable-next-line no-await-in-loop
                                const page = await client.requestJson(nextUrl);
                                pages.push(page);
                                collected += (page?.records || []).length;
                                nextUrl = page?.nextRecordsUrl;
                            }
                            const allRecords = pages.flatMap(p => p?.records || []);
                            const size = Number(first?.totalSize ?? allRecords.length);
                            const isTruncated = allRecords.length < size || Boolean(nextUrl);
                            return {
                                records: allRecords.slice(0, MAX_SOQL_RECORDS),
                                totalSize: size,
                                truncated: isTruncated,
                            };
                        });

                    return {
                        isError: false,
                        query,
                        records,
                        totalSize,
                        returnedCount: records.length,
                        truncated,
                        useToolingApi,
                        includeDeletedRecords,
                        text: formatSoqlResultText(query, records, totalSize, truncated),
                    };
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    return { isError: true, error: message, text: `Unable to run SOQL query: ${message}` };
                }
            },
        },
        {
            name: 'callSalesforceApi',
            description:
                'Make a REST API call to the connected Salesforce org. Provide a relative path such as /sobjects/Account/describe.',
            parameters: {
                type: 'object',
                properties: {
                    endpoint: {
                        type: 'string',
                        description: 'Relative REST API endpoint path, e.g. /sobjects/Account/describe or /tooling/query?q=...',
                    },
                    method: {
                        type: 'string',
                        description: 'HTTP method: GET, POST, PATCH, DELETE. Defaults to GET.',
                    },
                    body: {
                        type: 'string',
                        description: 'JSON request body for POST/PATCH requests.',
                    },
                    headers: {
                        type: 'object',
                        description: 'Additional request headers as key-value pairs.',
                        additionalProperties: { type: 'string' },
                    },
                },
                required: ['endpoint'],
                additionalProperties: false,
            },
            execute: async input => {
                try {
                    const endpoint = String(input?.endpoint ?? '').trim();
                    if (!endpoint) {
                        throw new Error('An API endpoint is required.');
                    }
                    const method = String(input?.method ?? 'GET').toUpperCase();
                    const headers =
                        input?.headers && typeof input.headers === 'object' ? input.headers : {};

                    let parsedBody: unknown;
                    if (input?.body) {
                        try {
                            parsedBody = JSON.parse(String(input.body));
                        } catch {
                            throw new Error('Request body must be valid JSON.');
                        }
                    }

                    const { connectionRuntime } = getHost();
                    const conn = connectionRuntime.loadStoredConn();
                    const result = await connectionRuntime.withToolingClientAuthed(
                        conn,
                        async client => {
                            const text = await client.requestText(endpoint, {
                                method,
                                body: parsedBody,
                                headers,
                            });
                            try {
                                return JSON.parse(text);
                            } catch {
                                return text;
                            }
                        }
                    );

                    return {
                        isError: false,
                        endpoint,
                        method,
                        result,
                        text: formatApiResultText(endpoint, method, result),
                    };
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    return { isError: true, error: message, text: `Unable to call Salesforce API: ${message}` };
                }
            },
            shouldConfirm: (options) => {
                const method = String(options?.input?.method ?? 'GET').toUpperCase();
                return method !== 'GET';
            },
            buildConfirmation: (vscodeApi, options) => {
                const method = String(options?.input?.method ?? 'GET').toUpperCase();
                const endpoint = String(options?.input?.endpoint ?? '');
                return {
                    title: vscodeApi.l10n.t('Call Salesforce API'),
                    message: new vscodeApi.MarkdownString(
                        `AI wants to call \`${method} ${endpoint}\` on the connected Salesforce org.`
                    ),
                };
            },
        },
    ];
}
