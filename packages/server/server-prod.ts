import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';

import express from 'express';
import jsforce from 'jsforce';
import qs from 'qs';
import handler from 'serve-handler';

import { launchScheduleFileDownloaded } from './modules/cta';
import { initDocumentationIndex, searchDocumentation } from './modules/documentationSearch';
import llmModels from './modules/llmModels';
import openaiProxy from './modules/openaiProxy';
import proxy from './modules/proxy';

dotenv.config();

let serveJson = {};
try {
    // eslint-disable-next-line global-require
    serveJson = require('../../dist/web/serve.json');
} catch (_error) {
    serveJson = {};
}

/** Temporary Code until a DB is incorporated **/
const VERSION = process.env.DOC_VERSION || '260.0';
const DATA_DOCUMENTATION = JSON.parse(
    fs.readFileSync(`./assets/data/salesforce/${VERSION}.json`, 'utf-8')
);

/** CTA Documentation **/
let DATA_CTA = [];
launchScheduleFileDownloaded(files => {
    DATA_CTA = files;
});
//console.log('DATA_CTA.contents',DATA_CTA);

// Initialize documentation search index
initDocumentationIndex(DATA_DOCUMENTATION.contents);

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb' }));
const PORT = parseInt(process.env.PORT || '3000', 10);
const CHROME_ID = process.env.CHROME_ID || 'dncmipbpdapfjancbhmbodlhllapmagf';
const UI_DIST_DIR = path.resolve(process.cwd(), 'dist/ui');
const DOCS_DIST_DIR = path.resolve(process.cwd(), 'dist/docs');
const hasDocsSite = fs.existsSync(path.join(DOCS_DIST_DIR, 'index.html'));

const getQueryStringValue = (value: unknown): string => {
    if (Array.isArray(value)) {
        return typeof value[0] === 'string' ? value[0] : '';
    }
    return typeof value === 'string' ? value : '';
};

const getOAuth2Instance = params => {
    return new jsforce.OAuth2({
        // you can change loginUrl to connect to sandbox or prerelease env.
        clientId: process.env.CLIENT_ID,
        clientSecret: process.env.CLIENT_SECRET,
        redirectUri: params.redirectUri,
        loginUrl: params.loginUrl,
    });
};

const checkIfPresent = (a, b) => {
    return (a || '').toLowerCase().includes((b || '').toLowerCase());
};

if (hasDocsSite) {
    app.use('/docs', express.static(DOCS_DIST_DIR));
    app.get('/docs', (_req, res) => {
        res.redirect('/docs/');
    });
}

app.use('/welcome/ui-assets', express.static(path.join(UI_DIST_DIR, 'ui-assets')));
app.get('/welcome{/*splat}', (_req, res) => {
    res.sendFile(path.join(UI_DIST_DIR, 'index.html'));
});

/* CometD Proxy */
app.all('/cometd{/*splat}', proxy({ enableCORS: true }));
/* jsForce Proxy */
app.all('/proxy{/*splat}', proxy({ enableCORS: true }));
/* OpenAI Proxy */
openaiProxy(app);
llmModels(app);

app.get('/oauth2/callback', async function (req, res) {
    const code = getQueryStringValue(req.query.code);
    const stateRaw = getQueryStringValue(req.query.state);
    if (!code || !stateRaw) {
        console.log('OAuth2 callback missing code or state');
        res.redirect('/');
        return;
    }
    const states = stateRaw.split('#');
    const params = qs.parse(states[1] || '');
    const redirectUri =
        params.redirectUri ||
        `${req.protocol}://${req.get('host') || req.hostname}/oauth2/callback`;
    const loginUrl = params.loginUrl || 'https://login.salesforce.com';
    const oauthParams = { ...params, redirectUri, loginUrl };

    try {
        const conn = new jsforce.Connection({ oauth2: getOAuth2Instance(oauthParams) });
        const userInfo = await conn.authorize(code);
        res.redirect(
            `/callback#${qs.stringify({
                access_token: conn.accessToken,
                instance_url: conn.instanceUrl,
                refresh_token: conn.refreshToken,
                issued_at: Date.now(),
                id: userInfo.url,
                state: states[0],
            })}`
        );
    } catch (e) {
        console.log('Error', e);
        res.redirect('/');
    }
});

app.get('/chrome/callback', async function (req, res) {
    const code = getQueryStringValue(req.query.code);
    const stateRaw = getQueryStringValue(req.query.state);
    const states = stateRaw.split('#');
    var params = qs.parse(states[1]);

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
        console.log('Error', e);
        res.redirect('/');
    }
});

app.get('/config', function (req, res) {
    res.json({
        clientId: process.env.CLIENT_ID,
        chromeId: CHROME_ID,
        proxyUrl: process.env.PROXY_URL,
    });
});
app.get('/version', function (req, res) {
    res.json({ version: process.env.npm_package_version });
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
app.get('/cta/search', function (req, res) {
    //console.log('DATA_CTA.contents',DATA_CTA);
    const keywords = req.query.keywords;
    const result = DATA_CTA.filter(
        x => checkIfPresent(x.title, keywords) || checkIfPresent(x.content, keywords)
    ).map(x => ({
        url: x.link,
        content: x.content,
    }));
    res.json(result);
});

app.get('{/*splat}', (req, res) => handler(req, res, { public: 'dist/web', ...serveJson }));

app.listen(PORT, () => {
    console.log(`✅ App running in PROD mode ${PORT}`);
});

/*
const handler = require('serve-handler');
const http = require('http');

const server = http.createServer((request, response) => {
  // You pass two more arguments for config and middleware
  // More details here: https://github.com/vercel/serve-handler#options
  return handler(request, response,{
    "public": "site",
    ...serveJson
  });
});

server.listen(3000, () => {
  //console.log('Running at http://localhost:3000');
});*/
