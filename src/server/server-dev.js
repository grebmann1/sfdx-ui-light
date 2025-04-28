require('dotenv').config();
//const express = require('express');
const fs = require('node:fs');

const timeout = require('connect-timeout');
const jsforce = require('jsforce');
const jwt = require('jsonwebtoken');
const { createServer } = require('lwr');
//const jsforceAjaxProxy = require("jsforce-ajax-proxy");
const qs = require('qs');

const CTA_MODULE = require('./modules/cta.js');
const proxy = require('./modules/proxy.js');

/** Documentation Temporary Code until a DB is incorporated **/
const VERSION = process.env.DOC_VERSION || '252.0';
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
app.use(timeout(295000)); // Related to Heroku 30s timeout
app.use(haltOnTimedout);

function haltOnTimedout(req, res, next) {
    if (!req.timedout) next();
}
/* CometD Proxy */
app.all('/cometd/*', proxy({ enableCORS: true }));
/* jsForce Proxy */
app.all('/proxy/*', proxy({ enableCORS: true }));

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
app.get('/documentation/search', function (req, res) {
    const keywords = req.query.keywords || '';
    const filters = req.query.filters;
    const mappedResult = { first: [], middle: [], last: [] };
    DATA_DOCUMENTATION.contents
        .filter(x => filters.includes(x.documentationId))
        .forEach(x => {
            const _title = (x.title || '').toLowerCase();
            if (_title.startsWith(keywords.toLowerCase())) {
                mappedResult.first.push(x);
            } else if (_title.includes(keywords.toLowerCase())) {
                mappedResult.middle.push(x);
            } else if (this.checkIfPresent(x.content, keywords)) {
                mappedResult.last.push(x);
            }
        });
    const result = Object.values(mappedResult)
        .flat()
        .map(x => ({
            name: x.id,
            text: x.title,
            id: x.id,
            documentationId: x.documentationId,
        }));
    res.json(result);
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
    console.log('callback', code, states, params);
    console.log('params', getOAuth2Instance(params));

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
        console.log('jwtToken', jwtToken);

        res.json({ jwtToken: jwtToken });
    } catch (error) {
        console.log('error', error);
        res.status(401).json({ error: 'Invalid Salesforce Access Token.' });
    }
});

/** LWR Server **/

lwrServer
    .listen(({ port, serverMode }) => {
        //console.log(`✅ App listening on port ${port} in ${serverMode} mode!`);
        //console.log(`Url http://localhost:${port}`);
    })
    .catch(err => {
        console.error(err);
        //process.exit(1);
    });
