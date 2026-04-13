import { createMetadataApiClient } from '../../../metadataApi/metadataApi';
import { createToolingClient } from '../../../toolingApi/toolingApi';
import { membersOrAll } from '../../extensions/metadata/runtime/metadataRetrieveRuntimeHelpers';
import { sanitizeSoqlText } from '../../extensions/soql/soqlQueryRunner';
import {
    isAuthError,
    refreshConnectionRecord,
    resolveConnectionRecord,
} from '../connection/connectorRecord';
import { hasUsableConnection } from '../connection/workbenchRuntime';
import { DEFAULT_SOURCE_API_VERSION, normalizeSfApiVersion } from '../workspace/sfdxProject';

import {
    isIframeJsforceBridgeMethod,
    type IframeJsforceBridgeMethod,
} from './iframeJsforceBridgeContract';

const DEFAULT_METADATA_RETRIEVE_TIMEOUT_MS = 10 * 60 * 1000;
const DEFAULT_APEX_TEST_TIMEOUT_MS = 20 * 60 * 1000;
const DEFAULT_POLL_INTERVAL_MS = 2000;

const SUPPORTED_API_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
const SUPPORTED_TOOLING_RETRIEVE_TYPES = new Set([
    'ApexClass',
    'ApexTrigger',
    'LightningComponentBundle',
    'AuraDefinitionBundle',
]);
const TERMINAL_APEX_TEST_QUEUE_STATUSES = new Set(['Completed', 'Aborted', 'Failed']);

type JsforceBridgeRuntimeOptions = {
    getConnectionRecord: () => Record<string, unknown> | null;
    getConnector: () => { conn?: unknown } | null;
    getWorkspaceBasePath: () => string | null | undefined;
    getApiVersion: () => string | null | undefined;
    onConnectionResolved?: (connection: Record<string, unknown>) => void;
};

type MetadataTypeEntry = {
    inFolder: boolean;
    xmlName: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function toStringArray(value: unknown) {
    if (Array.isArray(value)) {
        return value.map(item => String(item || '').trim()).filter(Boolean);
    }
    if (typeof value === 'string') {
        const normalized = value.trim();
        return normalized ? [normalized] : [];
    }
    return [];
}

function sanitizeHeaderName(value: unknown) {
    return String(value || '').trim();
}

function sanitizeHeaderValue(value: unknown) {
    return String(value ?? '').trim();
}

function sleep(ms: number) {
    return new Promise(resolve => globalThis.setTimeout(resolve, ms));
}

function escapeSoqlLiteral(value: unknown) {
    return String(value || '').replace(/'/g, "\\\\'");
}

function normalizePollInterval(rawValue: unknown, fallback = DEFAULT_POLL_INTERVAL_MS) {
    const interval = Number(rawValue);
    if (!Number.isFinite(interval)) {
        return fallback;
    }
    return Math.min(15000, Math.max(500, Math.floor(interval)));
}

function normalizeTimeoutMs(rawValue: unknown, fallback: number) {
    const timeoutMs = Number(rawValue);
    if (!Number.isFinite(timeoutMs)) {
        return fallback;
    }
    return Math.max(1000, Math.floor(timeoutMs));
}

function normalizeMetadataTypeEntry(rawXmlName: unknown, rawInFolder: unknown) {
    const xmlName = String(rawXmlName ?? '').trim();
    if (!xmlName) {
        return null;
    }
    return {
        inFolder:
            rawInFolder === true ||
            String(rawInFolder ?? '')
                .trim()
                .toLowerCase() === 'true',
        xmlName,
    };
}

function parseDescribeMetadataTypesFromXmlDocument(describeResult: unknown): MetadataTypeEntry[] {
    if (!isRecord(describeResult)) {
        return [];
    }
    const getElementsByTagNameNS = describeResult.getElementsByTagNameNS;
    const getElementsByTagName = describeResult.getElementsByTagName;
    if (
        typeof getElementsByTagNameNS !== 'function' &&
        typeof getElementsByTagName !== 'function'
    ) {
        return [];
    }

    const metadataObjects = Array.from(
        (typeof getElementsByTagNameNS === 'function'
            ? getElementsByTagNameNS.call(describeResult, '*', 'metadataObjects')
            : null) ||
            (typeof getElementsByTagName === 'function'
                ? getElementsByTagName.call(describeResult, 'metadataObjects')
                : null) ||
            []
    );

    const output: MetadataTypeEntry[] = [];
    for (const metadataObject of metadataObjects) {
        if (!isRecord(metadataObject)) {
            continue;
        }
        const objectGetByNs = metadataObject.getElementsByTagNameNS;
        const objectGetByTag = metadataObject.getElementsByTagName;
        const xmlNameElement =
            (typeof objectGetByNs === 'function'
                ? objectGetByNs.call(metadataObject, '*', 'xmlName')?.[0]
                : null) ||
            (typeof objectGetByTag === 'function'
                ? objectGetByTag.call(metadataObject, 'xmlName')?.[0]
                : null);
        const inFolderElement =
            (typeof objectGetByNs === 'function'
                ? objectGetByNs.call(metadataObject, '*', 'inFolder')?.[0]
                : null) ||
            (typeof objectGetByTag === 'function'
                ? objectGetByTag.call(metadataObject, 'inFolder')?.[0]
                : null);
        const normalized = normalizeMetadataTypeEntry(
            isRecord(xmlNameElement) ? xmlNameElement.textContent : undefined,
            isRecord(inFolderElement) ? inFolderElement.textContent : undefined
        );
        if (normalized) {
            output.push(normalized);
        }
    }
    return output;
}

function parseDescribeMetadataTypesFromObject(describeResult: unknown): MetadataTypeEntry[] {
    if (!isRecord(describeResult) || !Array.isArray(describeResult.metadataObjects)) {
        return [];
    }
    const output: MetadataTypeEntry[] = [];
    for (const metadataObject of describeResult.metadataObjects) {
        const normalized = normalizeMetadataTypeEntry(
            isRecord(metadataObject) ? metadataObject.xmlName : undefined,
            isRecord(metadataObject) ? metadataObject.inFolder : undefined
        );
        if (normalized) {
            output.push(normalized);
        }
    }
    return output;
}

function parseDescribeMetadataTypes(describeResult: unknown): MetadataTypeEntry[] {
    const fromObject = parseDescribeMetadataTypesFromObject(describeResult);
    if (fromObject.length > 0) {
        return fromObject.sort((left, right) => left.xmlName.localeCompare(right.xmlName));
    }
    const fromXml = parseDescribeMetadataTypesFromXmlDocument(describeResult);
    return fromXml.sort((left, right) => left.xmlName.localeCompare(right.xmlName));
}

function normalizeListMetadataResult(value: unknown) {
    if (Array.isArray(value)) {
        return value;
    }
    if (isRecord(value)) {
        return [value];
    }
    return [];
}

function isSupportedManageableState(item: unknown) {
    if (!isRecord(item)) {
        return false;
    }
    return (
        !item.manageableState ||
        ['unmanaged', 'installedEditable', 'deprecatedEditable'].includes(
            String(item.manageableState)
        )
    );
}

function sanitizeMetadataRetrieveStatus(status: unknown, includeZip: boolean) {
    const source = isRecord(status) ? status : {};
    return {
        done: Boolean(source.done),
        success: Boolean(source.success),
        status: typeof source.status === 'string' ? source.status : '',
        errorMessage: typeof source.errorMessage === 'string' ? source.errorMessage : '',
        zipFile: includeZip && typeof source.zipFile === 'string' ? source.zipFile : '',
    };
}

function normalizeApiEndpoint(value: unknown) {
    const endpoint = String(value || '').trim();
    if (!endpoint) {
        throw {
            code: 'EINVAL',
            message: 'An API endpoint is required.',
        };
    }
    if (/^https?:\/\//i.test(endpoint)) {
        throw {
            code: 'EACCESS',
            message: 'Absolute API URLs are not allowed in iframe bridge requests.',
        };
    }
    if (endpoint.includes('..')) {
        throw {
            code: 'EACCESS',
            message: 'Relative path traversal is not allowed in API endpoints.',
        };
    }
    return endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
}

function normalizeApiMethod(value: unknown) {
    const method = String(value || 'GET')
        .trim()
        .toUpperCase();
    if (!SUPPORTED_API_METHODS.has(method)) {
        throw {
            code: 'EINVAL',
            message: `Unsupported API method "${method}".`,
        };
    }
    return method;
}

function normalizeApiHeaders(args: Record<string, unknown>) {
    const headers: Record<string, string> = {};
    if (isRecord(args.headers)) {
        for (const [nameRaw, valueRaw] of Object.entries(args.headers)) {
            const name = sanitizeHeaderName(nameRaw);
            if (!name) {
                continue;
            }
            if (name.toLowerCase() === 'authorization') {
                throw {
                    code: 'EACCESS',
                    message: 'Overriding the Authorization header is not allowed.',
                };
            }
            headers[name] = sanitizeHeaderValue(valueRaw);
        }
    }

    for (const rawHeader of Array.isArray(args.headerValues) ? args.headerValues : []) {
        const line = String(rawHeader || '').trim();
        if (!line) {
            continue;
        }
        const separatorIndex = line.indexOf(':');
        if (separatorIndex <= 0) {
            throw {
                code: 'EINVAL',
                message: `Invalid header "${line}". Expected "Name: Value".`,
            };
        }
        const name = sanitizeHeaderName(line.slice(0, separatorIndex));
        if (!name) {
            throw {
                code: 'EINVAL',
                message: `Invalid header "${line}". Expected "Name: Value".`,
            };
        }
        if (name.toLowerCase() === 'authorization') {
            throw {
                code: 'EACCESS',
                message: 'Overriding the Authorization header is not allowed.',
            };
        }
        headers[name] = sanitizeHeaderValue(line.slice(separatorIndex + 1));
    }
    return headers;
}

function normalizeApiBody(args: Record<string, unknown>) {
    if (typeof args.bodyJson === 'string' && args.bodyJson.trim()) {
        try {
            return JSON.parse(args.bodyJson);
        } catch {
            throw {
                code: 'EINVAL',
                message: 'Request body JSON is invalid.',
            };
        }
    }
    if (typeof args.body === 'string') {
        const body = args.body.trim();
        if (!body) {
            return undefined;
        }
        try {
            return JSON.parse(body);
        } catch {
            throw {
                code: 'EINVAL',
                message: 'API request body must be valid JSON when passed as string.',
            };
        }
    }
    if (typeof args.body === 'undefined') {
        return undefined;
    }
    return args.body;
}

function normalizeSoqlMode(args: Record<string, unknown>) {
    const mode = String(args.mode || '')
        .trim()
        .toLowerCase();
    if (mode === 'tooling') {
        return 'tooling';
    }
    if (mode === 'queryall' || mode === 'query-all' || mode === 'all') {
        return 'queryAll';
    }
    if (args.useToolingApi === true) {
        return 'tooling';
    }
    if (args.includeDeletedRecords === true) {
        return 'queryAll';
    }
    return 'standard';
}

function toMetadataTypesMap(value: unknown) {
    const output = new Map<string, Set<string>>();
    const addEntry = (typeRaw: unknown, membersRaw: unknown) => {
        const type = String(typeRaw || '').trim();
        if (!type) {
            return;
        }
        const members = Array.isArray(membersRaw)
            ? membersRaw
            : membersRaw instanceof Set
              ? Array.from(membersRaw)
              : typeof membersRaw === 'string'
                ? [membersRaw]
                : [];
        const normalizedMembers = members
            .map(member => String(member || '').trim())
            .filter(Boolean);
        if (!normalizedMembers.length) {
            return;
        }
        output.set(type, new Set(normalizedMembers));
    };

    if (value instanceof Map) {
        for (const [type, members] of value.entries()) {
            addEntry(type, members);
        }
    } else if (isRecord(value)) {
        for (const [type, members] of Object.entries(value)) {
            addEntry(type, members);
        }
    }
    return output;
}

class IframeJsforceBridgeRuntime {
    private getConnectionRecord: () => Record<string, unknown> | null;
    private getConnector: () => { conn?: unknown } | null;
    private getWorkspaceBasePath: () => string | null | undefined;
    private getApiVersion: () => string | null | undefined;
    private onConnectionResolved?: (connection: Record<string, unknown>) => void;

    constructor(options: JsforceBridgeRuntimeOptions) {
        this.getConnectionRecord = options.getConnectionRecord;
        this.getConnector = options.getConnector;
        this.getWorkspaceBasePath = options.getWorkspaceBasePath;
        this.getApiVersion = options.getApiVersion;
        this.onConnectionResolved = options.onConnectionResolved;
    }

    async execute(method: IframeJsforceBridgeMethod, args: Record<string, unknown> = {}) {
        if (!isIframeJsforceBridgeMethod(method)) {
            throw {
                code: 'EMETHOD',
                message: 'Unsupported JSForce bridge method.',
            };
        }

        switch (method) {
            case 'connection.getStatus':
                return await this.getConnectionStatus();
            case 'soql.execute':
                return await this.executeSoql(args);
            case 'apex.executeAnonymous':
                return await this.executeAnonymous(args);
            case 'api.execute':
                return await this.executeApi(args);
            case 'apexTests.run':
                return await this.runApexTests(args);
            case 'metadata.listTypes':
                return await this.listMetadataTypes();
            case 'metadata.list':
                return await this.listMetadata(args);
            case 'metadata.retrieveViaMetadataApi':
                return await this.retrieveViaMetadataApi(args);
            case 'metadata.retrieveToolingTypes':
                return await this.retrieveToolingTypes(args);
            case 'schema.describeCustomObject':
                return await this.describeCustomObject(args);
            default:
                throw {
                    code: 'EMETHOD',
                    message: 'Unsupported JSForce bridge method.',
                };
        }
    }

    private loadCurrentConnectionRecord() {
        const connection = this.getConnectionRecord?.();
        return isRecord(connection) ? { ...connection } : {};
    }

    private resolveWorkspaceBasePath() {
        const workspaceBasePath = String(this.getWorkspaceBasePath?.() || '').trim();
        return workspaceBasePath || '/workspace';
    }

    private normalizeApiVersion(apiVersion: unknown) {
        return normalizeSfApiVersion(
            String(apiVersion || this.getApiVersion?.() || ''),
            DEFAULT_SOURCE_API_VERSION
        );
    }

    private async resolveEffectiveConnection({ requireUsable }: { requireUsable: boolean }) {
        const current = this.loadCurrentConnectionRecord();
        const resolved = await resolveConnectionRecord(current, {
            workspaceBasePath: this.resolveWorkspaceBasePath(),
        }).catch(() => current);

        const effectiveConnection = {
            ...current,
            ...(isRecord(resolved) ? resolved : {}),
            apiVersion: this.normalizeApiVersion(
                isRecord(resolved) ? resolved.apiVersion : current.apiVersion
            ),
        };

        if (requireUsable && !hasUsableConnection(effectiveConnection)) {
            throw {
                code: 'EAUTH',
                message:
                    (typeof effectiveConnection.errorMessage === 'string' &&
                        effectiveConnection.errorMessage) ||
                    'Salesforce connection is required to execute this bridge operation.',
            };
        }
        if (hasUsableConnection(effectiveConnection)) {
            this.onConnectionResolved?.(effectiveConnection);
        }
        return effectiveConnection;
    }

    private requireInjectedConnection() {
        const connector = this.getConnector?.();
        const connection = connector?.conn;
        if (!isRecord(connection)) {
            throw {
                code: 'EAUTH',
                message:
                    'Salesforce connection is unavailable in the host. Reconnect from the toolkit session.',
            };
        }
        return connection;
    }

    private createToolingClientForConnection(connection: Record<string, unknown>) {
        return createToolingClient({
            connection: this.requireInjectedConnection(),
            apiVersion: this.normalizeApiVersion(connection.apiVersion),
        });
    }

    private createMetadataApiClientForConnection(connection: Record<string, unknown>) {
        return createMetadataApiClient({
            connection: this.requireInjectedConnection(),
            apiVersion: this.normalizeApiVersion(connection.apiVersion),
        });
    }

    private async withToolingClientAuthed<T>(
        operation: (
            client: ReturnType<typeof createToolingClient>,
            connection: Record<string, unknown>
        ) => Promise<T>
    ) {
        const current = await this.resolveEffectiveConnection({ requireUsable: true });
        const toolingClient = this.createToolingClientForConnection(current);
        try {
            return await operation(toolingClient, current);
        } catch (error) {
            if (!isAuthError(error as { status?: number; message?: string })) {
                throw error;
            }
            const refreshed = await refreshConnectionRecord(current, {
                workspaceBasePath: this.resolveWorkspaceBasePath(),
            }).catch(() => null);
            if (!isRecord(refreshed)) {
                throw error;
            }
            const effectiveRefreshed = {
                ...refreshed,
                apiVersion: this.normalizeApiVersion(refreshed.apiVersion),
            };
            if (!hasUsableConnection(effectiveRefreshed)) {
                throw error;
            }
            this.onConnectionResolved?.(effectiveRefreshed);
            const retryClient = this.createToolingClientForConnection(effectiveRefreshed);
            return await operation(retryClient, effectiveRefreshed);
        }
    }

    private async withMetadataApiClientAuthed<T>(
        operation: (
            client: ReturnType<typeof createMetadataApiClient>,
            connection: Record<string, unknown>
        ) => Promise<T>
    ) {
        const current = await this.resolveEffectiveConnection({ requireUsable: true });
        const metadataClient = this.createMetadataApiClientForConnection(current);
        try {
            return await operation(metadataClient, current);
        } catch (error) {
            if (!isAuthError(error as { status?: number; message?: string })) {
                throw error;
            }
            const refreshed = await refreshConnectionRecord(current, {
                workspaceBasePath: this.resolveWorkspaceBasePath(),
            }).catch(() => null);
            if (!isRecord(refreshed)) {
                throw error;
            }
            const effectiveRefreshed = {
                ...refreshed,
                apiVersion: this.normalizeApiVersion(refreshed.apiVersion),
            };
            if (!hasUsableConnection(effectiveRefreshed)) {
                throw error;
            }
            this.onConnectionResolved?.(effectiveRefreshed);
            const retryClient = this.createMetadataApiClientForConnection(effectiveRefreshed);
            return await operation(retryClient, effectiveRefreshed);
        }
    }

    private async toolingRequestJson(path: string, options: Record<string, unknown> = {}) {
        return await this.withToolingClientAuthed(
            async client => await client.requestJson(path, options)
        );
    }

    private async toolingRequestText(path: string, options: Record<string, unknown> = {}) {
        return await this.withToolingClientAuthed(
            async client => await client.requestText(path, options)
        );
    }

    private async toolingQueryAll(soql: string) {
        return await this.withToolingClientAuthed(
            async client => await client.toolingQueryAll(soql)
        );
    }

    private async getConnectionStatus() {
        const connection = await this.resolveEffectiveConnection({ requireUsable: false });
        return {
            connected: hasUsableConnection(connection),
            instanceUrl: String(connection.instanceUrl || ''),
            apiVersion: this.normalizeApiVersion(connection.apiVersion),
            accessTokenAvailable: Boolean(connection.accessToken),
            username: String(connection.username || ''),
            userId: String(connection.userId || ''),
            orgId: String(connection.orgId || ''),
            organizationName: String(connection.organizationName || ''),
            workspaceRoot: String(connection.workspaceRoot || ''),
            sessionHasExpired: Boolean(connection.sessionHasExpired),
            hasError: Boolean(connection.hasError),
            errorMessage:
                typeof connection.errorMessage === 'string' && connection.errorMessage
                    ? connection.errorMessage
                    : null,
        };
    }

    private async executeSoql(args: Record<string, unknown>) {
        const rawQuery =
            typeof args.query === 'string'
                ? args.query
                : typeof args.soql === 'string'
                  ? args.soql
                  : '';
        const query = sanitizeSoqlText(rawQuery);
        if (!query) {
            throw {
                code: 'EINVAL',
                message: 'A SOQL query is required.',
            };
        }
        const mode = normalizeSoqlMode(args);
        const basePath =
            mode === 'tooling' ? '/tooling/query' : mode === 'queryAll' ? '/queryAll' : '/query';

        const firstPage = (await this.toolingRequestJson(
            `${basePath}?q=${encodeURIComponent(query)}`
        )) as Record<string, unknown>;
        const pages = [firstPage];
        let nextRecordsUrl =
            typeof firstPage?.nextRecordsUrl === 'string' ? firstPage.nextRecordsUrl : '';
        while (nextRecordsUrl) {
            // eslint-disable-next-line no-await-in-loop
            const page = (await this.toolingRequestJson(nextRecordsUrl)) as Record<string, unknown>;
            pages.push(page);
            nextRecordsUrl = typeof page?.nextRecordsUrl === 'string' ? page.nextRecordsUrl : '';
        }

        const records = pages.flatMap(page => (Array.isArray(page?.records) ? page.records : []));
        return {
            mode,
            query,
            records,
            totalSize: Number(firstPage?.totalSize ?? records.length),
        };
    }

    private async executeAnonymous(args: Record<string, unknown>) {
        const apexCode = String(args.apexCode || args.code || '').trim();
        if (!apexCode) {
            throw {
                code: 'EINVAL',
                message: 'Apex code is required for executeAnonymous.',
            };
        }
        return await this.toolingRequestJson(
            `/tooling/executeAnonymous/?anonymousBody=${encodeURIComponent(apexCode)}`
        );
    }

    private async executeApi(args: Record<string, unknown>) {
        const endpoint = normalizeApiEndpoint(args.endpoint);
        const method = normalizeApiMethod(args.method);
        const headers = normalizeApiHeaders(args);
        const body = normalizeApiBody(args);

        const responseText = await this.toolingRequestText(endpoint, {
            method,
            headers,
            body,
        });
        try {
            return JSON.parse(responseText);
        } catch {
            return responseText;
        }
    }

    private async resolveApexTestClassIds(args: Record<string, unknown>) {
        const classIds = Array.from(new Set(toStringArray(args.classIds)));
        if (classIds.length > 0) {
            return classIds;
        }
        const classNames = Array.from(new Set(toStringArray(args.classNames)));
        if (!classNames.length) {
            throw {
                code: 'EINVAL',
                message: 'Provide classIds or classNames to run Apex tests.',
            };
        }
        const inList = classNames.map(name => `'${escapeSoqlLiteral(name)}'`).join(',');
        const rows = await this.toolingQueryAll(
            `SELECT Id, Name FROM ApexClass WHERE Name IN (${inList}) ORDER BY Name`
        );
        return Array.from(
            new Set(
                (rows || [])
                    .map(row => (isRecord(row) ? String(row.Id || '').trim() : ''))
                    .filter(Boolean)
            )
        );
    }

    private async runApexTests(args: Record<string, unknown>) {
        const classIds = await this.resolveApexTestClassIds(args);
        if (!classIds.length) {
            throw {
                code: 'ENOTFOUND',
                message: 'No Apex test classes were resolved from the provided inputs.',
            };
        }

        const startResponse = await this.toolingRequestJson('/tooling/runTestsAsynchronous', {
            method: 'POST',
            body: {
                classIds,
            },
        });
        const jobId = String(
            (startResponse as Record<string, unknown>)?.id || startResponse || ''
        ).trim();
        if (!jobId) {
            throw {
                code: 'EAPEXTEST',
                message: 'Failed to start Apex tests.',
            };
        }

        const pollIntervalMs = normalizePollInterval(args.pollIntervalMs);
        const timeoutMs = normalizeTimeoutMs(args.timeoutMs, DEFAULT_APEX_TEST_TIMEOUT_MS);
        const startedAt = Date.now();
        const escapedJobId = escapeSoqlLiteral(jobId);
        let queueItems: unknown[] = [];

        for (;;) {
            // eslint-disable-next-line no-await-in-loop
            queueItems = await this.toolingQueryAll(
                `SELECT Id, Status, ApexClassId, MethodName, ExtendedStatus FROM ApexTestQueueItem WHERE ParentJobId='${escapedJobId}'`
            );
            const total = queueItems?.length || 0;
            const doneCount = (queueItems || []).filter(item =>
                TERMINAL_APEX_TEST_QUEUE_STATUSES.has(
                    String((item as Record<string, unknown>)?.Status || '')
                )
            ).length;

            if (total > 0 && doneCount === total) {
                break;
            }
            if (Date.now() - startedAt > timeoutMs) {
                throw {
                    code: 'ETIMEOUT',
                    message: `Apex test run timed out after ${timeoutMs}ms.`,
                };
            }
            // eslint-disable-next-line no-await-in-loop
            await sleep(pollIntervalMs);
        }

        let results = [];
        try {
            results = await this.toolingQueryAll(
                `SELECT Id, Outcome, Message, StackTrace, ApexClassId, MethodName, AsyncApexJobId FROM ApexTestResult WHERE AsyncApexJobId='${escapedJobId}' ORDER BY ApexClassId, MethodName`
            );
        } catch {
            const queueIds = (queueItems || [])
                .map(item => String((item as Record<string, unknown>)?.Id || '').trim())
                .filter(Boolean);
            if (queueIds.length) {
                const inList = queueIds.map(id => `'${escapeSoqlLiteral(id)}'`).join(',');
                results = await this.toolingQueryAll(
                    `SELECT Id, Outcome, Message, StackTrace, ApexClassId, MethodName, QueueItemId FROM ApexTestResult WHERE QueueItemId IN (${inList}) ORDER BY ApexClassId, MethodName`
                );
            }
        }

        let coverage = [];
        try {
            const inList = classIds.map(id => `'${escapeSoqlLiteral(id)}'`).join(',');
            coverage = await this.toolingQueryAll(
                `SELECT ApexClassOrTriggerId, NumLinesCovered, NumLinesUncovered FROM ApexCodeCoverageAggregate WHERE ApexClassOrTriggerId IN (${inList})`
            );
        } catch {
            coverage = [];
        }

        const failures = (results || []).filter(
            row => String((row as Record<string, unknown>)?.Outcome || '') !== 'Pass'
        );
        return {
            jobId,
            classIds,
            queueItems,
            results,
            failures,
            coverage,
            summary: {
                total: results.length,
                passed: results.length - failures.length,
                failed: failures.length,
            },
        };
    }

    private async listMetadataTypes() {
        const describeResult = await this.withMetadataApiClientAuthed(
            async client => await client.describeMetadata(client.apiVersion)
        );
        return parseDescribeMetadataTypes(describeResult);
    }

    private async listMetadata(args: Record<string, unknown>) {
        const type = String(args.type || '').trim();
        if (!type) {
            throw {
                code: 'EINVAL',
                message: 'Metadata type is required for metadata.list.',
            };
        }
        const folder = String(args.folder || '').trim();
        const listed = await this.withMetadataApiClientAuthed(
            async client =>
                await client.listMetadata({
                    queries: [folder ? { type, folder } : { type }],
                    asOfVersion: client.apiVersion,
                })
        );
        return normalizeListMetadataResult(listed)
            .filter(item => isRecord(item) && item.fullName && isSupportedManageableState(item))
            .sort((left, right) =>
                String((left as Record<string, unknown>)?.fullName || '').localeCompare(
                    String((right as Record<string, unknown>)?.fullName || '')
                )
            );
    }

    private async retrieveViaMetadataApi(args: Record<string, unknown>) {
        const metadataTypes = toMetadataTypesMap(args.typesMap || args.types);
        if (!metadataTypes.size) {
            const fallbackType = String(args.type || '').trim();
            if (fallbackType) {
                const fallbackMembers = toStringArray(args.members);
                metadataTypes.set(
                    fallbackType,
                    new Set(fallbackMembers.length ? fallbackMembers : ['*'])
                );
            }
        }
        if (!metadataTypes.size) {
            throw {
                code: 'EINVAL',
                message: 'metadata.retrieveViaMetadataApi requires a non-empty types map.',
            };
        }

        const includeZip = args.includeZip !== false;
        const timeoutMs = normalizeTimeoutMs(args.timeoutMs, DEFAULT_METADATA_RETRIEVE_TIMEOUT_MS);
        const pollIntervalMs = normalizePollInterval(args.pollIntervalMs);

        const retrieveStart = await this.withMetadataApiClientAuthed(
            async (client, connection) =>
                await client.retrieve({
                    typesMap: metadataTypes,
                    apiVersion: this.normalizeApiVersion(
                        connection.apiVersion || client.apiVersion
                    ),
                })
        );
        const retrieveId = String((retrieveStart as Record<string, unknown>)?.id || '').trim();
        if (!retrieveId) {
            throw {
                code: 'EMETADATA',
                message: 'Metadata retrieve did not return an async id.',
            };
        }

        const startedAt = Date.now();
        let latestStatus = null;
        for (;;) {
            // eslint-disable-next-line no-await-in-loop
            latestStatus = await this.withMetadataApiClientAuthed(
                async client =>
                    await client.checkRetrieveStatus(retrieveId, {
                        includeZip,
                    })
            );
            const status = sanitizeMetadataRetrieveStatus(latestStatus, includeZip);
            if (status.done) {
                if (!status.success) {
                    throw {
                        code: 'EMETADATA',
                        message:
                            status.errorMessage || `Metadata retrieve failed: ${status.status}`,
                    };
                }
                return {
                    id: retrieveId,
                    ...status,
                };
            }
            if (Date.now() - startedAt > timeoutMs) {
                throw {
                    code: 'ETIMEOUT',
                    message: `Metadata retrieve timed out after ${timeoutMs}ms.`,
                };
            }
            // eslint-disable-next-line no-await-in-loop
            await sleep(pollIntervalMs);
        }
    }

    private buildNameClause(members: string[]) {
        return members.map(member => `'${escapeSoqlLiteral(member)}'`).join(',');
    }

    private async retrieveToolingTypes(args: Record<string, unknown>) {
        const typesMap = toMetadataTypesMap(args.typesMap || args.types);
        if (!typesMap.size) {
            throw {
                code: 'EINVAL',
                message: 'metadata.retrieveToolingTypes requires a non-empty types map.',
            };
        }

        const result: Record<string, unknown> = {
            unsupportedTypes: [],
            types: {},
        };

        for (const [typeName, members] of typesMap.entries()) {
            if (!SUPPORTED_TOOLING_RETRIEVE_TYPES.has(typeName)) {
                (result.unsupportedTypes as string[]).push(typeName);
                continue;
            }

            const selection = membersOrAll(members);
            if (typeName === 'ApexClass') {
                const soql =
                    selection.all || !selection.members.length
                        ? 'SELECT Id, Name, Body FROM ApexClass ORDER BY Name'
                        : `SELECT Id, Name, Body FROM ApexClass WHERE Name IN (${this.buildNameClause(selection.members)}) ORDER BY Name`;
                (result.types as Record<string, unknown>).ApexClass =
                    await this.toolingQueryAll(soql);
                continue;
            }

            if (typeName === 'ApexTrigger') {
                const soql =
                    selection.all || !selection.members.length
                        ? 'SELECT Id, Name, Body FROM ApexTrigger ORDER BY Name'
                        : `SELECT Id, Name, Body FROM ApexTrigger WHERE Name IN (${this.buildNameClause(selection.members)}) ORDER BY Name`;
                (result.types as Record<string, unknown>).ApexTrigger =
                    await this.toolingQueryAll(soql);
                continue;
            }

            if (typeName === 'LightningComponentBundle') {
                const bundleSoql =
                    selection.all || !selection.members.length
                        ? 'SELECT Id, DeveloperName FROM LightningComponentBundle ORDER BY DeveloperName'
                        : `SELECT Id, DeveloperName FROM LightningComponentBundle WHERE DeveloperName IN (${this.buildNameClause(selection.members)}) ORDER BY DeveloperName`;
                const bundles = await this.toolingQueryAll(bundleSoql);
                const withResources = [];
                for (const bundle of bundles) {
                    if (!isRecord(bundle) || !bundle.Id) {
                        continue;
                    }
                    const bundleId = String(bundle.Id);
                    // eslint-disable-next-line no-await-in-loop
                    const resources = await this.toolingQueryAll(
                        `SELECT Id, FilePath, Format, Source FROM LightningComponentResource WHERE LightningComponentBundleId='${escapeSoqlLiteral(bundleId)}' ORDER BY FilePath`
                    );
                    withResources.push({
                        id: bundleId,
                        developerName: String(bundle.DeveloperName || ''),
                        resources,
                    });
                }
                (result.types as Record<string, unknown>).LightningComponentBundle = withResources;
                continue;
            }

            if (typeName === 'AuraDefinitionBundle') {
                const bundleSoql =
                    selection.all || !selection.members.length
                        ? 'SELECT Id, DeveloperName FROM AuraDefinitionBundle ORDER BY DeveloperName'
                        : `SELECT Id, DeveloperName FROM AuraDefinitionBundle WHERE DeveloperName IN (${this.buildNameClause(selection.members)}) ORDER BY DeveloperName`;
                const bundles = await this.toolingQueryAll(bundleSoql);
                const withDefinitions = [];
                for (const bundle of bundles) {
                    if (!isRecord(bundle) || !bundle.Id) {
                        continue;
                    }
                    const bundleId = String(bundle.Id);
                    // eslint-disable-next-line no-await-in-loop
                    const definitions = await this.toolingQueryAll(
                        `SELECT Id, DefType, Format, Source FROM AuraDefinition WHERE AuraDefinitionBundleId='${escapeSoqlLiteral(bundleId)}' ORDER BY DefType`
                    );
                    withDefinitions.push({
                        id: bundleId,
                        developerName: String(bundle.DeveloperName || ''),
                        definitions,
                    });
                }
                (result.types as Record<string, unknown>).AuraDefinitionBundle = withDefinitions;
            }
        }

        return result;
    }

    private async describeCustomObject(args: Record<string, unknown>) {
        const objectName = String(args.objectName || args.name || '').trim();
        if (!objectName) {
            throw {
                code: 'EINVAL',
                message: 'schema.describeCustomObject requires an object name.',
            };
        }
        return await this.toolingRequestJson(
            `/sobjects/${encodeURIComponent(objectName)}/describe`
        );
    }
}

export function createIframeJsforceBridgeRuntime(options: JsforceBridgeRuntimeOptions) {
    return new IframeJsforceBridgeRuntime(options);
}
