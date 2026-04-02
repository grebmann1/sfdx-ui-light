import jsforce from 'imported/jsforce';
import { Buffer } from 'buffer';
import { unzipSync, strFromU8 } from 'fflate/browser';
import { createIndexedDbFileSystem } from '../../lwc/app/core/fs/indexedDbFileSystem';
import createMetadataFsService from '../../lwc/app/core/fs/metadataFsService';

const STATUS = {
    IDLE: 'idle',
    RUNNING: 'running',
    FINISHED: 'finished',
    ERROR: 'error',
    CANCELLED: 'cancelled',
};

let conn;
let shouldCancel = false;
let debugEnabled = false;
let metadataFs = null;
let connectionContext = {};

if (typeof globalThis.Buffer === 'undefined') {
    globalThis.Buffer = Buffer;
}

const debugLog = (...args) => {
    if (!debugEnabled) return;
    // eslint-disable-next-line no-console
    console.log('[metadata.worker]', ...args);
};

const normalizeMetadataTypes = value => {
    if (Array.isArray(value)) {
        return value.filter(Boolean);
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return [];
        try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) {
                return parsed.filter(Boolean);
            }
        } catch (_) {
            // Ignore JSON parse errors and fallback to comma-separated parsing.
        }
        return trimmed
            .split(',')
            .map(item => item.trim())
            .filter(Boolean);
    }
    if (value && typeof value === 'object') {
        return Object.values(value).filter(Boolean);
    }
    return [];
};

const sendStatus = (type, payload = {}, status = STATUS.RUNNING) => {
    debugLog('postMessage', { type, status, payload });
    postMessage({
        type,
        status,
        ...payload,
    });
};

const initializeConnection = (connectionParams, debug = false) => {
    debugEnabled = Boolean(debug);
    connectionContext = connectionParams || {};
    conn = new jsforce.Connection(connectionParams);
    const fs = createIndexedDbFileSystem();
    metadataFs = createMetadataFsService(fs);
    debugLog('initialized', {
        instanceUrl: connectionParams?.instanceUrl,
        version: connectionParams?.version,
        debugEnabled,
    });
    sendStatus('message', { value: 'Metadata worker initialized' }, STATUS.IDLE);
};

const decodeBase64 = value => {
    const binary = atob(String(value || ''));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
};

const decodeZipEntryBytes = bytes => {
    try {
        return strFromU8(bytes);
    } catch (_) {
        // Fallback for non-UTF8 encoded metadata payloads.
        return strFromU8(bytes, true);
    }
};

const extractZipEntries = async base64Zip => {
    debugLog('extractZipEntries:start', {
        zipLength: typeof base64Zip === 'string' ? base64Zip.length : 0,
    });
    const bytes = decodeBase64(base64Zip);
    const unzipped = unzipSync(bytes);
    const entries = Object.entries(unzipped)
        .filter(([fileName]) => !String(fileName).endsWith('/'))
        .map(([fileName, contentBytes]) => ({
            fileName,
            body: decodeZipEntryBytes(contentBytes),
            size: contentBytes.length,
        }));
    const folderSet = new Set();
    for (const entry of entries) {
        const normalizedPath = String(entry.fileName || '').replace(/\\/g, '/');
        const parts = normalizedPath.split('/').filter(Boolean);
        if (parts.length > 1) {
            for (let i = 1; i < parts.length; i += 1) {
                folderSet.add(parts.slice(0, i).join('/'));
            }
        }
    }
    const sampleEntries = entries.slice(0, 10).map(entry => ({
        fileName: entry.fileName,
        size: entry.size,
        preview: String(entry.body || '')
            .slice(0, 120)
            .replace(/\s+/g, ' '),
    }));
    debugLog('extractZipEntries:done', {
        entryCount: entries.length,
        folderCount: folderSet.size,
        sampleFolders: Array.from(folderSet).slice(0, 10),
        sampleEntries,
    });
    return entries;
};

const fetchTypeRecords = async metadataType => {
    debugLog('fetchTypeRecords:start', { metadataType });
    const isToolingBacked = ['ApexClass', 'ApexTrigger', 'ApexPage', 'ApexComponent', 'AuraDefinitionBundle', 'LightningComponentBundle'].includes(metadataType);
    if (isToolingBacked) {
        const result = await conn.tooling.query(
            `SELECT Id, Name, DeveloperName, MasterLabel FROM ${metadataType}`
        );
        const records = (result?.records || []).map(record => ({
            metadataType,
            recordId: record.Id,
            label: record.Name || record.MasterLabel || record.DeveloperName || record.Id,
            fullName: record.DeveloperName || record.Name || record.Id,
            isTooling: true,
        }));
        debugLog('fetchTypeRecords:tooling:done', { metadataType, count: records.length });
        return records;
    }

    const listed = await conn.metadata.list([{ type: metadataType, folder: null }], conn.version);
    const records = Array.isArray(listed) ? listed : listed ? [listed] : [];
    const normalized = records.map(record => ({
        metadataType,
        recordId: record.id || record.fullName,
        label: record.fullName || record.fileName || record.id,
        fullName: record.fullName || record.id,
        isTooling: false,
    }));
    debugLog('fetchTypeRecords:metadata:done', { metadataType, count: normalized.length });
    return normalized;
};

const extractFirstTagValue = (xml, tagName) => {
    const regex = new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`);
    const match = String(xml || '').match(regex);
    return match ? match[1] : null;
};

const checkRetrieveStatusViaSoap = async retrieveId => {
    const targetUrl = `${conn.instanceUrl}/services/Soap/m/${conn.version}`;
    const proxyUrl = connectionContext?.proxyUrl;
    const url = proxyUrl || targetUrl;
    const soapBody = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns="http://soap.sforce.com/2006/04/metadata">
    <soapenv:Header>
        <SessionHeader>
            <sessionId>${conn.accessToken}</sessionId>
        </SessionHeader>
    </soapenv:Header>
    <soapenv:Body>
        <checkRetrieveStatus>
            <asyncProcessId>${retrieveId}</asyncProcessId>
        </checkRetrieveStatus>
    </soapenv:Body>
</soapenv:Envelope>`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'text/xml',
            SOAPAction: '""',
            'salesforceproxy-endpoint': targetUrl,
        },
        body: soapBody,
    });
    if (!response.ok) {
        throw new Error(`checkRetrieveStatus failed with ${response.status}`);
    }
    const responseText = await response.text();
    return {
        zipFile: extractFirstTagValue(responseText, 'zipFile'),
        success: extractFirstTagValue(responseText, 'success'),
        status: extractFirstTagValue(responseText, 'status'),
    };
};

const retrieveMetadataPackageZip = async ({ metadataTypes = [], apiVersion = '63.0' }) => {
    const uniqueTypes = Array.from(new Set(normalizeMetadataTypes(metadataTypes)));
    if (uniqueTypes.length === 0) {
        throw new Error('No metadata types selected for retrieve package.');
    }
    const unpackaged = {
        version: String(apiVersion || conn.version || '63.0'),
        types: uniqueTypes.map(type => ({
            name: type,
            members: ['*'],
        })),
    };
    debugLog('retrieveMetadataPackageZip:start', { unpackaged });
    const metadataApi = conn.metadata;
    metadataApi.pollTimeout = 1200000; // 20 minutes
    const requestPromise = metadataApi.retrieve({
        singlePackage: true,
        unpackaged,
    });
    const retrieveResult = await new Promise((resolve, reject) => {
        requestPromise.on('complete', res => resolve(res));
        requestPromise.on('error', reject);
        requestPromise.poll(3000, metadataApi.pollTimeout);
    });

    if (retrieveResult?.zipFile) {
        debugLog('retrieveMetadataPackageZip:completeWithZip');
        return retrieveResult.zipFile;
    }
    if (retrieveResult?.id) {
        debugLog('retrieveMetadataPackageZip:checkingStatusViaSoap', { retrieveId: retrieveResult.id });
        const statusResult = await checkRetrieveStatusViaSoap(retrieveResult.id);
        if (statusResult?.zipFile) {
            return statusResult.zipFile;
        }
    }
    throw new Error('Retrieve package completed without zip payload.');
};

const loadRecordFromToolingApi = async (sobject, recordId) => {
    const urlQuery = `/services/data/v${conn.version}/tooling/sobjects/${sobject}/${recordId}`;
    return conn.request(urlQuery);
};

const loadRecordFromMetadataApi = async (sobject, fullName) => {
    return conn.metadata.read(sobject, fullName);
};

const loadLwcFiles = async key => {
    let queryString =
        'SELECT LightningComponentBundleId,LightningComponentBundle.MasterLabel,Format,FilePath,Source FROM LightningComponentResource WHERE ';
    queryString += `LightningComponentBundleId = '${key}' OR LightningComponentBundle.DeveloperName = '${key}'`;
    const resources = (await conn.tooling.query(queryString)).records || [];
    return resources.map(x => ({
        path: x.FilePath,
        name: x.FilePath.split('/').pop(),
        body: x.Source,
        apiVersion: x.ApiVersion,
        id: x.LightningComponentBundleId,
    }));
};

const auraNameMapping = (name, type) => {
    switch (type) {
        case 'COMPONENT':
            return `${name}.cmp`;
        case 'CONTROLLER':
            return `${name}Controller.js`;
        case 'HELPER':
            return `${name}Helper.js`;
        case 'RENDERER':
            return `${name}Renderer.js`;
        case 'DOCUMENTATION':
            return `${name}.auradoc`;
        case 'DESIGN':
            return `${name}.design`;
        case 'SVG':
            return `${name}.svg`;
        default:
            return name;
    }
};

const loadAuraFiles = async data => {
    const resources =
        (
            await conn.tooling.query(
                `SELECT AuraDefinitionBundleId,Format,DefType,Source FROM AuraDefinition WHERE AuraDefinitionBundleId = '${data.Id}'`
            )
        ).records || [];
    return resources.map(x => {
        const name = auraNameMapping(data.FullName, x.DefType);
        return {
            path: name,
            name,
            body: x.Source,
            apiVersion: data.ApiVersion,
            id: data.Id,
        };
    });
};

const loadApexLikeFiles = async (sobject, data, extension = 'cls', bodyField = 'Body') => {
    return [
        {
            path: `${data.FullName || data.Name}.${extension}`,
            name: `${data.FullName || data.Name}.${extension}`,
            body: data[bodyField],
            apiVersion: data.ApiVersion,
            id: data.Id,
            metadata: sobject,
        },
    ];
};

const loadSpecificMetadataRecord = async ({ sobject, recordId, fullName }) => {
    if (sobject === 'LightningComponentBundle') {
        const files = await loadLwcFiles(recordId);
        return { files, selectedRecord: null };
    }
    if (sobject === 'AuraDefinitionBundle') {
        const data = await loadRecordFromToolingApi(sobject, recordId);
        const files = await loadAuraFiles(data);
        return { files, selectedRecord: null };
    }
    if (sobject === 'ApexClass') {
        const data = await loadRecordFromToolingApi(sobject, recordId);
        return { files: await loadApexLikeFiles(sobject, data, 'cls'), selectedRecord: null };
    }
    if (sobject === 'ApexTrigger') {
        const data = await loadRecordFromToolingApi(sobject, recordId);
        return { files: await loadApexLikeFiles(sobject, data, 'trigger'), selectedRecord: null };
    }
    if (sobject === 'ApexPage') {
        const data = await loadRecordFromToolingApi(sobject, recordId);
        return { files: await loadApexLikeFiles(sobject, data, 'page', 'Markup'), selectedRecord: null };
    }
    if (sobject === 'ApexComponent') {
        const data = await loadRecordFromToolingApi(sobject, recordId);
        return { files: await loadApexLikeFiles(sobject, data, 'component', 'Markup'), selectedRecord: null };
    }

    try {
        const selectedRecord = await loadRecordFromToolingApi(sobject, recordId);
        return { files: [], selectedRecord };
    } catch (_) {
        const selectedRecord = await loadRecordFromMetadataApi(sobject, fullName);
        return { files: [], selectedRecord };
    }
};

const startSync = async ({ metadataTypes = [], alias = null, apiVersion = '63.0' } = {}) => {
    if (!conn) {
        throw new Error('Connection is not initialized');
    }
    if (!metadataFs) {
        throw new Error('Metadata file system service is not initialized');
    }
    shouldCancel = false;
    const uniqueTypes = Array.from(new Set(normalizeMetadataTypes(metadataTypes)));
    debugLog('startSync', { rawMetadataTypes: metadataTypes, normalizedTypes: uniqueTypes, alias });
    await metadataFs.writePackageSnapshot({
        alias,
        metadataTypes: uniqueTypes,
        apiVersion,
    });
    sendStatus(
        'phase',
        { phase: 'discover', progress: { completed: 0, total: uniqueTypes.length, percent: 0 } },
        STATUS.RUNNING
    );
    if (shouldCancel) {
        sendStatus('result', { value: { cancelled: true } }, STATUS.CANCELLED);
        return;
    }
    sendStatus('phase', {
        phase: 'fetch',
        progress: { completed: 1, total: 3, percent: 34 },
    });
    const zipFile = await retrieveMetadataPackageZip({
        metadataTypes: uniqueTypes,
        apiVersion,
    });
    if (shouldCancel) {
        sendStatus('result', { value: { cancelled: true } }, STATUS.CANCELLED);
        return;
    }
    sendStatus('phase', {
        phase: 'transform',
        progress: { completed: 2, total: 3, percent: 67 },
    });
    const entries = await extractZipEntries(zipFile);
    if (shouldCancel) {
        sendStatus('result', { value: { cancelled: true } }, STATUS.CANCELLED);
        return;
    }
    sendStatus('phase', {
        phase: 'persist',
        progress: { completed: 3, total: 3, percent: 100 },
    });
    debugLog('startSync:persist:input', {
        alias,
        zipEntryCount: entries.length,
        samplePaths: entries.slice(0, 20).map(entry => entry.fileName),
    });
    const writeResult = await metadataFs.writeRetrievedPackage({
        alias,
        entries,
    });
    debugLog('startSync:persist:output', {
        status: writeResult?.status,
        writtenCount: Array.isArray(writeResult?.filesWritten) ? writeResult.filesWritten.length : 0,
        sampleWritten: (writeResult?.filesWritten || []).slice(0, 20),
    });

    sendStatus(
        'result',
        {
            value: {
                metadataTypes: uniqueTypes,
                zipEntryCount: entries.length,
                persisted: {
                    total: entries.length,
                    written: Array.isArray(writeResult?.filesWritten)
                        ? writeResult.filesWritten.length
                        : 0,
                    skipped: 0,
                    errors: [],
                },
                cancelled: false,
            },
        },
        STATUS.FINISHED
    );
    debugLog('startSync:finished', { entryCount: entries.length });
};

const persistRecord = async ({ alias, metadataType, payload }) => {
    if (!metadataFs) {
        throw new Error('Metadata file system service is not initialized');
    }
    debugLog('persistRecord:start', { metadataType, hasZip: Boolean(payload?.zipFile) });
    sendStatus('phase', { phase: 'transform', metadataType });
    const result = {
        metadataType,
        payload: payload || {},
    };
    if (payload?.zipFile) {
        const entries = await extractZipEntries(payload.zipFile);
        result.payload.unzippedEntries = entries;
    }
    result.persistence = await metadataFs.writeMetadataRecord({
        alias,
        metadataType,
        files: result.payload.files || [],
        selectedRecord: result.payload.selectedRecord || null,
        label1: result.payload.label1 || null,
        recordId: result.payload.recordId || null,
    });
    sendStatus('result', { value: result }, STATUS.FINISHED);
    debugLog('persistRecord:finished', {
        metadataType,
        unzippedEntries: result.payload?.unzippedEntries?.length || 0,
    });
};

const cancelSync = () => {
    shouldCancel = true;
    debugLog('cancelSync:requested');
    sendStatus('message', { value: 'Cancellation requested' }, STATUS.CANCELLED);
};

onmessage = async event => {
    const { action, connectionParams, debug } = event.data || {};
    debugLog('onmessage', { action });
    try {
        if (action === 'init') {
            initializeConnection(connectionParams, debug);
            return;
        }
        if (action === 'startSync') {
            await startSync(event.data);
            return;
        }
        if (action === 'persistRecord') {
            await persistRecord(event.data);
            return;
        }
        if (action === 'cancelSync') {
            cancelSync();
            return;
        }
        throw new Error(`Unknown action: ${action}`);
    } catch (error) {
        debugLog('onmessage:error', { action, error: error?.message });
        sendStatus('error', { value: error.message }, STATUS.ERROR);
    }
};
