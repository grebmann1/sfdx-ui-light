import type { MetadataTypeTreeProvider } from '../tree/metadataTypeTreeProvider';
import type { OrgBrowserNode } from '../tree/orgBrowserNode';

function buildRetrieveTitle(node: OrgBrowserNode) {
    return node?.componentName
        ? `Retrieving ${node.componentName}...`
        : `Retrieving ${node?.xmlName || 'metadata'}...`;
}

export async function getRetrieveMembers(
    node: OrgBrowserNode,
    treeProvider: MetadataTypeTreeProvider
) {
    if (
        (node.kind === 'component' ||
            node.kind === 'customObject' ||
            node.kind === 'customField') &&
        node.componentName
    ) {
        return [{ fullName: node.componentName, type: node.xmlName }];
    }
    if (node.kind !== 'type') {
        return [];
    }
    const children = await treeProvider.getChildren(node);
    return children
        .filter(child => Boolean(child?.componentName))
        .map(child => ({
            fullName: child.componentName!,
            type: child.xmlName,
        }));
}

async function confirmOverwrite(vscode, dataRuntime, members) {
    let overwriteCount = 0;
    for (const member of members || []) {
        // eslint-disable-next-line no-await-in-loop
        const present = await dataRuntime.isMemberPresent(member.type, member.fullName);
        if (present) {
            overwriteCount += 1;
        }
    }
    if (!overwriteCount) {
        return true;
    }
    const yesLabel = 'Retrieve and overwrite';
    const answer = await vscode.window.showWarningMessage(
        `${overwriteCount} selected item(s) already exist locally. Retrieve and overwrite them?`,
        yesLabel,
        'Cancel'
    );
    return answer === yesLabel;
}

export function createRetrieveHandler({ dataRuntime, retrieveService, treeProvider, vscode }) {
    return async function retrieveMetadata(node: OrgBrowserNode) {
        const members = await getRetrieveMembers(node, treeProvider);
        if (!members.length) {
            return null;
        }
        const confirmed = await confirmOverwrite(vscode, dataRuntime, members);
        if (!confirmed) {
            return 'canceled';
        }
        const result = await retrieveService.retrieveMembers(members, {
            openFirstFile: members.length === 1,
            title: buildRetrieveTitle(node),
        });
        if (node.kind === 'component' || node.kind === 'customField') {
            node.filePresent = true;
            treeProvider.fireChangeEvent(node);
        } else if (node.kind === 'customObject') {
            node.filePresent = true;
            if (typeof dataRuntime?.invalidateCustomObjectFieldPresenceCache === 'function') {
                dataRuntime.invalidateCustomObjectFieldPresenceCache(node.componentName);
            }
            await treeProvider.refreshType(node);
        } else {
            await treeProvider.refreshType(node);
        }
        return result;
    };
}

export const __testables = {
    buildRetrieveTitle,
    getRetrieveMembers,
};
