const express =  require("express");
const handler = require('serve-handler');
const serveJson = require('../../site/serve.json');
const jsforce = require('jsforce');
const jsforceAjaxProxy = require("jsforce-ajax-proxy");
const qs = require('qs');

const app = express();
const PORT = parseInt(process.env.PORT || "3000", 10);


getOAuth2Instance = (params) => {
  return new jsforce.OAuth2({
      // you can change loginUrl to connect to sandbox or prerelease env.
      clientId : '3MVG9_kZcLde7U5oNdaqndT3T9qa54eaA.ycC6APuOkYzRP286pPeOvwOqAQ2ue7l5ejNAxPYj4xTbWn3zS6Y',
      clientSecret : process.env.CLIENT_SECRET,
      redirectUri : params.redirectUri,
      loginUrl : params.loginUrl
  });
}

app.all("/proxy/?*", jsforceAjaxProxy({ enableCORS: true }));
app.get("/*", (req, res) => handler(req, res, {public: "site",...serveJson}));
app.listen(PORT, () => {
    
    console.log(`✅ App running in PROD mode ${PORT}`);
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
  console.log('Running at http://localhost:3000');
});*/