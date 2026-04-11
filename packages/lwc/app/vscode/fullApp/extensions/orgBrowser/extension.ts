import { registerCommand, registerSalesforceExtension } from '../core/extensionRegistration';
import { createMetadataRetrieveRuntime } from '../metadata/runtime/metadataRetrieveRuntime';
import { getOrCreateSalesforceWorkbenchHost } from '../salesforce/salesforceWorkbenchHost';

import { createRetrieveHandler } from './commands/retrieveMetadata';
import {
    COLLAPSE_ALL_COMMAND,
    OPEN_VIEW_COMMAND,
    ORG_BROWSER_INLINE_ASSETS,
    REFRESH_TYPE_COMMAND,
    RETRIEVE_METADATA_COMMAND,
    TREE_VIEW_ID,
} from './constants';
import { buildOrgBrowserExtensionConfig, openOrgBrowserView } from './extensionConfig';
import { createOrgBrowserDataRuntime } from './services/orgBrowserDataRuntime';
import { createOrgBrowserRetrieveService } from './services/orgBrowserRetrieveService';
import { MetadataTypeTreeProvider } from './tree/metadataTypeTreeProvider';

export async function register(vscodeBundle) {
    return registerSalesforceExtension(
        vscodeBundle,
        {
            config: buildOrgBrowserExtensionConfig(),
            inlineAssets: ORG_BROWSER_INLINE_ASSETS,
        },
        async vscode => {
            const sfHost = await getOrCreateSalesforceWorkbenchHost(vscodeBundle);
            if (!sfHost || !vscode) {
                return;
            }

            await sfHost.activateFeatureOnce(
                'salesforce-org-browser',
                async ({ connectionRuntime, context, deployTools }) => {
                    const metadataRetrieveRuntime = createMetadataRetrieveRuntime({
                        connectionRuntime,
                        state: context.state,
                        updateSourceTrackingForPaths: deployTools.updateSourceTrackingForPaths,
                        vscode,
                    });
                    const dataRuntime = createOrgBrowserDataRuntime({
                        connectionRuntime,
                        metadataRetrieveRuntime,
                        state: context.state,
                        vscode,
                    });
                    const retrieveService = createOrgBrowserRetrieveService({
                        connectionRuntime,
                        metadataRetrieveRuntime,
                        vscode,
                    });
                    const treeProvider = new MetadataTypeTreeProvider(
                        connectionRuntime,
                        dataRuntime,
                        vscode
                    );
                    context.addDisposable(treeProvider);

                    registerCommand(context, vscode, OPEN_VIEW_COMMAND, async () => {
                        await openOrgBrowserView(vscode);
                    });
                    registerCommand(context, vscode, REFRESH_TYPE_COMMAND, async node => {
                        await treeProvider.refreshType(node);
                    });
                    registerCommand(context, vscode, COLLAPSE_ALL_COMMAND, async () => {
                        try {
                            await vscode.commands.executeCommand(
                                `workbench.actions.treeView.${TREE_VIEW_ID}.collapseAll`
                            );
                        } catch {
                            // ignore
                        }
                    });
                    registerCommand(
                        context,
                        vscode,
                        RETRIEVE_METADATA_COMMAND,
                        createRetrieveHandler({
                            dataRuntime,
                            retrieveService,
                            treeProvider,
                            vscode,
                        })
                    );

                    if (typeof vscode.window?.createTreeView === 'function') {
                        const treeView = vscode.window.createTreeView(TREE_VIEW_ID, {
                            treeDataProvider: treeProvider,
                        });
                        treeProvider.setTreeView(treeView);
                        context.addDisposable(treeView);
                    } else if (typeof vscode.window?.registerTreeDataProvider === 'function') {
                        context.addDisposable(
                            vscode.window.registerTreeDataProvider(TREE_VIEW_ID, treeProvider)
                        );
                    }

                    const removeStatusListener = connectionRuntime.addStatusChangeListener(() => {
                        void treeProvider.refreshType();
                    });
                    context.addDisposable({
                        dispose() {
                            removeStatusListener();
                        },
                    });
                }
            );
        }
    );
}
