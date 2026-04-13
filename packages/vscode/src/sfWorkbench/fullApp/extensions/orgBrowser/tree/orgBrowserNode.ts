import { FOLDER_TYPES } from '../constants';

export type OrgBrowserNodeKind =
    | 'type'
    | 'folderType'
    | 'folder'
    | 'component'
    | 'customObject'
    | 'customField'
    | 'empty';

export type OrgBrowserNode = {
    id: string;
    kind: OrgBrowserNodeKind;
    xmlName: string;
    label: string;
    componentName?: string;
    description?: string;
    filePresent?: boolean;
    folderName?: string;
    namespace?: string;
    tooltip?: string;
};

export function isFolderType(xmlName: string) {
    return FOLDER_TYPES.has(String(xmlName || '').trim());
}

export function buildNodeId({
    componentName,
    folderName,
    kind,
    xmlName,
}: Pick<OrgBrowserNode, 'componentName' | 'folderName' | 'kind' | 'xmlName'>) {
    if (kind === 'type' || kind === 'folderType') {
        return String(xmlName || '');
    }
    if (kind === 'folder') {
        return `${xmlName}:${folderName}`;
    }
    return `${xmlName}:${folderName || ''}:${componentName || ''}`;
}

export function createOrgBrowserNode(input: Omit<OrgBrowserNode, 'id'>): OrgBrowserNode {
    return {
        ...input,
        id: buildNodeId(input),
    };
}

export function getNodeContextValue(node: OrgBrowserNode) {
    if (node.kind === 'customField') {
        return 'component';
    }
    if (node.kind === 'empty') {
        return 'empty';
    }
    return node.kind;
}

export function createTreeItem(vscode, node: OrgBrowserNode) {
    const collapsibleState =
        node.kind === 'component' || node.kind === 'customField' || node.kind === 'empty'
            ? vscode.TreeItemCollapsibleState.None
            : vscode.TreeItemCollapsibleState.Collapsed;
    const item = new vscode.TreeItem(node.label, collapsibleState);
    item.id = node.id;
    item.contextValue = getNodeContextValue(node);
    if (node.description) {
        item.description = node.description;
    }
    if (node.tooltip) {
        item.tooltip = node.tooltip;
    }

    if (vscode.ThemeIcon && node.kind === 'empty') {
        item.iconPath = new vscode.ThemeIcon('info');
    } else if (vscode.ThemeIcon && node.filePresent !== undefined) {
        item.iconPath = node.filePresent
            ? new vscode.ThemeIcon('pass-filled')
            : new vscode.ThemeIcon('circle-large-outline');
    }

    return item;
}
