import { buildSalesforceExtensionConfig } from '../core/extensionManifest';
import {
    registerCommand,
    registerSalesforceExtension,
    type VscodeBundle,
} from '../core/extensionRegistration';
import type { RegisterContext } from '../../orchestration/extensionRegistryRuntime';
import { resolveCoreServices, type CoreServices } from '../core/coreServices';
import { registerTraceFlagsAndLogs } from '../metadata/commands/traceFlagsAndLogs';
import { registerSalesforceLogsPanelProvider } from './salesforceLogsPanel';

const SVG_MIME_TYPE = 'image/svg+xml';
const LOGS_PANEL_ICON_PATH = '/workspace/vscode/salesforce-logs-panel-icon.svg';
const OPEN_LOGS_PANEL_COMMAND = 'salesforceMetadata.logs.openPanel';

const LOGS_INLINE_ASSETS = [
    {
        targetPath: LOGS_PANEL_ICON_PATH,
        mimeType: SVG_MIME_TYPE,
        content: `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
  <path fill="#000" d="M11 2a4 4 0 0 0-3.87 3H6a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3V8a3 3 0 0 0-3-3h-1.13A4 4 0 0 0 13 2h-2zm0 2h2a2 2 0 0 1 2 2H9a2 2 0 0 1 2-2zM7 11h10v2H7v-2zm0 4h7v2H7v-2z"/>
</svg>`,
    },
];

function buildLogsExtensionConfig() {
    return buildSalesforceExtensionConfig({
        name: 'sf-logs',
        displayName: 'Salesforce Debug Logs & Trace Flags (Workbench)',
        description:
            'Manage Salesforce TraceFlag and DebugLevel records, browse recent ApexLogs, and auto-collect new debug logs.',
        contributes: {
            viewsContainers: {
                activitybar: [
                    {
                        id: 'salesforceLogsPanel',
                        title: 'Salesforce Logs',
                        icon: LOGS_PANEL_ICON_PATH,
                    },
                ],
            },
            views: {
                salesforceLogsPanel: [
                    {
                        id: 'salesforceMetadata.salesforceLogsPanel',
                        name: 'Salesforce Logs',
                        type: 'webview',
                    },
                ],
            },
            commands: [
                {
                    command: 'salesforceMetadata.traceFlags.open',
                    title: 'Salesforce Logs: Open Trace Flags',
                },
                {
                    command: 'salesforceMetadata.traceFlags.createForCurrentUser',
                    title: 'Salesforce Logs: Create Trace Flag for Current User',
                },
                {
                    command: 'salesforceMetadata.traceFlags.deleteForCurrentUser',
                    title: 'Salesforce Logs: Delete Trace Flag for Current User',
                },
                {
                    command: 'salesforceMetadata.traceFlags.createForUser',
                    title: 'Salesforce Logs: Create Trace Flag for User…',
                },
                {
                    command: 'salesforceMetadata.traceFlags.createLogLevel',
                    title: 'Salesforce Logs: Create Debug Level',
                },
                {
                    command: 'salesforceMetadata.traceFlags.deleteForId',
                    title: 'Salesforce Logs: Delete Trace Flag by Id',
                },
                {
                    command: 'salesforceMetadata.traceFlags.changeDebugLevel',
                    title: 'Salesforce Logs: Change Trace Flag Debug Level',
                },
                {
                    command: 'salesforceMetadata.traceFlags.deleteDebugLevelForId',
                    title: 'Salesforce Logs: Delete Debug Level by Id',
                },
                {
                    command: 'salesforceMetadata.logs.autoCollect.start',
                    title: 'Salesforce Logs: Start Auto-Collect',
                },
                {
                    command: 'salesforceMetadata.logs.autoCollect.stop',
                    title: 'Salesforce Logs: Stop Auto-Collect',
                },
                {
                    command: OPEN_LOGS_PANEL_COMMAND,
                    title: 'Salesforce Logs: Open Panel',
                },
            ],
            menus: {
                commandPalette: [
                    { command: 'salesforceMetadata.traceFlags.open' },
                    { command: 'salesforceMetadata.traceFlags.createForCurrentUser' },
                    { command: 'salesforceMetadata.traceFlags.deleteForCurrentUser' },
                    { command: 'salesforceMetadata.traceFlags.createForUser' },
                    { command: 'salesforceMetadata.traceFlags.createLogLevel' },
                    { command: 'salesforceMetadata.logs.autoCollect.start' },
                    { command: 'salesforceMetadata.logs.autoCollect.stop' },
                    { command: OPEN_LOGS_PANEL_COMMAND },
                    // CodeLens-only targets: hide from the palette.
                    { command: 'salesforceMetadata.traceFlags.deleteForId', when: 'false' },
                    { command: 'salesforceMetadata.traceFlags.changeDebugLevel', when: 'false' },
                    {
                        command: 'salesforceMetadata.traceFlags.deleteDebugLevelForId',
                        when: 'false',
                    },
                ],
            },
        },
    });
}

export async function register(
    vscodeBundle: VscodeBundle,
    { coreServices }: { coreServices?: CoreServices } & RegisterContext = {}
) {
    return registerSalesforceExtension(
        vscodeBundle,
        {
            config: buildLogsExtensionConfig(),
            inlineAssets: LOGS_INLINE_ASSETS,
        },
        async () => {
            const core = await resolveCoreServices(coreServices, vscodeBundle);
            if (!core?.connection?.runtime || !core?.workspace?.context || !core.features) {
                return;
            }
            const connectionRuntime = core.connection.runtime;
            const context = core.workspace.context;

            await core.features.activateOnce?.('salesforce-logs', async () => {
                const { services, autoCollect } = registerTraceFlagsAndLogs({
                    connectionRuntime,
                    context,
                });

                const vscode = context.vscode as {
                    commands?: {
                        registerCommand?: (
                            command: string,
                            handler: (...args: unknown[]) => unknown
                        ) => unknown;
                        executeCommand?: (command: string, ...args: unknown[]) => Promise<unknown>;
                    };
                    window?: { showInformationMessage?: (message: string) => Promise<unknown> };
                };
                registerCommand(
                    context as { addDisposable: (value: unknown) => unknown },
                    vscode,
                    OPEN_LOGS_PANEL_COMMAND,
                    async () => {
                        try {
                            await vscode.commands?.executeCommand?.(
                                'workbench.view.extension.salesforceLogsPanel'
                            );
                        } catch {
                            await vscode.window?.showInformationMessage?.(
                                'Open the Salesforce Logs view from the activity bar if it is not visible yet.'
                            );
                        }
                    }
                );

                registerSalesforceLogsPanelProvider({
                    connectionRuntime,
                    context,
                    services,
                    autoCollect,
                });
            });
        }
    );
}
