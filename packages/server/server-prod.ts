import dotenv from 'dotenv';
import fs from 'node:fs';

import express from 'express';
import jsforce from 'jsforce';
import qs from 'qs';

import { initDocumentationIndex, searchDocumentation } from './modules/documentationSearch';
import googleAuth from './modules/googleAuth';
import llmModels from './modules/llmModels';
import openaiProxy from './modules/openaiProxy';
import proxy from './modules/proxy';

dotenv.config({ path: '.env.prod' });

/** Documentation index **/
const VERSION = process.env.DOC_VERSION || '260.0';
const DATA_DOCUMENTATION = JSON.parse(
    fs.readFileSync(`./assets/data/salesforce/${VERSION}.json`, 'utf-8')
);
initDocumentationIndex(DATA_DOCUMENTATION.contents);

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const PORT = parseInt(process.env.PORT || '3000', 10);
const CHROME_ID = process.env.CHROME_ID || 'dncmipbpdapfjancbhmbodlhllapmagf';

const getQueryStringValue = (value: unknown): string => {
    if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : '';
    return typeof value === 'string' ? value : '';
};

const getOAuth2Instance = params => {
    return new jsforce.OAuth2({
        clientId: process.env.CLIENT_ID,
        clientSecret: process.env.CLIENT_SECRET,
        redirectUri: params.redirectUri,
        loginUrl: params.loginUrl,
    });
};

/* CometD Proxy */
app.all('/cometd{/*splat}', proxy({ enableCORS: true }));
/* jsForce Proxy */
app.all('/proxy{/*splat}', proxy({ enableCORS: true }));
/* Google Auth */
googleAuth(app);
/* OpenAI Proxy */
openaiProxy(app);
llmModels(app);

app.get('/version', (_req, res) => {
    res.json({ version: process.env.npm_package_version });
});
app.get('/config', (_req, res) => {
    res.json({
        clientId: process.env.CLIENT_ID,
        chromeId: CHROME_ID,
        googleClientId: process.env.GOOGLE_CLIENT_ID_WEB || null,
    });
});
app.get('/documentation/search', async (req, res) => {
    const keywords = getQueryStringValue(req.query.keywords);
    const isFullTextSearch = getQueryStringValue(req.query.isFullTextSearch) === 'true';
    let filters: string[] = [];
    const rawFilters = req.query.filters;
    if (typeof rawFilters === 'string') {
        try {
            const parsed = JSON.parse(rawFilters);
            filters = Array.isArray(parsed) ? parsed : [String(parsed)];
        } catch {
            filters = [rawFilters];
        }
    } else if (Array.isArray(rawFilters)) {
        filters = rawFilters.filter((value): value is string => typeof value === 'string');
    }
    try {
        const results = await searchDocumentation({ keywords, filters });
        const mappedResults = results.map(({ id, title, doc }) => ({
            id,
            name: isFullTextSearch ? doc.title : title,
            text: isFullTextSearch ? doc.content : doc.title,
            documentationId: doc.documentationId,
        }));
        res.json(mappedResults);
    } catch (error) {
        console.error('Error searching documentation:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

/* Chrome extension Salesforce OAuth callback — exchanges code and redirects back to extension */
app.get('/chrome/callback', async (req, res) => {
    const code = getQueryStringValue(req.query.code);
    const stateRaw = getQueryStringValue(req.query.state);
    if (!code || !stateRaw) {
        return res.status(400).send('Missing code or state');
    }
    const states = stateRaw.split('#');
    const params = qs.parse(states[1] || '');
    try {
        const conn = new jsforce.Connection({ oauth2: getOAuth2Instance(params) });
        const userInfo = await conn.authorize(code);
        res.redirect(
            `chrome-extension://${CHROME_ID}/callback.html#${qs.stringify({
                access_token: conn.accessToken,
                instance_url: conn.instanceUrl,
                refresh_token: conn.refreshToken,
                issued_at: Date.now(),
                id: userInfo.url,
                state: states[0],
            })}`
        );
    } catch (e) {
        console.error('[chrome/callback]', e);
        res.status(500).send('OAuth exchange failed');
    }
});

app.listen(PORT, () => {
    console.log(`✅ Server listening on port ${PORT}`);
    console.log(`   http://localhost:${PORT}`);
});
