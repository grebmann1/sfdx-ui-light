import { themes as prismThemes } from 'prism-react-renderer';
import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
    title: 'Workbench Docs',
    tagline: 'Documentation for Workbench web app, extension, and workflows.',
    url: 'https://sf-toolkit.com',
    baseUrl: process.env.DOCS_BASE_PATH || '/docs/',
    onBrokenLinks: 'warn',
    onBrokenMarkdownLinks: 'warn',
    i18n: {
        defaultLocale: 'en',
        locales: ['en'],
    },
    presets: [
        [
            'classic',
            {
                docs: {
                    routeBasePath: '/',
                    sidebarPath: './sidebars.ts',
                    editUrl: undefined,
                },
                blog: false,
                pages: false,
                theme: {
                    customCss: './src/css/custom.css',
                },
            } satisfies Preset.Options,
        ],
    ],
    themeConfig: {
        navbar: {
            title: 'Workbench Docs',
            items: [
                {
                    type: 'docSidebar',
                    sidebarId: 'userSidebar',
                    position: 'left',
                    label: 'User Guide',
                },
                {
                    type: 'docSidebar',
                    sidebarId: 'developerSidebar',
                    position: 'left',
                    label: 'Developer',
                },
                {
                    href: 'https://sf-toolkit.com',
                    label: 'Website',
                    position: 'right',
                },
                {
                    href: 'https://app.sf-toolkit.com',
                    label: 'Open App',
                    position: 'right',
                },
            ],
        },
        footer: {
            style: 'dark',
            links: [
                {
                    title: 'User Guide',
                    items: [
                        { label: 'Installation', to: '/getting-started/installation' },
                        { label: 'Quickstart', to: '/getting-started/quickstart' },
                        { label: 'AI Agent', to: '/ai-agent/setup' },
                        { label: 'Security', to: '/security/local-data-and-privacy' },
                        { label: 'Troubleshooting', to: '/troubleshooting/common-issues' },
                    ],
                },
                {
                    title: 'Developer',
                    items: [
                        { label: 'Architecture', to: '/architecture/overview' },
                        { label: 'VS Code', to: '/vscode/overview' },
                        { label: 'Local Storage', to: '/storage/indexeddb-workspace' },
                        { label: 'Contributing', to: '/contributing/how-to-contribute' },
                    ],
                },
                {
                    title: 'Product',
                    items: [
                        { label: 'Website', href: 'https://sf-toolkit.com' },
                        { label: 'Application', href: 'https://app.sf-toolkit.com' },
                        { label: 'Chrome Extension', href: 'https://chromewebstore.google.com/detail/salesforce-toolkit/konbmllgicfccombdckckakhnmejjoei?hl=en' },
                        { label: 'GitHub', href: 'https://github.com/grebmann1/sfdx-ui-light' },
                    ],
                },
            ],
            copyright: `Copyright ${new Date().getFullYear()} Workbench`,
        },
        prism: {
            theme: prismThemes.github,
            darkTheme: prismThemes.dracula,
            additionalLanguages: ['bash', 'json', 'typescript'],
        },
    } satisfies Preset.ThemeConfig,
};

export default config;
