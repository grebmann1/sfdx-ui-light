import { TOOLING_METADATA_TYPES } from '../../metadata/runtime/metadataRetrieveRuntimeHelpers';

function groupMembersByType(members: Array<{ fullName: string; type: string }>) {
    const typesMap = new Map();
    for (const member of members || []) {
        if (!member?.type || !member?.fullName) {
            continue;
        }
        const existing = typesMap.get(member.type) || new Set();
        existing.add(member.fullName);
        typesMap.set(member.type, existing);
    }
    return typesMap;
}

function shouldUseToolingRetrieve(members: Array<{ fullName: string; type: string }>) {
    if (!Array.isArray(members) || !members.length) {
        return false;
    }
    const type = String(members[0]?.type || '');
    if (!TOOLING_METADATA_TYPES.has(type)) {
        return false;
    }
    return members.every(member => String(member?.type || '') === type);
}

export function createOrgBrowserRetrieveService({
    connectionRuntime,
    metadataRetrieveRuntime,
    vscode,
}) {
    async function retrieveMembers(
        members: Array<{ fullName: string; type: string }>,
        { openFirstFile, title }: { openFirstFile?: boolean; title?: string } = {}
    ) {
        const conn = connectionRuntime.loadStoredConn();
        if (!conn.instanceUrl || !conn.accessToken) {
            throw new Error(connectionRuntime.getInjectedConnectionRequiredMessage());
        }
        const typesMap = groupMembersByType(members);
        const result = shouldUseToolingRetrieve(members)
            ? await metadataRetrieveRuntime.retrieveToolingTypes(conn, typesMap, {
                  title: title || 'Retrieving selected metadata...',
              })
            : await metadataRetrieveRuntime.retrieveViaMetadataApi(conn, typesMap, {
                  title: title || 'Retrieving selected metadata via Metadata API...',
              });

        if (openFirstFile && result.writtenPaths?.length && vscode.window?.showTextDocument) {
            try {
                await vscode.window.showTextDocument(vscode.Uri.file(result.writtenPaths[0]));
            } catch {
                // ignore file-open failures
            }
        }

        return result;
    }

    return {
        retrieveMembers,
    };
}

export const __testables = {
    groupMembersByType,
    shouldUseToolingRetrieve,
};
