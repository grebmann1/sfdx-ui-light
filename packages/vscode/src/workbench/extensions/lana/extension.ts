import { buildSalesforceExtensionConfig } from '../core/extensionManifest';
import { registerSalesforceExtension, type VscodeBundle } from '../core/extensionRegistration';
import type { RegisterContext } from '../../orchestration/extensionRegistryRuntime';
import { resolveCoreServices, type CoreServices } from '../core/coreServices';
import { initialize } from './browser';
/**
 * Root path where lana's browser dist assets are served as static files.
 * Copy the contents of debug-log-analyzer/lana/dist/ to
 * packages/vscode/assets/libs/extensions/lana/dist/ using `npm run copy:lana-assets`.
 *
 * Files served from this path:
 *   - browser.js       (extension host entry → registered at LANA_BROWSER_ENTRY)
 *   - bundle.js        (log-viewer webview entry, referenced in BrowserLogView HTML)
 *   - log-viewer-*.js  (log-viewer chunk files imported by bundle.js)
 *   - codicon.ttf      (VS Code codicon font, referenced from the webview HTML)
 *   - index.html       (not used at runtime; kept for reference)
 *
 * Vite's dev server and production build serve these files as static assets because
 * the force-prevent-transform-assets plugin routes /libs/extensions/** from dist/extension/.
 */
const LANA_DIST_ROOT = '/libs/extensions/lana';

function buildLanaExtensionConfig(): Record<string, unknown> {
    const base = buildSalesforceExtensionConfig({
        name: 'lana',
        displayName: 'Apex Log Analyzer',
        description: 'Salesforce Apex Debug Log Analyzer — visualize and debug Apex logs with interactive flame charts, dynamic call trees, and detailed SOQL/DML breakdowns.',
        contributes: {
            commands: [
                {
                    command: 'lana.showLogAnalysis',
                    title: 'Log: Show Apex Log Analysis',
                },
                {
                    command: 'lana.switchTimelineTheme',
                    title: 'Log: Timeline Theme',
                },
            ],
            languages: [
                {
                    id: 'apexlog',
                    aliases: ['ApexLog', 'DebugLog'],
                    extensions: [],
                },
            ],
            menus: {
                commandPalette: [
                    {
                        command: 'lana.showLogAnalysis',
                        when: "resourceLangId == 'apexlog' || lana.isApexLog",
                    },
                ],
                'editor/context': [
                    {
                        command: 'lana.showLogAnalysis',
                        when: "resourceLangId == 'apexlog' || lana.isApexLog",
                    },
                ],
                'editor/title/run': [
                    {
                        command: 'lana.showLogAnalysis',
                        when: "resourceLangId == 'apexlog' || lana.isApexLog",
                        group: 'lana',
                    },
                ],
                'explorer/context': [
                    {
                        command: 'lana.showLogAnalysis',
                        when: "resourceLangId == 'apexlog' || lana.isApexLog",
                    },
                ],
            },
            configuration: {
                type: 'object',
                title: 'Apex Log Analyzer',
                properties: {
                    'lana.timeline.activeTheme': {
                        type: 'string',
                        default: '50 Shades of Green',
                        markdownDescription:
                            "Select a timeline theme or enter the name of a custom theme defined in `#lana.timeline.customThemes#`",
                        order: 0,
                        anyOf: [
                            {
                                enum: [
                                    '50 Shades of Green',
                                    '50 Shades of Green Bright',
                                    'Botanical Twilight',
                                    'Catppuccin',
                                    'Chrome',
                                    'Dracula',
                                    'Dusty Aurora',
                                    'Firefox',
                                    'Flame',
                                    'Forest Floor',
                                    'Garish',
                                    'Material',
                                    'Modern',
                                    'Monokai Pro',
                                    'Nord',
                                    'Nord Forest',
                                    'Okabe-Ito',
                                    'Salesforce',
                                    'Solarized',
                                ],
                            },
                            { type: 'string' },
                        ],
                    },
                    'lana.timeline.customThemes': {
                        type: 'object',
                        title: 'Custom Timeline themes',
                        description:
                            'Define custom themes. Keys are theme names, values are theme definitions.',
                        order: 1,
                        default: {
                            Custom: {
                                apex: '#2B8F81',
                                codeUnit: '#88AE58',
                                system: '#8D6E63',
                                automation: '#51A16E',
                                dml: '#B06868',
                                soql: '#6D4C7D',
                                callout: '#CCA033',
                                validation: '#5C8FA6',
                            },
                        },
                    },
                    'lana.timeline.legacy': {
                        title: 'Enable/ disable the legacy timeline.',
                        type: 'boolean',
                        default: false,
                        order: 2,
                    },
                },
            },
        },
    });

    // The browser field instructs @codingame/monaco-vscode-api's extension host to load
    // this module path and call its exported activate(context) function automatically.
    // The path is mapped to the actual browser.js blob URL via registerFileUrl (see remoteAssets).
    return { ...base };
}

export async function register(
    vscodeBundle: VscodeBundle,
    { coreServices }: { coreServices?: CoreServices } = {}
): Promise<{ dispose(): void }> {
    return registerSalesforceExtension(
        vscodeBundle,
        {
            config: buildLanaExtensionConfig(),
            remoteAssets: [
            // Webview assets referenced by BrowserLogView's inline HTML template.
            // LANA_DIST_ROOT must match BrowserLogView.LANA_BROWSER_ASSETS_ROOT in lana.
            {
                sourcePath: `${LANA_DIST_ROOT}/bundle.js`,
                targetPath: `${LANA_DIST_ROOT}/bundle.js`,
                mimeType: 'application/javascript',
            },
            {
                sourcePath: `${LANA_DIST_ROOT}/codicon.ttf`,
                targetPath: `${LANA_DIST_ROOT}/codicon.ttf`,
                mimeType: 'font/ttf',
            },
            ],
        },
        async (vscode, { push, vscodeBundle }) => {

            const core = await resolveCoreServices(coreServices, vscodeBundle);
            if (
                !core?.workspace?.context
            ) {
                return;
            }
            const workspaceContext = core.workspace.context;
            const extension = vscodeBundle?.vscode?.extensions?.getExtension?.(
                'salesforce.lana'
            );

            const { activate, context, deactivate } = initialize(vscode);
            
            try {
                activate({
                    ...workspaceContext,
                    extension,
                });
                push(context);
            } catch (e) {
                // eslint-disable-next-line no-console
                console.warn('[debug-log-analyzer] Extension activation failed:', e);
            }

            push({
                dispose: () => {
                    deactivate();
                },
            })
        }
    );
}
