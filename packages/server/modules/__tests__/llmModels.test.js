/* eslint-env jest */
const path = require('path');
const llmModelsModule = require(path.join(__dirname, '../../dist/modules/llmModels.js'));

describe('llmModels catalog helpers', () => {
    it('returns the curated OpenAI catalog for direct OpenAI endpoints', async () => {
        const catalog = await llmModelsModule.__testables.getOpenAiCatalog({
            apiKey: 'sk-openai',
            baseUrl: 'https://api.openai.com/v1',
        });

        expect(catalog.status).toBe('ok');
        expect(catalog.models.map(model => model.value)).toEqual(
            expect.arrayContaining(['gpt-5.4', 'gpt-5.4-mini', 'gpt-5.4-nano', 'gpt-5.3-codex'])
        );
        expect(catalog.defaultModel).toBe('gpt-5-mini');
    });

    it('reports missing credentials without silently pretending models are unavailable', async () => {
        const catalogs = await llmModelsModule.__testables.buildCatalogs(
            llmModelsModule.__testables.normalizeProviderConfigMap({
                openai: { apiKey: '', baseUrl: 'https://api.openai.com/v1' },
            })
        );

        expect(catalogs.openai.status).toBe('missing_key');
        expect(catalogs.openai.models).toHaveLength(8);
        expect(catalogs.anthropic.status).toBe('missing_key');
        expect(catalogs.anthropic.models.map(model => model.value)).toEqual([
            'claude-opus-4-6',
            'claude-sonnet-4-6',
            'claude-haiku-4-5-20251001',
        ]);
        expect(catalogs.gemini.models.map(model => model.value)).toEqual([
            'gemini-3-flash-preview',
            'gemini-3.1-flash-lite-preview',
            'gemini-3.1-pro-preview',
        ]);
        expect(catalogs.mistral.models.map(model => model.value)).toEqual([
            'mistral-small-2603',
            'mistral-large-2512',
            'devstral-2512',
            'mistral-medium-2508',
        ]);
        expect(catalogs.grok.status).toBe('missing_key');
        expect(catalogs.grok.models.map(model => model.value)).toEqual([
            'grok-4.20-0309-reasoning',
            'grok-4.20-multi-agent-0309',
            'grok-4-1-fast-reasoning',
        ]);
    });
});
