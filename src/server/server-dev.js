require('dotenv').config();
//const express = require('express');
const fs = require('node:fs');
const express = require('express');
const jsforce = require('jsforce');
const { createServer } = require('lwr');
const qs = require('qs');
const documentationSearch = require('./modules/documentationSearch');

const CTA_MODULE = require('./modules/cta.js');
const proxy = require('./modules/proxy.js');
const openaiProxy = require('./modules/openaiProxy.js');

/** Documentation Temporary Code until a DB is incorporated **/
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
console.log('process.env.PORT', process.env.PORT);
const PORT = parseInt(process.env.PORT || '3000', 10);
const SERVER_MODE = 'development' === process.env.NODE_ENV ? 'dev' : 'prod';
const CHROME_ID = process.env.CHROME_ID || 'dmlgjapbfifmeopbfikbdmlgdcgcdmfb';

// Initialize documentation search index
//documentationSearch.initDocumentationIndex(DATA_DOCUMENTATION.contents);

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

/** Proxy **/

const lwrServer = createServer({
    serverMode: SERVER_MODE,
    port: PORT,
});

const app = lwrServer.getInternalServer('express');
app.use(express.json({limit: '50mb'}));
app.use(express.urlencoded({limit: '50mb'}));
app.use(haltOnTimedout);

function haltOnTimedout(req, res, next) {
    if (!req.timedout) next();
}
/* CometD Proxy */
app.all('/cometd/:splat(*)', proxy({ enableCORS: true }));
/* jsForce Proxy */
app.all('/proxy/:splat(*)', proxy({ enableCORS: true }));
/* OpenAI Proxy */
openaiProxy(app,{path: '/openai/v1'});

app.get('/version', function (req, res) {
    res.json({ version: process.env.npm_package_version });
});
app.get('/config', function (req, res) {
    res.json({
        clientId: process.env.CLIENT_ID,
        chromeId: CHROME_ID,
        proxyUrl: process.env.PROXY_URL, // 'https://gkheffb6gpvcv3heh7vl3ipby40cybbo.lambda-url.us-west-2.on.aws/proxy/'
    });
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
/* 
app.post('/generatejwt', async (req, res) => {
    const { accessToken, instanceUrl } = req.body;

    if (!accessToken || !instanceUrl) {
        return res.status(400).json({ error: 'Access Token and Instance URL are required.' });
    }

    const conn = new jsforce.Connection({
        accessToken: accessToken,
        instanceUrl: instanceUrl,
    });

    try {
        const identity = await conn.identity();

        // Log the secret key to ensure it's loaded (for testing, not in prod)
        //console.log('JWT_PRIVATE_KEY:', process.env.JWT_PRIVATE_KEY);

        // Generate JWT token
        const jwtToken = jwt.sign(
            {
                iss: process.env.CLIENT_ID, // replace with your OAuth client_id or connected app id
                sub: identity.username, // or identity.user_id
                aud: (instanceUrl || '').endsWith('.sandbox.my.salesforce.com')
                    ? 'https://test.salesforce.com'
                    : 'https://login.salesforce.com', // https://login.salesforce.com
                //scp: "sfap_api web einstein_gpt_api api"
            },
            process.env.JWT_PRIVATE_KEY,
            {
                expiresIn: '1h',
                algorithm: 'RS256',
            }
        );
        res.json({ jwtToken: jwtToken });
    } catch (error) {
        console.log('error', error);
        res.status(401).json({ error: 'Invalid Salesforce Access Token.' });
    }
}); */

/** LWR Server **/

lwrServer
.listen(({ port, serverMode }) => {
    console.log(`✅ App listening on port ${port} in ${serverMode} mode!`);
    console.log(`Url http://localhost:${port}`);
})
.catch(err => {
    console.error(err);
    process.exit(1);
});
