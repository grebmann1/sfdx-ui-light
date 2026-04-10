import { themes as prismThemes } from 'prism-react-renderer';
import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
    title: 'SF Toolkit Docs',
    tagline: 'Documentation for SF Toolkit web app, extension, and workflows.',
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
            title: 'SF Toolkit Docs',
            items: [
                {
                    type: 'docSidebar',
                    sidebarId: 'tutorialSidebar',
                    position: 'left',
                    label: 'Docs',
                },
                {
                    href: 'https://sf-toolkit.com/welcome',
                    label: 'Website',
                    position: 'right',
                },
                {
                    href: 'https://sf-toolkit.com/app',
                    label: 'Open App',
                    position: 'right',
                },
            ],
        },
        footer: {
            style: 'dark',
            links: [
                {
                    title: 'Docs',
                    items: [
                        { label: 'Installation', to: '/getting-started/installation' },
                        { label: 'VS Code', to: '/vscode/overview' },
                        { label: 'AI Agent Tools', to: '/ai-agent/tools-overview' },
                        { label: 'IndexedDB Workspace', to: '/storage/indexeddb-workspace' },
                        { label: 'CLI', to: '/cli/overview' },
                        { label: 'Security', to: '/security/local-data-and-privacy' },
                        { label: 'Contributing', to: '/contributing/how-to-contribute' },
                    ],
                },
                {
                    title: 'Product',
                    items: [
                        { label: 'Website', href: 'https://sf-toolkit.com/welcome' },
                        { label: 'Application', href: 'https://sf-toolkit.com/app' },
                    ],
                },
            ],
            copyright: `Copyright ${new Date().getFullYear()} SF Toolkit`,
        },
        prism: {
            theme: prismThemes.github,
            darkTheme: prismThemes.dracula,
            additionalLanguages: ['bash', 'json', 'typescript'],
        },
    } satisfies Preset.ThemeConfig,
};

export default config;
