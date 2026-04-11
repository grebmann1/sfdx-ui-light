import { buildSalesforceExtensionConfig } from '../core/extensionManifest';

import {
    COLLAPSE_ALL_COMMAND,
    EXTENSION_NAME,
    OPEN_VIEW_COMMAND,
    ORG_BROWSER_ICON_PATH,
    REFRESH_TYPE_COMMAND,
    RETRIEVE_METADATA_COMMAND,
    TREE_VIEW_ID,
    VIEW_CONTAINER_ID,
} from './constants';

export function buildOrgBrowserExtensionConfig() {
    return buildSalesforceExtensionConfig({
        name: EXTENSION_NAME,
        displayName: 'Salesforce Org Browser (Workbench)',
        description: 'Browse metadata in the connected org and retrieve items into the workspace',
        contributes: {
            viewsWelcome: [
                {
                    contents:
                        'The Org Browser loads metadata types from the connected org and lets you retrieve items into the workspace.',
                    view: TREE_VIEW_ID,
                },
            ],
            viewsContainers: {
                activitybar: [
                    {
                        icon: ORG_BROWSER_ICON_PATH,
                        id: VIEW_CONTAINER_ID,
                        title: 'Org Browser',
                    },
                ],
            },
            views: {
                [VIEW_CONTAINER_ID]: [
                    {
                        id: TREE_VIEW_ID,
                        name: 'Org Browser',
                    },
                ],
            },
            commands: [
                {
                    command: OPEN_VIEW_COMMAND,
                    title: 'Salesforce: Open Org Browser',
                },
                {
                    command: REFRESH_TYPE_COMMAND,
                    title: 'Org Browser: Refresh',
                    icon: '$(refresh)',
                },
                {
                    command: RETRIEVE_METADATA_COMMAND,
                    title: 'Org Browser: Retrieve Metadata',
                },
                {
                    command: COLLAPSE_ALL_COMMAND,
                    title: 'Org Browser: Collapse All',
                    icon: '$(collapse-all)',
                },
            ],
            menus: {
                commandPalette: [{ command: OPEN_VIEW_COMMAND }],
                'view/title': [
                    {
                        command: REFRESH_TYPE_COMMAND,
                        group: 'navigation@0',
                        when: `view == ${TREE_VIEW_ID}`,
                    },
                    {
                        command: COLLAPSE_ALL_COMMAND,
                        group: 'navigation@1',
                        when: `view == ${TREE_VIEW_ID}`,
                    },
                ],
                'view/item/context': [
                    {
                        command: REFRESH_TYPE_COMMAND,
                        group: 'inline',
                        when: `view == ${TREE_VIEW_ID} && (viewItem == type || viewItem == customObject || viewItem == folderType || viewItem == folder)`,
                    },
                    {
                        command: RETRIEVE_METADATA_COMMAND,
                        group: 'inline',
                        when: `view == ${TREE_VIEW_ID} && (viewItem == type || viewItem == customObject || viewItem == component)`,
                    },
                ],
            },
        },
    });
}

export async function openOrgBrowserView(vscode) {
    const attempts = [
        `workbench.view.extension.${VIEW_CONTAINER_ID}`,
        `workbench.actions.treeView.${TREE_VIEW_ID}.focus`,
    ];
    for (const command of attempts) {
        try {
            await vscode.commands.executeCommand(command);
        } catch {
            // try the next fallback
        }
    }
}
