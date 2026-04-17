import { buildSalesforceExtensionConfig } from '../core/extensionManifest';
import { registerSalesforceExtension, type VscodeBundle } from '../core/extensionRegistration';
import type { RegisterContext } from '../../orchestration/extensionRegistryRuntime';
import { resolveCoreServices, type CoreServices } from '../core/coreServices';
import { registerTraceFlagsAndLogs } from '../metadata/commands/traceFlagsAndLogs';

function buildLogsExtensionConfig() {
    return buildSalesforceExtensionConfig({
        name: 'sf-logs',
        displayName: 'Salesforce Debug Logs & Trace Flags (Workbench)',
        description:
            'Manage Salesforce TraceFlag and DebugLevel records, browse recent ApexLogs, and auto-collect new debug logs.',
        contributes: {
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
        { config: buildLogsExtensionConfig() },
        async () => {
            const core = await resolveCoreServices(coreServices, vscodeBundle);
            if (!core?.connection?.runtime || !core?.workspace?.context || !core.features) {
                return;
            }
            const connectionRuntime = core.connection.runtime;
            const context = core.workspace.context;

            await core.features.activateOnce?.('salesforce-logs', async () => {
                registerTraceFlagsAndLogs({ connectionRuntime, context });
            });
        }
    );
}
