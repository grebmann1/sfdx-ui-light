/* eslint-env jest */
const path = require('path');
const { pathToFileURL } = require('url');

let constantsModule;

beforeAll(async () => {
    constantsModule = await import(pathToFileURL(path.join(__dirname, '../constants.js')).href);
});

describe('metadata onboarding walkthrough', () => {
    it('builds a walkthrough contribution with onboarding commands', () => {
        const config = constantsModule.buildMetadataExtensionConfig({
            orgContext: {
                instanceUrl: 'https://acme.my.salesforce.com',
                accessToken: 'token',
                sharedAlias: 'Acme Prod',
                organizationName: 'Acme Production',
                isSandbox: false,
            },
        });

        const walkthrough = config.contributes.walkthroughs?.[0];
        const commandIds = config.contributes.commands.map(command => command.command);

        expect(constantsModule.METADATA_WALKTHROUGH_FULL_ID).toBe(
            `salesforce.sf-metadata#${constantsModule.ONBOARDING_WALKTHROUGH_ID}`
        );
        expect(walkthrough).toMatchObject({
            id: constantsModule.ONBOARDING_WALKTHROUGH_ID,
            title: 'Salesforce Workbench Welcome',
        });
        expect(walkthrough.steps[0].description).toContain('Acme Prod');
        expect(walkthrough.steps[0].description).toContain('production org');
        expect(commandIds).toEqual(
            expect.arrayContaining([
                constantsModule.OPEN_ONBOARDING_COMMAND,
                constantsModule.OPEN_SALESFORCE_PANEL_COMMAND,
                constantsModule.OPEN_AGENT_CHAT_COMMAND,
            ])
        );
    });

    it('generates onboarding markdown content from org context', () => {
        const assets = constantsModule.buildInlineAssets({
            orgContext: {
                instanceUrl: 'https://acme--uat.sandbox.my.salesforce.com',
                accessToken: 'token',
                sharedAlias: 'Acme UAT',
                username: 'uat@example.com',
                organizationName: 'Acme UAT',
                isSandbox: true,
            },
        });

        const markdownAsset = assets.find(
            asset => asset.targetPath === constantsModule.ONBOARDING_MARKDOWN_PATH
        );

        expect(markdownAsset).toMatchObject({
            targetPath: constantsModule.ONBOARDING_MARKDOWN_PATH,
            mimeType: 'text/markdown',
        });
        expect(markdownAsset.content).toContain('Acme UAT');
        expect(markdownAsset.content).toContain('sandbox org');
        expect(markdownAsset.content).toContain('lightweight version of VS Code');
    });
});
