import { unzipSync, zipSync } from 'fflate';

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

function escapeXml(text) {
    return String(text ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function stripBom(text) {
    return text && text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function firstText(doc, localName) {
    const el =
        doc.getElementsByTagNameNS?.('*', localName)?.[0] ||
        doc.getElementsByTagName(localName)?.[0];
    const v = el?.textContent != null ? String(el.textContent) : '';
    return v.trim();
}

function firstEl(doc, localName) {
    return (
        doc.getElementsByTagNameNS?.('*', localName)?.[0] ||
        doc.getElementsByTagName(localName)?.[0] ||
        null
    );
}

function allEls(doc, localName) {
    const list = doc.getElementsByTagNameNS?.('*', localName);
    if (list && typeof list.length === 'number') return Array.from(list);
    const list2 = doc.getElementsByTagName(localName);
    if (list2 && typeof list2.length === 'number') return Array.from(list2);
    return [];
}

function parseSoapError(xmlText) {
    try {
        const doc = new DOMParser().parseFromString(
            stripBom(String(xmlText || '')),
            'application/xml'
        );
        const fault = firstEl(doc, 'Fault');
        if (!fault) return null;
        const faultString = firstText(fault, 'faultstring') || firstText(doc, 'faultstring');
        const detail = firstText(fault, 'exceptionMessage') || firstText(doc, 'exceptionMessage');
        return faultString || detail
            ? `${faultString || 'SOAP Fault'}${detail ? ` - ${detail}` : ''}`
            : 'SOAP Fault';
    } catch {
        return null;
    }
}

function base64ToBytes(b64) {
    const bin = atob(String(b64 || ''));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i) & 0xff;
    return bytes;
}

function bytesToBase64(bytes) {
    const chunkSize = 0x8000;
    let out = '';
    for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        out += String.fromCharCode(...chunk);
    }
    return btoa(out);
}

export function unzipRetrieveZip(zipFileBase64) {
    const zipped = base64ToBytes(zipFileBase64);
    const files = unzipSync(zipped);
    return files;
}

export function zipUnpackagedFiles(pathToBytes) {
    const out = {};
    for (const [path, bytes] of Object.entries(pathToBytes || {})) {
        out[String(path)] = bytes;
    }
    return zipSync(out, { level: 6 });
}

type JsforceConn = {
    instanceUrl?: string;
    version?: string;
    accessToken?: string;
};

type MetadataClientOptions = {
    instanceUrl?: string;
    accessToken?: string;
    apiVersion?: string;
    proxyUrl?: string;
    connection?: JsforceConn;
    connector?: { conn?: JsforceConn };
};

export function createMetadataApiClient(options: MetadataClientOptions = {}) {
    const { instanceUrl, accessToken, apiVersion, proxyUrl } = options;
    const jsforceConnection: JsforceConn | null =
        options.connection || options.connector?.conn || null;
    const normalizedInstanceUrl = normalizeInstanceUrl(instanceUrl);
    const normalizedApiVersion = normalizeApiVersion(apiVersion);
    const normalizedProxyUrl = normalizeProxyUrl(proxyUrl);
    const token = (accessToken ?? '').trim();
    const effectiveInstanceUrl = normalizeInstanceUrl(
        normalizedInstanceUrl || jsforceConnection?.instanceUrl
    );
    const effectiveApiVersion = normalizeApiVersion(
        normalizedApiVersion || jsforceConnection?.version
    );
    const effectiveToken = (token || jsforceConnection?.accessToken || '').trim();

    if (!effectiveInstanceUrl) throw new Error('Missing Instance URL.');
    if (!effectiveToken) throw new Error('Missing Access Token.');

    const soapPath = `/services/Soap/m/${effectiveApiVersion}`;
    const upstreamUrl = `${effectiveInstanceUrl}${soapPath}`;
    const proxyBase = normalizedProxyUrl ? `${normalizedProxyUrl}/proxy` : '';
    const url = normalizedProxyUrl ? `${proxyBase}${soapPath}` : upstreamUrl;

    async function requestSoap(bodyInnerXml) {
        const envelope =
            `<?xml version="1.0" encoding="UTF-8"?>` +
            `<env:Envelope xmlns:env="http://schemas.xmlsoap.org/soap/envelope/" xmlns:met="http://soap.sforce.com/2006/04/metadata">` +
            `<env:Header>` +
            `<met:SessionHeader><met:sessionId>${escapeXml(effectiveToken)}</met:sessionId></met:SessionHeader>` +
            `</env:Header>` +
            `<env:Body>${bodyInnerXml}</env:Body>` +
            `</env:Envelope>`;

        const res = await fetch(url, {
            method: 'POST',
            headers: {
                ...(normalizedProxyUrl ? { 'Salesforceproxy-Endpoint': upstreamUrl } : null),
                'Content-Type': 'text/xml; charset=UTF-8',
            },
            body: envelope,
        });

        const text = await res.text();
        if (!res.ok) {
            const soapErr = parseSoapError(text);
            const err = new Error(soapErr || `Metadata API error (${res.status})`);
            err.status = res.status;
            err.payload = text;
            throw err;
        }
        const doc = new DOMParser().parseFromString(stripBom(text), 'application/xml');
        const soapErr = parseSoapError(text);
        if (soapErr) {
            const err = new Error(soapErr);
            err.status = 500;
            err.payload = text;
            throw err;
        }
        return doc;
    }

    function xmlForTypes(typesMap) {
        const parts = [];
        for (const [typeName, membersSet] of typesMap.entries()) {
            const members = Array.isArray(membersSet) ? membersSet : Array.from(membersSet || []);
            if (!typeName || !members.length) continue;
            parts.push(
                `<types>` +
                    members.map(m => `<members>${escapeXml(m)}</members>`).join('') +
                    `<name>${escapeXml(typeName)}</name>` +
                    `</types>`
            );
        }
        return parts.join('');
    }

    return {
        instanceUrl: effectiveInstanceUrl,
        apiVersion: effectiveApiVersion,
        proxyUrl: normalizedProxyUrl || null,

        async describeMetadata(asOfVersion = effectiveApiVersion) {
            if (typeof jsforceConnection?.metadata?.describe === 'function') {
                return await jsforceConnection.metadata.describe(asOfVersion);
            }
            const doc = await requestSoap(
                `<met:describeMetadata><met:asOfVersion>${escapeXml(asOfVersion)}</met:asOfVersion></met:describeMetadata>`
            );
            return doc;
        },

        async listMetadata({ queries, asOfVersion = effectiveApiVersion } = {}) {
            const q = Array.isArray(queries) ? queries : [];
            if (!q.length) return [];
            if (typeof jsforceConnection?.metadata?.list === 'function') {
                return await jsforceConnection.metadata.list(q, asOfVersion);
            }
            const queriesXml = q
                .filter(x => x && x.type)
                .map(x => {
                    const folder = x.folder ? `<folder>${escapeXml(x.folder)}</folder>` : '';
                    return `<queries>${folder}<type>${escapeXml(x.type)}</type></queries>`;
                })
                .join('');
            if (!queriesXml) return [];
            const doc = await requestSoap(
                `<met:listMetadata>` +
                    `${queriesXml}` +
                    `<met:asOfVersion>${escapeXml(asOfVersion)}</met:asOfVersion>` +
                    `</met:listMetadata>`
            );
            const results = allEls(doc, 'result');
            return results
                .map(r => ({
                    fullName: firstText(r, 'fullName'),
                    type: firstText(r, 'type'),
                    fileName: firstText(r, 'fileName'),
                    namespacePrefix: firstText(r, 'namespacePrefix'),
                    lastModifiedDate: firstText(r, 'lastModifiedDate'),
                }))
                .filter(x => x.fullName || x.fileName);
        },

        async retrieve({ typesMap, apiVersion = effectiveApiVersion } = {}) {
            const typesXml = xmlForTypes(typesMap || new Map());
            if (typeof jsforceConnection?.metadata?.retrieve === 'function') {
                const unpackaged = {
                    version: apiVersion,
                    types: Array.from(typesMap?.entries?.() || []).map(([name, members]) => ({
                        name,
                        members: Array.isArray(members) ? members : Array.from(members || []),
                    })),
                };
                const result = await jsforceConnection.metadata.retrieve({
                    apiVersion,
                    singlePackage: true,
                    unpackaged,
                });
                const id = result?.id || result?.asyncProcessId || result?.zipFile;
                if (!id) {
                    throw new Error('Retrieve did not return an id.');
                }
                return { id };
            }
            const doc = await requestSoap(
                `<met:retrieve>` +
                    `<met:retrieveRequest>` +
                    `<apiVersion>${escapeXml(apiVersion)}</apiVersion>` +
                    `<singlePackage>true</singlePackage>` +
                    `<unpackaged>${typesXml}<version>${escapeXml(apiVersion)}</version></unpackaged>` +
                    `</met:retrieveRequest>` +
                    `</met:retrieve>`
            );
            const id = firstText(doc, 'id');
            if (!id) throw new Error('Retrieve did not return an id.');
            return { id };
        },

        async checkRetrieveStatus(id, { includeZip = true } = {}) {
            if (typeof jsforceConnection?.metadata?.checkRetrieveStatus === 'function') {
                return await jsforceConnection.metadata.checkRetrieveStatus(id, includeZip);
            }
            const doc = await requestSoap(
                `<met:checkRetrieveStatus>` +
                    `<met:asyncProcessId>${escapeXml(id)}</met:asyncProcessId>` +
                    `<met:includeZip>${includeZip ? 'true' : 'false'}</met:includeZip>` +
                    `</met:checkRetrieveStatus>`
            );
            const done = firstText(doc, 'done') === 'true';
            const success = firstText(doc, 'success') === 'true';
            const status = firstText(doc, 'status') || '';
            const zipFile = includeZip ? firstText(doc, 'zipFile') : '';
            const errorMessage = firstText(doc, 'errorMessage') || '';
            return { done, success, status, zipFile, errorMessage, raw: doc };
        },

        async deploy(zipBytes, { checkOnly = false, testLevel = 'NoTestRun' } = {}) {
            const zipB64 = bytesToBase64(
                zipBytes instanceof Uint8Array ? zipBytes : new Uint8Array(zipBytes || [])
            );
            if (typeof jsforceConnection?.metadata?.deploy === 'function') {
                const result = await jsforceConnection.metadata.deploy(zipB64, {
                    checkOnly,
                    singlePackage: true,
                    testLevel,
                });
                const id = result?.id || result?.asyncProcessId || result?.zipFile;
                if (!id) {
                    throw new Error('Deploy did not return an id.');
                }
                return { id };
            }
            const doc = await requestSoap(
                `<met:deploy>` +
                    `<met:ZipFile>${zipB64}</met:ZipFile>` +
                    `<met:DeployOptions>` +
                    `<checkOnly>${checkOnly ? 'true' : 'false'}</checkOnly>` +
                    `<singlePackage>true</singlePackage>` +
                    `<testLevel>${escapeXml(testLevel)}</testLevel>` +
                    `</met:DeployOptions>` +
                    `</met:deploy>`
            );
            const id = firstText(doc, 'id');
            if (!id) throw new Error('Deploy did not return an id.');
            return { id };
        },

        async checkDeployStatus(id, { includeDetails = true } = {}) {
            if (typeof jsforceConnection?.metadata?.checkDeployStatus === 'function') {
                return await jsforceConnection.metadata.checkDeployStatus(id, includeDetails);
            }
            const doc = await requestSoap(
                `<met:checkDeployStatus>` +
                    `<met:asyncProcessId>${escapeXml(id)}</met:asyncProcessId>` +
                    `<met:includeDetails>${includeDetails ? 'true' : 'false'}</met:includeDetails>` +
                    `</met:checkDeployStatus>`
            );
            const done = firstText(doc, 'done') === 'true';
            const success = firstText(doc, 'success') === 'true';
            const status = firstText(doc, 'status') || '';
            const errorMessage = firstText(doc, 'errorMessage') || '';
            return { done, success, status, errorMessage, raw: doc };
        },
    };
}
