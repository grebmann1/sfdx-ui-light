import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
    tutorialSidebar: [
        'intro',
        {
            type: 'category',
            label: 'Getting Started',
            items: ['getting-started/installation', 'getting-started/quickstart'],
        },
        {
            type: 'category',
            label: 'Architecture',
            items: ['architecture/overview'],
        },
        {
            type: 'category',
            label: 'Workflows',
            items: ['workflows/common-tasks'],
        },
        {
            type: 'category',
            label: 'VS Code',
            items: ['vscode/overview'],
        },
        {
            type: 'category',
            label: 'CLI',
            items: ['cli/overview'],
        },
        {
            type: 'category',
            label: 'AI Agent',
            items: ['ai-agent/setup', 'ai-agent/tools-overview'],
        },
        {
            type: 'category',
            label: 'Local Storage',
            items: ['storage/indexeddb-workspace'],
        },
        {
            type: 'category',
            label: 'Troubleshooting',
            items: ['troubleshooting/common-issues'],
        },
        {
            type: 'category',
            label: 'Security',
            items: ['security/local-data-and-privacy'],
        },
        {
            type: 'category',
            label: 'Contributing',
            items: ['contributing/how-to-contribute', 'contributing/reporting-issues'],
        },
    ],
};

export default sidebars;
