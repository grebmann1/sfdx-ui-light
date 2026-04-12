import { createToolingMapStore } from '../../metadata/core/toolingMapStore';
import { safeSeg } from '../../metadata/core/workspacePaths';
import { TOOLING_METADATA_TYPES } from '../../metadata/runtime/metadataRetrieveRuntimeHelpers';

function buildMetadataMemberKey(type: string, fullName: string) {
    return `${String(type || '').trim()}::${String(fullName || '').trim()}`;
}

function buildToolingBundlePrefix(bundleType: string, fullName: string) {
    const safeBundleName = safeSeg(fullName);
    if (bundleType === 'LightningComponentBundle') {
        return `/lwc/${safeBundleName}/`;
    }
    if (bundleType === 'AuraDefinitionBundle') {
        return `/aura/${safeBundleName}/`;
    }
    return '';
}

function isSupportedManageableState(item) {
    return (
        !item?.manageableState ||
        ['unmanaged', 'installedEditable', 'deprecatedEditable'].includes(item.manageableState)
    );
}

type MetadataTypeEntry = {
    inFolder: boolean;
    xmlName: string;
};

type DescribeMetadataTypeRecord = {
    inFolder?: unknown;
    xmlName?: unknown;
};

type XmlLikeNode = {
    textContent?: unknown;
};

type XmlLikeElement = {
    getElementsByTagName?: (tagName: string) => XmlLikeNode[];
    getElementsByTagNameNS?: (namespace: string, localName: string) => XmlLikeNode[];
};

type XmlLikeDocument = {
    getElementsByTagName?: (tagName: string) => XmlLikeElement[];
    getElementsByTagNameNS?: (namespace: string, localName: string) => XmlLikeElement[];
};

function normalizeMetadataTypeEntry(rawXmlName: unknown, rawInFolder: unknown) {
    const xmlName = String(rawXmlName ?? '').trim();
    if (!xmlName) {
        return null;
    }
    return {
        inFolder:
            rawInFolder === true || String(rawInFolder ?? '').trim().toLowerCase() === 'true',
        xmlName,
    };
}

function parseDescribeMetadataTypesFromXmlDocument(doc: XmlLikeDocument): MetadataTypeEntry[] {
    const output: MetadataTypeEntry[] = [];
    const metadataObjects = Array.from(
        doc.getElementsByTagNameNS?.('*', 'metadataObjects') ||
            doc.getElementsByTagName('metadataObjects') ||
            []
    );
    for (const metadataObject of metadataObjects) {
        const xmlNameElement =
            metadataObject.getElementsByTagNameNS?.('*', 'xmlName')?.[0] ||
            metadataObject.getElementsByTagName('xmlName')?.[0];
        const inFolderElement =
            metadataObject.getElementsByTagNameNS?.('*', 'inFolder')?.[0] ||
            metadataObject.getElementsByTagName('inFolder')?.[0];
        const normalized = normalizeMetadataTypeEntry(
            xmlNameElement?.textContent,
            inFolderElement?.textContent
        );
        if (normalized) {
            output.push(normalized);
        }
    }
    return output;
}

function parseDescribeMetadataTypesFromObject(describeResult: unknown): MetadataTypeEntry[] {
    const metadataObjects =
        describeResult &&
        typeof describeResult === 'object' &&
        Array.isArray((describeResult as { metadataObjects?: unknown[] }).metadataObjects)
            ? (describeResult as { metadataObjects: DescribeMetadataTypeRecord[] }).metadataObjects
            : [];
    const output: MetadataTypeEntry[] = [];
    for (const metadataObject of metadataObjects) {
        const normalized = normalizeMetadataTypeEntry(
            metadataObject?.xmlName,
            metadataObject?.inFolder
        );
        if (normalized) {
            output.push(normalized);
        }
    }
    return output;
}

function parseDescribeMetadataTypes(describeResult: unknown): MetadataTypeEntry[] {
    try {
        const fromObject = parseDescribeMetadataTypesFromObject(describeResult);
        if (fromObject.length > 0) {
            return fromObject.sort((left, right) => left.xmlName.localeCompare(right.xmlName));
        }
        if (
            describeResult &&
            typeof describeResult === 'object' &&
            typeof (describeResult as XmlLikeDocument).getElementsByTagName === 'function'
        ) {
            return parseDescribeMetadataTypesFromXmlDocument(
                describeResult as XmlLikeDocument
            ).sort((left, right) => left.xmlName.localeCompare(right.xmlName));
        }
    } catch {
        return [];
    }
    return [];
}

function normalizeListMetadataResult(listed: unknown) {
    if (Array.isArray(listed)) {
        return listed;
    }
    if (listed && typeof listed === 'object') {
        return [listed];
    }
    return [];
}

export function createOrgBrowserDataRuntime({
    connectionRuntime,
    metadataRetrieveRuntime,
    state,
    vscode,
}) {
    const toolingMapStore = createToolingMapStore(vscode, state);

    async function listMetadataTypes(conn = connectionRuntime.loadStoredConn()) {
        return await metadataRetrieveRuntime.withMetadataApiClientAuthed(conn, async client =>
            parseDescribeMetadataTypes(await client.describeMetadata(client.apiVersion))
        );
    }

    async function listMetadata(
        type: string,
        folder?: string,
        conn = connectionRuntime.loadStoredConn()
    ) {
        const listed = await metadataRetrieveRuntime.withMetadataApiClientAuthed(
            conn,
            async client =>
                await client.listMetadata({
                    queries: [
                        folder
                            ? { folder, type: String(type || '') }
                            : { type: String(type || '') },
                    ],
                    asOfVersion: client.apiVersion,
                })
        );
        return normalizeListMetadataResult(listed)
            .filter(item => item?.fullName && isSupportedManageableState(item))
            .sort((left, right) =>
                String(left.fullName || '').localeCompare(String(right.fullName || ''))
            );
    }

    async function describeCustomObject(
        objectName: string,
        conn = connectionRuntime.loadStoredConn()
    ) {
        return await connectionRuntime.withToolingClientAuthed(conn, async client => {
            return await client.requestJson(`/sobjects/${encodeURIComponent(objectName)}/describe`);
        });
    }

    async function loadPresenceMaps() {
        const [metadataApiMap, toolingMapItems] = await Promise.all([
            metadataRetrieveRuntime.loadMetadataApiMapJson(),
            toolingMapStore.loadItems(),
        ]);
        return {
            metadataMembers:
                metadataApiMap?.members && typeof metadataApiMap.members === 'object'
                    ? metadataApiMap.members
                    : {},
            toolingMapItems:
                toolingMapItems && typeof toolingMapItems === 'object' ? toolingMapItems : {},
        };
    }

    async function isMemberPresent(type: string, fullName: string) {
        if (!type || !fullName) {
            return false;
        }
        const { metadataMembers, toolingMapItems } = await loadPresenceMaps();
        if (type === 'CustomField') {
            return Boolean(metadataMembers[buildMetadataMemberKey(type, fullName)]);
        }
        if (TOOLING_METADATA_TYPES.has(type)) {
            if (type === 'ApexClass') {
                return Object.keys(toolingMapItems).some(
                    path =>
                        path.endsWith(`/classes/${safeSeg(fullName)}.cls`) &&
                        toolingMapItems[path]?.type === 'ApexClass'
                );
            }
            if (type === 'ApexTrigger') {
                return Object.keys(toolingMapItems).some(
                    path =>
                        path.endsWith(`/triggers/${safeSeg(fullName)}.trigger`) &&
                        toolingMapItems[path]?.type === 'ApexTrigger'
                );
            }
            const bundlePrefix = buildToolingBundlePrefix(type, fullName);
            if (!bundlePrefix) {
                return false;
            }
            return Object.keys(toolingMapItems).some(path => path.includes(bundlePrefix));
        }
        return Boolean(metadataMembers[buildMetadataMemberKey(type, fullName)]);
    }

    return {
        describeCustomObject,
        isMemberPresent,
        listMetadata,
        listMetadataTypes,
    };
}
