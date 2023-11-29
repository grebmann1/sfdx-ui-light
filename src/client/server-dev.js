require('dotenv').config()
const { createServer } =  require("lwr");
const jsforceAjaxProxy = require("jsforce-ajax-proxy");
const jsforce = require('jsforce');
const qs = require('qs');


const PORT = parseInt(process.env.PORT || "3000", 10);
const SERVER_MODE = "development" === process.env.NODE_ENV ? "dev" : "prod";

getOAuth2Instance = (params) => {
    return new jsforce.OAuth2({
        // you can change loginUrl to connect to sandbox or prerelease env.
        clientId : process.env.CLIENT_ID,
        clientSecret : process.env.CLIENT_SECRET,
        redirectUri : params.redirectUri,
        loginUrl : params.loginUrl
    });
}

const lwrServer = createServer({
    serverMode: SERVER_MODE,
    port: PORT,
});

const app = lwrServer.getInternalServer("express");
app.all("/proxy/?*", jsforceAjaxProxy({ enableCORS: true }));
app.get('/config',function(req,res){
    res.json({clientId:process.env.CLIENT_ID});
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


lwrServer
.listen(( { port, serverMode }) => {
    console.log(`✅ App listening on port ${port} in ${serverMode} mode!`);
    console.log(`Url http://localhost:${port}`);
})
.catch((err) => {
    console.error(err);
    process.exit(1);
});