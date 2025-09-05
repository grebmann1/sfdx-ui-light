require('dotenv').config();
const fs = require('node:fs');

const express = require('express');
const jsforce = require('jsforce');
const qs = require('qs');
const handler = require('serve-handler');

const serveJson = require('../../site/serve.json');

const CTA_MODULE = require('./modules/cta.js');
const proxy = require('./modules/proxy.js');
const documentationSearch = require('./modules/documentationSearch');
const openaiProxy = require('./modules/openaiProxy.js');

/** Temporary Code until a DB is incorporated **/
const VERSION = process.env.DOC_VERSION || '255.0';
const DATA_DOCUMENTATION = JSON.parse(
    fs.readFileSync(`./src/documentation/${VERSION}.json`, 'utf-8')
);

/** CTA Documentation **/
var DATA_CTA = [];
CTA_MODULE.launchScheduleFileDownloaded(files => {
    DATA_CTA = files;
});
//console.log('DATA_CTA.contents',DATA_CTA);

// Initialize documentation search index
documentationSearch.initDocumentationIndex(DATA_DOCUMENTATION.contents);

const app = express();
app.use(express.json({limit: '50mb'}));
app.use(express.urlencoded({limit: '50mb'}));
const PORT = parseInt(process.env.PORT || '3000', 10);
const CHROME_ID = process.env.CHROME_ID || 'dmlgjapbfifmeopbfikbdmlgdcgcdmfb';

getOAuth2Instance = params => {
    return new jsforce.OAuth2({
        // you can change loginUrl to connect to sandbox or prerelease env.
        clientId: process.env.CLIENT_ID,
        clientSecret: process.env.CLIENT_SECRET,
        redirectUri: params.redirectUri,
        loginUrl: params.loginUrl,
    });
};

checkIfPresent = (a, b) => {
    return (a || '').toLowerCase().includes((b || '').toLowerCase());
};

/* CometD Proxy */
app.all('/cometd{/*splat}', proxy({ enableCORS: true }));
/* jsForce Proxy */
app.all('/proxy{/*splat}', proxy({ enableCORS: true }));
/* OpenAI Proxy */
openaiProxy(app);

app.get('/oauth2/callback', async function (req, res) {
    var code = req.query.code;
    var states = req.query.state.split('#');
    var params = qs.parse(states[1]);

    try {
        const conn = new jsforce.Connection({ oauth2: getOAuth2Instance(params) });
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
    var code = req.query.code;
    var states = req.query.state.split('#');
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
    const keywords = req.query.keywords || '';
    const isFullTextSearch = req.query.isFullTextSearch || false;
    let filters = req.query.filters;

    if (typeof filters === 'string') {
        try {
            filters = JSON.parse(filters);
        } catch {
            filters = [filters];
        }
    }

    try {
        const results = await documentationSearch.searchDocumentation({ keywords, filters });
        const mappedResults = results.map(({ id, title, doc }) => ({
            id,
            name: isFullTextSearch ? doc.title : title,
            text: isFullTextSearch ? doc.content : doc.title,
            documentationId: doc.documentationId
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
        x => this.checkIfPresent(x.title, keywords) || this.checkIfPresent(x.content, keywords)
    ).map(x => ({
        url: x.link,
        content: x.content,
    }));
    res.json(result);
});

app.get('{/*splat}', (req, res) => handler(req, res, { public: 'site', ...serveJson }));

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
