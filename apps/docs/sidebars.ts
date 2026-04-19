import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
    userSidebar: [
        'intro',
        {
            type: 'category',
            label: 'Getting Started',
            items: ['getting-started/installation', 'getting-started/quickstart'],
        },
        {
            type: 'category',
            label: 'AI Agent',
            items: ['ai-agent/setup', 'ai-agent/tools-overview'],
        },
        {
            type: 'category',
            label: 'Security',
            items: ['security/local-data-and-privacy'],
        },
        {
            type: 'category',
            label: 'Troubleshooting',
            items: ['troubleshooting/common-issues'],
        },
    ],
    developerSidebar: [
        {
            type: 'category',
            label: 'Architecture',
            items: ['architecture/overview'],
        },
        {
            type: 'category',
            label: 'VS Code',
            items: ['vscode/overview', 'vscode/extension-parity'],
        },
        {
            type: 'category',
            label: 'Local Storage',
            items: ['storage/indexeddb-workspace'],
        },
        {
            type: 'category',
            label: 'Deployment',
            items: ['deployment/heroku'],
        },
        {
            type: 'category',
            label: 'Contributing',
            items: ['contributing/how-to-contribute', 'contributing/reporting-issues'],
        },
    ],
};

export default sidebars;
