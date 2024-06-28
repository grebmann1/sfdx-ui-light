require('dotenv').config()
const { createServer } =  require("lwr");
const jsforceAjaxProxy = require("jsforce-ajax-proxy");
const jsforce = require('jsforce');
const qs = require('qs');
const fs = require('node:fs');
const httpProxy = require('http-proxy');
const proxy = httpProxy.createProxyServer({});



const CTA_MODULE = require('./modules/cta.js');

/** Documentation Temporary Code until a DB is incorporated **/
const VERSION = process.env.DOC_VERSION || '248.0';
const DATA_DOCUMENTATION = JSON.parse(fs.readFileSync(`./src/documentation/${VERSION}.json`, 'utf-8'));


/** CTA Documentation **/
var DATA_CTA = [];
CTA_MODULE.launchScheduleFileDownloaded((files) => {
    DATA_CTA = files;
});
//console.log('DATA_CTA.contents',DATA_CTA);


const PORT = parseInt(process.env.PORT || "3000", 10);
const SERVER_MODE = "development" === process.env.NODE_ENV ? "dev" : "prod";
const CHROME_ID = process.env.CHROME_ID || 'dmlgjapbfifmeopbfikbdmlgdcgcdmfb';


getOAuth2Instance = (params) => {
    return new jsforce.OAuth2({
        // you can change loginUrl to connect to sandbox or prerelease env.
        clientId : process.env.CLIENT_ID,
        clientSecret : process.env.CLIENT_SECRET,
        redirectUri : params.redirectUri,
        loginUrl : params.loginUrl
    });
}

checkIfPresent = (a,b) => {
    return (a || '').toLowerCase().includes((b||'').toLowerCase());
}

/** Proxy **/


const lwrServer = createServer({
    serverMode: SERVER_MODE,
    port: PORT,
});

const app = lwrServer.getInternalServer("express");

/* CometD Proxy */
app.all("/cometd/?*", jsforceAjaxProxy({ enableCORS: true }));
/* jsForce Proxy */
app.all("/proxy/?*", jsforceAjaxProxy({ enableCORS: true }));

app.get('/version',function(req,res){
    res.json({version:process.env.npm_package_version});
})
app.get('/config',function(req,res){
    res.json({
        clientId:process.env.CLIENT_ID,
        chromeId:CHROME_ID
    });
})
app.get('/documentation/search',function(req,res){
    const keywords = req.query.keywords || '';
    const filters = req.query.filters;
    const mappedResult = {first:[],middle:[],last:[]}
    DATA_DOCUMENTATION.contents.filter(x => filters.includes(x.documentationId)).forEach(x => {
        const _title = (x.title || '').toLowerCase();
        if(_title.startsWith(keywords.toLowerCase())){
            mappedResult.first.push(x);
        }else if(_title.includes(keywords.toLowerCase())){
            mappedResult.middle.push(x);
        }else if(this.checkIfPresent(x.content,keywords)){
            mappedResult.last.push(x);
        }
    })
    const result = Object.values(mappedResult).flat().map(x => ({
        name:x.id,
        text:x.title,
        id:x.id,
        documentationId:x.documentationId
    }));
    res.json(result);
})
app.get('/cta/search',function(req,res){
    //console.log('DATA_CTA.contents',DATA_CTA);
    const keywords = req.query.keywords;
    const result = DATA_CTA.filter(x => this.checkIfPresent(x.title,keywords) || this.checkIfPresent(x.content,keywords)).map(x => ({
        url:x.link,
        content:x.content
    }));
    res.json(result);
})
app.get('/oauth2/callback', function(req, res) {
    var code = req.query.code;
    var states = req.query.state.split('#');
    var params = qs.parse(states[1]);

    var conn = new jsforce.Connection({ oauth2 : getOAuth2Instance(params) });
    
    conn.authorize(code, function(err, userInfo) {
      if (err) { return console.error(err); }
      res.redirect(`/callback#${qs.stringify({ 
            access_token:   conn.accessToken, 
            instance_url:   conn.instanceUrl,
            refresh_token:  conn.refreshToken,
            issued_at: Date.now(),
            id: userInfo.url,
            state:states[0]
        })}`);
    });
});

app.get('/chrome/callback', function(req, res) {
    var code = req.query.code;
    var states = req.query.state.split('#');
    var params = qs.parse(states[1]);

    var conn = new jsforce.Connection({ oauth2 : getOAuth2Instance(params) });
    
    conn.authorize(code, function(err, userInfo) {
      if (err) { return console.error(err); }
      res.redirect(`chrome-extension://${CHROME_ID}/callback.html#${qs.stringify({ 
            access_token:   conn.accessToken, 
            instance_url:   conn.instanceUrl,
            refresh_token:  conn.refreshToken,
            issued_at: Date.now(),
            id: userInfo.url,
            state:states[0]
        })}`);
    });
});



/** LWR Server **/

lwrServer
.listen(( { port, serverMode }) => {
    console.log(`✅ App listening on port ${port} in ${serverMode} mode!`);
    console.log(`Url http://localhost:${port}`);
})
.catch((err) => {
    console.error(err);
    //process.exit(1);
});