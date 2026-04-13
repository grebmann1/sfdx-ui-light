import { registerCommand, registerSalesforceExtension } from '../core/extensionRegistration';
import { resolveCoreServices, type CoreServices } from '../core/coreServices';
import { createMetadataRetrieveRuntime } from '../metadata/runtime/metadataRetrieveRuntime';

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

export async function register(
    vscodeBundle,
    { coreServices }: { coreServices?: CoreServices } = {}
) {
    return registerSalesforceExtension(
        vscodeBundle,
        {
            config: buildOrgBrowserExtensionConfig(),
            inlineAssets: ORG_BROWSER_INLINE_ASSETS,
        },
        async vscode => {
            const vscodeApi = vscode as any;
            const core = await resolveCoreServices(coreServices, vscodeBundle);
            if (
                !core?.connection?.runtime ||
                !core?.workspace?.context ||
                !core?.operations?.deployTools ||
                !core.features ||
                !vscodeApi
            ) {
                return;
            }

            await core.features.activateOnce?.('salesforce-org-browser', async () => {
                const connectionRuntime = core.connection?.runtime;
                const context = core.workspace?.context;
                const deployTools = core.operations?.deployTools;
                if (!connectionRuntime || !context || !deployTools) {
                    return;
                }
                const metadataRetrieveRuntime = createMetadataRetrieveRuntime({
                    connectionRuntime,
                    state: context.state,
                    updateSourceTrackingForPaths: deployTools.updateSourceTrackingForPaths,
                    vscode: vscodeApi,
                });
                const dataRuntime = createOrgBrowserDataRuntime({
                    connectionRuntime,
                    metadataRetrieveRuntime,
                    state: context.state,
                    vscode: vscodeApi,
                });
                const retrieveService = createOrgBrowserRetrieveService({
                    connectionRuntime,
                    metadataRetrieveRuntime,
                    vscode: vscodeApi,
                });
                const treeProvider = new MetadataTypeTreeProvider(
                    connectionRuntime,
                    dataRuntime,
                    vscodeApi
                );
                context.addDisposable(treeProvider);

                registerCommand(context, vscodeApi, OPEN_VIEW_COMMAND, async () => {
                    await openOrgBrowserView(vscodeApi);
                });
                registerCommand(context, vscodeApi, REFRESH_TYPE_COMMAND, async node => {
                    await treeProvider.refreshType(node as any);
                });
                registerCommand(context, vscodeApi, COLLAPSE_ALL_COMMAND, async () => {
                    try {
                        await vscodeApi.commands.executeCommand(
                            `workbench.actions.treeView.${TREE_VIEW_ID}.collapseAll`
                        );
                    } catch {
                        // ignore
                    }
                });
                registerCommand(
                    context,
                    vscodeApi,
                    RETRIEVE_METADATA_COMMAND,
                    createRetrieveHandler({
                        dataRuntime,
                        retrieveService,
                        treeProvider,
                        vscode: vscodeApi,
                    })
                );

                if (typeof vscodeApi.window?.createTreeView === 'function') {
                    const treeView = vscodeApi.window.createTreeView(TREE_VIEW_ID, {
                        treeDataProvider: treeProvider,
                    });
                    treeProvider.setTreeView(treeView);
                    context.addDisposable(treeView);
                } else if (typeof vscodeApi.window?.registerTreeDataProvider === 'function') {
                    context.addDisposable(
                        vscodeApi.window.registerTreeDataProvider(TREE_VIEW_ID, treeProvider)
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
            });
        }
    );
}
