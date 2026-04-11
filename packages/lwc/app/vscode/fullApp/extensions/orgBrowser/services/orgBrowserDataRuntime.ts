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

function parseDescribeMetadataTypes(doc: Document) {
    const output = [];
    try {
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
            const xmlName = xmlNameElement?.textContent
                ? String(xmlNameElement.textContent).trim()
                : '';
            if (!xmlName) {
                continue;
            }
            output.push({
                inFolder: String(inFolderElement?.textContent || '').trim() === 'true',
                xmlName,
            });
        }
    } catch {
        return [];
    }
    return output.sort((left, right) => left.xmlName.localeCompare(right.xmlName));
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
        return Array.isArray(listed)
            ? listed
                  .filter(item => item?.fullName && isSupportedManageableState(item))
                  .sort((left, right) =>
                      String(left.fullName || '').localeCompare(String(right.fullName || ''))
                  )
            : [];
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
