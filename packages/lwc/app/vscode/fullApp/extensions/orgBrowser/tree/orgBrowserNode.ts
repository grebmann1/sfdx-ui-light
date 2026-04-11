import { FOLDER_TYPES } from '../constants';

export type OrgBrowserNodeKind =
    | 'type'
    | 'folderType'
    | 'folder'
    | 'component'
    | 'customObject'
    | 'customField';

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
    return node.kind;
}

export function createTreeItem(vscode, node: OrgBrowserNode) {
    const collapsibleState =
        node.kind === 'component' || node.kind === 'customField'
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

    if (vscode.ThemeIcon) {
        if (node.kind === 'type' || node.kind === 'folderType') {
            item.iconPath = new vscode.ThemeIcon('symbol-class');
        } else if (node.kind === 'folder') {
            item.iconPath = new vscode.ThemeIcon('folder');
        } else if (node.kind === 'customObject') {
            item.iconPath = node.filePresent
                ? new vscode.ThemeIcon('pass-filled')
                : new vscode.ThemeIcon('database');
        } else {
            item.iconPath = node.filePresent
                ? new vscode.ThemeIcon('pass-filled')
                : new vscode.ThemeIcon('circle-large-outline');
        }
    }

    return item;
}
