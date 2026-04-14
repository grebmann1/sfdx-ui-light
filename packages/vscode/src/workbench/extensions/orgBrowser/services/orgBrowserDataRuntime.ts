import { createToolingMapStore } from '../../metadata/core/toolingMapStore';
import { getWorkspaceRootUri, safeSeg } from '../../metadata/core/workspacePaths';
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
            rawInFolder === true ||
            String(rawInFolder ?? '')
                .trim()
                .toLowerCase() === 'true',
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

function splitCustomFieldFullName(fullName: string) {
    const normalized = String(fullName || '').trim();
    const separatorIndex = normalized.indexOf('.');
    if (separatorIndex <= 0 || separatorIndex === normalized.length - 1) {
        return null;
    }
    return {
        fieldName: normalized.slice(separatorIndex + 1),
        objectName: normalized.slice(0, separatorIndex),
    };
}

const CUSTOM_OBJECT_CHILD_FILE_RULES = {
    BusinessProcess: {
        folder: 'businessProcesses',
        suffix: '.businessProcess-meta.xml',
    },
    CompactLayout: {
        folder: 'compactLayouts',
        suffix: '.compactLayout-meta.xml',
    },
    CustomField: {
        folder: 'fields',
        suffix: '.field-meta.xml',
    },
    FieldSet: {
        folder: 'fieldSets',
        suffix: '.fieldSet-meta.xml',
    },
    Index: {
        folder: 'indexes',
        suffix: '.index-meta.xml',
    },
    ListView: {
        folder: 'listViews',
        suffix: '.listView-meta.xml',
    },
    RecordType: {
        folder: 'recordTypes',
        suffix: '.recordType-meta.xml',
    },
    SharingReason: {
        folder: 'sharingReasons',
        suffix: '.sharingReason-meta.xml',
    },
    ValidationRule: {
        folder: 'validationRules',
        suffix: '.validationRule-meta.xml',
    },
    WebLink: {
        folder: 'webLinks',
        suffix: '.webLink-meta.xml',
    },
} as const;

function splitObjectChildFullName(fullName: string) {
    const normalized = String(fullName || '').trim();
    const separatorIndex = normalized.indexOf('.');
    if (separatorIndex <= 0 || separatorIndex === normalized.length - 1) {
        return null;
    }
    return {
        childName: normalized.slice(separatorIndex + 1),
        objectName: normalized.slice(0, separatorIndex),
    };
}

function parseCustomFieldNamesFromObjectMetadataXml(xmlText: string) {
    const names = new Set<string>();
    const matches = String(xmlText || '').matchAll(/<fields>([\s\S]*?)<\/fields>/g);
    for (const match of matches) {
        const block = String(match?.[1] || '');
        const fieldMatch = block.match(/<fullName>\s*([^<]+)\s*<\/fullName>/);
        const fieldName = String(fieldMatch?.[1] || '').trim();
        if (fieldName) {
            names.add(fieldName);
        }
    }
    return names;
}

export function createOrgBrowserDataRuntime({
    connectionRuntime,
    metadataRetrieveRuntime,
    state,
    vscode,
}) {
    const toolingMapStore = createToolingMapStore(vscode, state);
    const objectFieldNamesCache = new Map<string, Promise<Set<string>>>();

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

    async function loadObjectFieldNamesFromWorkspace(objectName: string) {
        const key = String(objectName || '').trim();
        if (!key) {
            return new Set<string>();
        }
        const cached = objectFieldNamesCache.get(key);
        if (cached) {
            return await cached;
        }
        const pending = (async () => {
            const workspaceFolderUris = Array.isArray(vscode?.workspace?.workspaceFolders)
                ? vscode.workspace.workspaceFolders
                      .map(folder => folder?.uri)
                      .filter(folderUri => Boolean(folderUri))
                : [];
            const roots =
                workspaceFolderUris.length > 0
                    ? workspaceFolderUris
                    : [getWorkspaceRootUri(vscode)];
            for (const rootUri of roots) {
                const fileUri = vscode.Uri.joinPath(
                    rootUri,
                    'force-app',
                    'main',
                    'default',
                    'objects',
                    safeSeg(key),
                    `${safeSeg(key)}.object-meta.xml`
                );
                try {
                    // eslint-disable-next-line no-await-in-loop
                    const bytes = await vscode.workspace.fs.readFile(fileUri);
                    const text = new TextDecoder().decode(bytes || new Uint8Array());
                    return parseCustomFieldNamesFromObjectMetadataXml(text);
                } catch {
                    // Keep probing other workspace folders.
                }
            }
            return new Set<string>();
        })();
        objectFieldNamesCache.set(key, pending);
        return await pending;
    }

    async function isCustomFieldPresentInWorkspace(fullName: string) {
        const split = splitCustomFieldFullName(fullName);
        if (!split) {
            return false;
        }
        const fieldNames = await loadObjectFieldNamesFromWorkspace(split.objectName);
        return fieldNames.has(split.fieldName);
    }

    async function isObjectChildPresentInWorkspace(type: string, fullName: string) {
        const rule = CUSTOM_OBJECT_CHILD_FILE_RULES[String(type || '').trim()];
        if (!rule) {
            return false;
        }
        const split = splitObjectChildFullName(fullName);
        if (!split) {
            return false;
        }
        const workspaceFolderUris = Array.isArray(vscode?.workspace?.workspaceFolders)
            ? vscode.workspace.workspaceFolders
                  .map(folder => folder?.uri)
                  .filter(folderUri => Boolean(folderUri))
            : [];
        const roots =
            workspaceFolderUris.length > 0 ? workspaceFolderUris : [getWorkspaceRootUri(vscode)];
        for (const rootUri of roots) {
            const childFileUri = vscode.Uri.joinPath(
                rootUri,
                'force-app',
                'main',
                'default',
                'objects',
                safeSeg(split.objectName),
                rule.folder,
                `${safeSeg(split.childName)}${rule.suffix}`
            );
            try {
                // eslint-disable-next-line no-await-in-loop
                await vscode.workspace.fs.stat(childFileUri);
                return true;
            } catch {
                // keep probing other roots
            }
        }
        return false;
    }

    function invalidateCustomObjectFieldPresenceCache(objectName?: string) {
        const normalizedObjectName = String(objectName || '').trim();
        if (!normalizedObjectName) {
            objectFieldNamesCache.clear();
            return;
        }
        objectFieldNamesCache.delete(normalizedObjectName);
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
            if (metadataMembers[buildMetadataMemberKey(type, fullName)]) {
                return true;
            }
            return await isCustomFieldPresentInWorkspace(fullName);
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
        if (metadataMembers[buildMetadataMemberKey(type, fullName)]) {
            return true;
        }
        return await isObjectChildPresentInWorkspace(type, fullName);
    }

    return {
        describeCustomObject,
        invalidateCustomObjectFieldPresenceCache,
        isMemberPresent,
        listMetadata,
        listMetadataTypes,
    };
}
